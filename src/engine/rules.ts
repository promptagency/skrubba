// The rule layer. Runs synchronously on the main thread and, with the same
// list, inside the worker so model spans are clipped against it.
import { adress, contextualDetectors, type Detector, defaultDetectors, lagenhetsnummer, redact, regnummer } from "@maskera/core";
import {
  ampersandName,
  companyName,
  domainName,
  headerName,
  intlPhone,
  labelledNumber,
  momsnummer,
  orgnrInContext,
  splitPersonnummer,
  spokenEmail,
  spokenPhone,
} from "./contextRules.ts";
import type { EntityType, Span } from "./Masker.ts";

// maskera's hybridDefaultDetectors (a test guards against drift), rebuilt
// from @maskera/core so the main bundle does not pull in the model package,
// plus maskera's regnummer rule (off upstream, since a booking code can look
// like a plate; on here, since a miss is worse than an over-mask) and our own
// rules.
export const ruleDetectors: Detector[] = [
  ...defaultDetectors,
  ...contextualDetectors,
  adress,
  lagenhetsnummer,
  regnummer,
  orgnrInContext,
  momsnummer,
  companyName,
  headerName,
  intlPhone,
  domainName,
  labelledNumber,
  splitPersonnummer,
  spokenPhone,
  spokenEmail,
  ampersandName,
];

export function ruleSpans(text: string): Span[] {
  return redact(text, { detectors: ruleDetectors }).redactions.map((r) => ({
    start: r.start,
    end: r.end,
    type: r.label as EntityType,
    source: "rule",
  }));
}
