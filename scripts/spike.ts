// Phase 0 spike: run maskera on the texts in spike/texts and report leaks,
// over-masking and timings. Writes spike/RESULTS.md (gitignored, it quotes
// the texts). A hand-written "## Decision" section in RESULTS.md survives
// re-runs.
//
// Configs: rules (maskera rules only), q4 and q8 (maskera with its model), and
// skrubba (Skrubba's own engine as the app runs it: q8 plus our context rules,
// span merging and spreading of model-found names).
//
// The terminal shows counts only, so real values never end up in a terminal
// log or a chat. Leaked and over-masked values are listed in RESULTS.md.
//
// Usage: npm run spike [-- --dtype q4,q8] [-- --show q4]

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  createNerRecognizer,
  hybridDefaultDetectors,
  MASKERA_SV_NER_MODEL,
  MASKERA_SV_NER_REVISION,
  type NerRecognizer,
  redact,
  redactWithNer,
} from "maskera";
import { MODEL_SRC_DIR } from "../src/config.ts";
import { MaskeraMasker } from "../src/engine/maskeraMasker.ts";
import { createRecognizer, modelSpans } from "../src/engine/nerModel.ts";

const TEXT_DIR = "spike/texts";
const RESULTS = "spike/RESULTS.md";
const CACHE_DIR = ".cache/models";

type Dtype = "q4" | "q8" | "fp32";
type ConfigName = "rules" | Dtype | "skrubba";

/** What a config produced for one text: maskera's RedactResult has this shape. */
interface Outcome {
  text: string;
  redactions: Array<{ value: string; label: string }>;
  restore(masked: string): string;
}

interface Sample {
  name: string;
  text: string;
  expected: string[];
}

interface TextResult {
  sample: Sample;
  masked: string;
  ms: number;
  leaks: string[];
  overMasked: string[];
  roundTrip: boolean;
  redactions: Outcome["redactions"];
}

