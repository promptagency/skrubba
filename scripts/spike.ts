// Phase 0 spike: run maskera on the texts in spike/texts and report leaks,
// over-masking and timings. Writes spike/RESULTS.md (gitignored, it quotes
// the texts). A hand-written "## Decision" section in RESULTS.md survives
// re-runs.
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
  type RedactResult,
  redact,
  redactWithNer,
} from "maskera";

const TEXT_DIR = "spike/texts";
const RESULTS = "spike/RESULTS.md";
const CACHE_DIR = ".cache/models";

type Dtype = "q4" | "q8" | "fp32";
type ConfigName = "rules" | Dtype;

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
  redactions: RedactResult["redactions"];
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

function evaluate(sample: Sample, result: RedactResult, ms: number): TextResult {
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

  const table = summaryTable(results);
  console.log(table);
  for (const c of results)
    for (const t of c.texts)
      if (t.leaks.length) console.log(`${c.config}/${t.sample.name} leaks: ${t.leaks.join(" | ")}`);

  const md = [
    "# Spike results",
    "",
    `Generated ${new Date().toISOString()} by \`npm run spike\`. Node ${process.version}, ${process.platform}/${process.arch}, device cpu.`,
    `Model \`${MASKERA_SV_NER_MODEL}\` @ \`${MASKERA_SV_NER_REVISION}\`. Rules = \`redact\` with \`hybridDefaultDetectors\`.`,
    "",
    "Leak = an expected value still present verbatim (whole word, case-insensitive) in the output.",
    "Over-masked = a redaction that does not overlap any expected value.",
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
  console.error(`Wrote ${RESULTS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
