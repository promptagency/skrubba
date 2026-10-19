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
 * maskera with the same model leaks the same values (measured 2026-10-19).
 */
const KNOWN_LEAKS: string[] = [
  "edge2-09: Jonas Falk", // "From: Jonas Falk" header line
  "edge2-10: 580722-437", // OCR-garbled personnummer
  "edge2-11: Holmquist",
  "edge2-11: 730928-",
  "edge2-11: 1231",
  "edge2-11: Rune",
  "edge2-17: 8506 23-2381", // personnummer with a stray space
  "intern-chatt-10: ake p",
  "telefon-transkript-03: pelle punkt johansson snabel-a outlook punkt com", // spoken email address
  "telefon-transkript-05: noll sju noll två ett fyra sex fem åtta", // spoken phone number
  "telefon-transkript-14: gun punkt britt snabel-a bredband punkt net",
];

/** Texts that do not restore to themselves. */
const KNOWN_RESTORE_FAILURES: string[] = [
  "juridik-10", // "kjell-olov" comes back as the key has it, "Kjell-Olov"
  "telefon-transkript-10", // "Kalle" comes back as "kalle"
  "vard-remiss-03", // "glukos" comes back as "Glukos"
];

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
      if (masker.restore(masked, key).text !== text) restoreFailures.push(id);
    }
    const total = CORPUS.reduce((n, t) => n + t.forvantad.length, 0);
    console.log(`Domain corpus: ${total - leaks.length}/${total} values masked, ${leaks.length} leaked`);
    expect(leaks).toEqual(KNOWN_LEAKS);
    expect(restoreFailures).toEqual(KNOWN_RESTORE_FAILURES);
  }, 300_000);
});
