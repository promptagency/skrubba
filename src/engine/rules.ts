// The rule layer. Runs synchronously on the main thread and, with the same
// list, inside the worker so model spans are clipped against it.
import { adress, contextualDetectors, type Detector, defaultDetectors, lagenhetsnummer, redact, regnummer } from "@maskera/core";
import {
  ampersandName,
  birthColumn,
  birthDate,
  companyName,
  domainName,
  headerName,
  intlPhone,
  bareLabelNumber,
  handle,
  labelledNumber,
  postbox,
  momsnummer,
  orgnrInContext,
  placeCompound,
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
  bareLabelNumber,
  handle,
  postbox,
  birthDate,
  birthColumn,
  placeCompound,
  splitPersonnummer,
  spokenPhone,
  spokenEmail,
  ampersandName,
];

// maskera takes five digits before a capitalised word for a postnummer, so a
// salary in a table cell ("Lön\t42000\nLisa") was one. A cell edge (a tab) on
// either side says it is a table value.
const inTableCell = (text: string, start: number, end: number) =>
  /^\d{5}$/.test(text.slice(start, end)) && (text[start - 1] === "\t" || text[end] === "\t");

export function ruleSpans(text: string): Span[] {
  return redact(text, { detectors: ruleDetectors })
    .redactions.filter((r) => !(r.label === "POSTNUMMER" && inTableCell(text, r.start, r.end)))
    .map((r) => ({ start: r.start, end: r.end, type: r.label as EntityType, source: "rule" }));
}