interface ConfigResult {
  config: ConfigName;
  loadMs?: number;
  texts: TextResult[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadSamples(): Sample[] {
  return readdirSync(TEXT_DIR)
    .filter((f) => f.endsWith(".txt") && !f.endsWith(".expected.txt"))
    .sort()
    .map((f) => {
      const name = basename(f, ".txt");
      const expectedPath = join(TEXT_DIR, `${name}.expected.txt`);
      const expected = existsSync(expectedPath)
        ? readFileSync(expectedPath, "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
      return { name, text: readFileSync(join(TEXT_DIR, f), "utf8"), expected };
    });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word, case-insensitive: "Eva" must not match inside "Evakuering".
function occursAsWord(haystack: string, needle: string): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, "iu");
  return re.test(haystack);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function evaluate(sample: Sample, result: Outcome, ms: number): TextResult {
  const leaks = sample.expected.filter((e) => occursAsWord(result.text, e));
  const expectedNorm = sample.expected.map(norm);
  // A redaction counts as expected if it overlaps an expected value in either
  // direction ("Johan Lindqvist" vs "Johan", "Vintergatan 12 lgh 1102" vs "Vintergatan 12").
  const overMasked = [
    ...new Set(
      result.redactions
        .filter((r) => {
          const v = norm(r.value);
          return !expectedNorm.some((e) => v.includes(e) || e.includes(v));
        })
        .map((r) => `${r.value} (${r.label})`),
    ),
  ];
  return {
    sample,
    masked: result.text,
    ms,
    leaks,
    overMasked,
    roundTrip: result.restore(result.text) === sample.text,
    redactions: result.redactions,
  };
}

function runRules(samples: Sample[]): ConfigResult {
  const texts = samples.map((s) => {
    const t0 = performance.now();
    const r = redact(s.text, { detectors: hybridDefaultDetectors });
    return evaluate(s, r, performance.now() - t0);
  });
  return { config: "rules", texts };
}

async function runModel(samples: Sample[], dtype: Dtype): Promise<ConfigResult> {
  const recognizer: NerRecognizer = createNerRecognizer({ dtype, device: "cpu", cacheDir: CACHE_DIR });
  const t0 = performance.now();
  await recognizer.ready;
  const loadMs = performance.now() - t0;
  // Warm-up so the first sample does not carry session init cost.
  await redactWithNer("Hej, jag heter Anna.", { recognizer });
  const texts: TextResult[] = [];
  for (const s of samples) {
    const t = performance.now();
    const r = await redactWithNer(s.text, { recognizer });
    texts.push(evaluate(s, r, performance.now() - t));
  }
  return { config: dtype, loadMs, texts };
}

async function runSkrubba(samples: Sample[]): Promise<ConfigResult> {
  const recognizer = createRecognizer({ localModelPath: MODEL_SRC_DIR, device: "cpu" });
  const backend = { init: () => recognizer.ready, detect: (text: string) => modelSpans(text, recognizer) };
  const t0 = performance.now();
  await recognizer.ready;
  const loadMs = performance.now() - t0;
  await modelSpans("Hej, jag heter Anna.", recognizer);
  const texts: TextResult[] = [];
  for (const s of samples) {
    // A fresh session per text, like Ny text in the app.
    const masker = new MaskeraMasker(backend);
    const t = performance.now();
    const entities = await masker.mask(s.text, { wordList: [], manual: [] });
    const { masked, key } = masker.applyMask(s.text, entities, []);
    const outcome: Outcome = {
      text: masked,
      redactions: entities.flatMap((e) => e.occurrences.map((o) => ({ value: o.surface, label: e.type }))),
      restore: (m) => masker.restore(m, key).text,
    };
    texts.push(evaluate(s, outcome, performance.now() - t));
  }
  return { config: "skrubba", loadMs, texts };
}

function summaryTable(results: ConfigResult[]): string {
  const lines = [
    "| Config | Load | Text | Chars | Time | Expected | Leaks | Over-masked | Round trip |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const c of results) {
    for (const t of c.texts) {
      lines.push(
        `| ${c.config} | ${c.loadMs === undefined ? "–" : `${Math.round(c.loadMs)} ms`} | ${t.sample.name} | ${t.sample.text.length} | ${t.ms.toFixed(1)} ms | ${t.sample.expected.length} | ${t.leaks.length} | ${t.overMasked.length} | ${t.roundTrip ? "ok" : "FAIL"} |`,
      );
    }
    const leaks = c.texts.reduce((n, t) => n + t.leaks.length, 0);
    const expected = c.texts.reduce((n, t) => n + t.sample.expected.length, 0);
    const over = c.texts.reduce((n, t) => n + t.overMasked.length, 0);
    lines.push(`| **${c.config} total** | | | | | ${expected} | **${leaks}** | ${over} | |`);
  }
  return lines.join("\n");
}

function details(results: ConfigResult[], show: Set<string>): string {
  const out: string[] = [];
  for (const c of results) {
    out.push(`### ${c.config}`, "");
    for (const t of c.texts) {
      out.push(`#### ${c.config} / ${t.sample.name}`, "");
      out.push(`- Leaks: ${t.leaks.length ? t.leaks.map((l) => `\`${l}\``).join(", ") : "none"}`);
      out.push(`- Over-masked: ${t.overMasked.length ? t.overMasked.map((l) => `\`${l}\``).join(", ") : "none"}`);
      out.push(
        `- Labels: ${[...new Set(t.redactions.map((r) => r.label))].sort().join(", ") || "none"}`,
      );
      if (show.has(c.config)) out.push("", "```", t.masked.trimEnd(), "```");
      out.push("");
    }
  }
  return out.join("\n");
}

function keptDecision(): string {
  if (!existsSync(RESULTS)) return "## Decision\n\n_Not yet recorded._\n";
  const prev = readFileSync(RESULTS, "utf8");
  const i = prev.indexOf("## Decision");
  return i >= 0 ? prev.slice(i) : "## Decision\n\n_Not yet recorded._\n";
}

async function main() {
  const samples = loadSamples();
  if (samples.length === 0) {
    console.error(`No texts in ${TEXT_DIR}. See spike/README.md.`);
    process.exit(1);
  }
  const dtypes = (arg("dtype") ?? "q4,q8").split(",") as Dtype[];
  const show = new Set((arg("show") ?? "rules,q4").split(","));

  const results: ConfigResult[] = [runRules(samples)];
  for (const d of dtypes) {
    console.error(`Loading ${MASKERA_SV_NER_MODEL} ${d}…`);
    results.push(await runModel(samples, d));
  }
  console.error("Loading Skrubba's engine (q8)…");
  results.push(await runSkrubba(samples));

  const table = summaryTable(results);
  console.log(table);
  const missing = samples.filter((s) => s.expected.length === 0).map((s) => s.name);
  if (missing.length)
    console.log(`\nNo ${missing.map((n) => `${n}.expected.txt`).join(", ")}: leaks are not counted for these texts, and every masked value counts as over-masked.`);

  const md = [
    "# Spike results",
    "",
    `Generated ${new Date().toISOString()} by \`npm run spike\`. Node ${process.version}, ${process.platform}/${process.arch}, device cpu.`,
    `Model \`${MASKERA_SV_NER_MODEL}\` @ \`${MASKERA_SV_NER_REVISION}\`. Rules = \`redact\` with \`hybridDefaultDetectors\`.`,
    "",
    "Leak = an expected value still present verbatim (whole word, case-insensitive) in the output.",
    "Over-masked = a redaction that does not overlap any expected value.",
    "Round trip = restoring the masked text gives back the original exactly. For skrubba it shows FAIL whenever a first name stands alone: it shares the full name's placeholder, so it comes back as the full name (\"Johan har\" → \"Johan Lindqvist har\").",
    "",
    "## Summary",
    "",
    table,
    "",
    "## Details",
    "",
    details(results, show),
    keptDecision(),
  ].join("\n");
  writeFileSync(RESULTS, md);
  console.error(`Wrote ${RESULTS}: which values leaked or were over-masked, per text.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
