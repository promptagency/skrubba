// maskera's privacy-safe Swedish domain corpus (258 texts, 952 annotated
// values; MIT, see fixtures/maskeraDomain.md) through Skrubba's whole
// pipeline, scored the way maskera scores it. Every value that leaks today is
// listed in KNOWN_LEAKS: a new leak fails the test, and so does a fixed one,
// so the list is updated on purpose.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { backend, runModelTests } from "./modelForTests.ts";

interface DomainText {
  id: string;
  kategori: string;
  text: string;
  forvantad: string[];
}

const CORPUS: DomainText[] = JSON.parse(readFileSync(new URL("./fixtures/maskeraDomain.json", import.meta.url), "utf8"));

/**
 * "id: value", for every value left in clear text, in whole or in part. Plain
 * maskera with the same model leaks these too, and more that our own rules
 * mask: "Jonas Falk" on a "From:" line, personnummer split by OCR, and phone
 * numbers and email addresses read out in a call (measured 2026-10-21).
 */
const KNOWN_LEAKS: string[] = [
  "edge2-11: Holmquist", // "Rune\nHolmquist", a name split over two lines by OCR
  "edge2-11: Rune",
  "intern-chatt-10: ake p", // "Åke Petersson" without the å, and only an initial
];

/**
 * Values the model masks on some processors and not on others: native ONNX
 * Runtime's results differ slightly between them. "Malin" leaked on GitHub's
 * x86 runner and not on an Arm Mac (2026-10-19). They may leak, or not.
 */
const LEAKS_ON_SOME_CPUS = new Set(["blandat-webb-02: Malin"]);

/**
 * Texts that do not restore to themselves, up to case: an entity has one
 * stored spelling ("kjell-olov" and "Kjell-Olov" both come back as "Kjell-Olov").
 */
const KNOWN_RESTORE_FAILURES: string[] = [];

const run = await runModelTests();

// maskera's scorer (packages/ner/eval/domain-regression/run.mjs): a value
// leaks if it, or one of its words of four letters or more, is still there
// as a whole word.
const STOP_WORDS = new Set(["och", "att", "den", "det", "som", "med", "har", "ska"]);
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const asWord = (s: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");

function leaked(value: string, masked: string): boolean {
  const out = normalize(masked);
  if (asWord(normalize(value)).test(out)) return true;
  return value
    .split(/\s+/)
    .map((w) => w.replace(/[.,;:!?()"']/g, ""))
    .some((w) => w.length >= 4 && !STOP_WORDS.has(normalize(w)) && asWord(normalize(w)).test(out));
}

describe.skipIf(!run)("maskera's domain corpus through Skrubba", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it("leaks only the known values, and restores all but the known texts", async () => {
    const leaks: string[] = [];
    const restoreFailures: string[] = [];
    for (const { id, text, forvantad } of CORPUS) {
      const masker = new MaskeraMasker(backend);
      const { masked, key } = masker.applyMask(text, await masker.mask(text, { wordList: [], manual: [] }), []);
      for (const value of forvantad) if (leaked(value, masked)) leaks.push(`${id}: ${value}`);
      if (masker.restore(masked, key).text.toLowerCase() !== text.toLowerCase()) restoreFailures.push(id);
    }
    const total = CORPUS.reduce((n, t) => n + t.forvantad.length, 0);
    console.log(`Domain corpus: ${total - leaks.length}/${total} values masked, ${leaks.length} leaked`);
    expect(leaks.filter((l) => !LEAKS_ON_SOME_CPUS.has(l))).toEqual(KNOWN_LEAKS);
    expect(restoreFailures).toEqual(KNOWN_RESTORE_FAILURES);
  }, 300_000);
});
