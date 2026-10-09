// The rule layer. Runs synchronously on the main thread and, with the same
// list, inside the worker so model spans are clipped against it.
import { adress, contextualDetectors, type Detector, defaultDetectors, lagenhetsnummer, redact } from "@maskera/core";
import { orgnrInContext } from "./contextRules.ts";
import type { EntityType, Span } from "./Masker.ts";

// Same as maskera's hybridDefaultDetectors (a test guards against drift),
// rebuilt from @maskera/core so the main bundle does not pull in the model
// package.
export const ruleDetectors: Detector[] = [
  ...defaultDetectors,
  ...contextualDetectors,
  adress,
  lagenhetsnummer,
  orgnrInContext,
];

export function ruleSpans(text: string): Span[] {
  return redact(text, { detectors: ruleDetectors }).redactions.map((r) => ({
    start: r.start,
    end: r.end,
    type: r.label as EntityType,
    source: "rule",
  }));
}
