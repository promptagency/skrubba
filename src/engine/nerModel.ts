// The model layer: maskera's recognizer on our self-hosted files. Imported by
// worker.ts in the browser and by the Node round-trip test, never by the main
// bundle.
import { createNerRecognizer, type NerOptions, type NerRecognizer, redactWithNer, runDetectors } from "maskera";
import { MODEL, MODEL_BASE } from "../config.ts";
import type { EntityType, Span } from "./Masker.ts";
import { ruleDetectors } from "./rules.ts";
import { mapBack, unspace } from "./unspace.ts";

// minScore stays at maskera's 0.5: it only drops entities the model found, so
// 0.2–0.4 caught nothing more on the domain corpus and masked "hantverkaren" (2026-10-21).
export function createRecognizer(options: Partial<NerOptions> = {}): NerRecognizer {
  return createNerRecognizer({
    model: MODEL.directory,
    localModelPath: MODEL_BASE,
    allowLocalModels: true,
    allowRemoteModels: false,
    dtype: MODEL.dtype,
    ...options,
  });
}

/**
 * Model spans for `text`. Goes through redactWithNer rather than
 * recognizer.detect so we get maskera's model post-processing (street number
 * attachment, lowercase locality fix) and its clipping against rule spans.
 * The rule redactions are removed again; the main thread has its own.
 * Letter-spaced words ("A n d e r s") are closed up for the model and its
 * spans mapped back to the original offsets (see unspace.ts). Letters outside
 * Swedish are folded for the model too (see foldForModel). A text with lines
 * in capitals is read twice, as written and in title case (see unshout), and
 * the spans of both readings are kept: each finds names the other misses.
 */
export async function modelSpans(original: string, recognizer: NerRecognizer): Promise<Span[]> {
  const unspaced = unspace(original);
  const folded = foldForModel(unspaced.text);
  const readings = [folded, unshout(folded)].filter((t, i, all) => all.indexOf(t) === i);
  const spans: Span[] = [];
  for (const text of readings) {
    const { redactions } = await redactWithNer(text, { recognizer, detectors: ruleDetectors });
    const ruleKeys = new Set(runDetectors(text, ruleDetectors).map((d) => `${d.start}:${d.end}`));
    for (const r of redactions) {
      if (!ruleKeys.has(`${r.start}:${r.end}`)) spans.push({ ...mapBack(r, unspaced.back), type: r.label as EntityType, source: "model" });
    }
  }
  return spans;
}

// Letters that don't decompose into a base letter and a mark.
const FOLD: Record<string, string> = { Ł: "L", ł: "l", Ø: "O", ø: "o", Đ: "D", đ: "d", Ð: "D", ð: "d", Æ: "A", æ: "a", Þ: "T", þ: "t", Ħ: "H", ħ: "h", ı: "i", ß: "s" };

/**
 * The model drops a word with a letter it hardly saw in training: "Dragan
 * Petrovic" is one name, "Dragan Petrović" only "Dragan", and "Kovačević",
 * "Łukasiewicz" and "Ørsted" are not found at all. So every letter but å, ä
 * and ö goes to the model as its base letter. One UTF-16 unit stays one, so
 * the model's offsets fit the original text unchanged.
 */
export function foldForModel(text: string): string {
  return text.replace(/[^\x00-\x7FåäöÅÄÖ]/g, (c) => {
    if (FOLD[c]) return FOLD[c];
    const base = c.normalize("NFD")[0] ?? c;
    return base !== c && /[A-Za-z]/.test(base) ? base : c;
  });
}

/**
 * The model finds next to nothing in capitals: "LEONORA BEXELL PÅ BRÄNNVIK
 * KONSULT AB" gave only "AB". A line that is mostly capitals goes to the model
 * in title case ("Leonora Bexell På Brännvik Konsult Ab"), where it finds the
 * name and the company. Same length, so the offsets fit the original.
 */
export function unshout(text: string): string {
  return text.replace(/[^\n]+/g, (line) => {
    const upper = line.match(/\p{Lu}/gu)?.length ?? 0;
    const lower = line.match(/\p{Ll}/gu)?.length ?? 0;
    if (upper < 4 || upper < 4 * lower) return line;
    return line.replace(/(\p{L})(\p{L}+)/gu, (_, first: string, rest: string) => {
      const low = rest.toLowerCase();
      return first + (low.length === rest.length ? low : rest);
    });
  });
}
