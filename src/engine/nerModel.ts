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
 * spans mapped back to the original offsets (see unspace.ts).
 */
export async function modelSpans(original: string, recognizer: NerRecognizer): Promise<Span[]> {
  const { text, back } = unspace(original);
  const { redactions } = await redactWithNer(text, { recognizer, detectors: ruleDetectors });
  const ruleKeys = new Set(runDetectors(text, ruleDetectors).map((d) => `${d.start}:${d.end}`));
  return redactions
    .filter((r) => !ruleKeys.has(`${r.start}:${r.end}`))
    .map((r) => ({ ...mapBack(r, back), type: r.label as EntityType, source: "model" }));
}
