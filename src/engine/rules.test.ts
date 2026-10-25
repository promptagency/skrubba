import { regnummer } from "@maskera/core";
import { hybridDefaultDetectors } from "maskera";
import { describe, expect, it } from "vitest";
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
  bankgiroInContext,
  momsnummer,
  orgnrInContext,
  plusgiroInContext,
  placeCompound,
  splitPersonnummer,
  spokenEmail,
  spokenPhone,
} from "./contextRules.ts";
import { ruleDetectors, ruleSpans } from "./rules.ts";

describe("ruleDetectors", () => {
  it("is maskera's hybrid default set plus regnummer and our own rules", () => {
    expect(ruleDetectors).toEqual([...hybridDefaultDetectors, regnummer, orgnrInContext, bankgiroInContext, plusgiroInContext, momsnummer, companyName, headerName, intlPhone, domainName, labelledNumber, bareLabelNumber, handle, postbox, birthDate, birthColumn, placeCompound, splitPersonnummer, spokenPhone, spokenEmail, ampersandName]);
  });
});

describe("ruleSpans", () => {
  it("finds structured identifiers as rule spans with maskera labels", () => {
    const text = "Pnr 19850312-4471, tel 070-1740612, org.nr 556147-9036.";
    const spans = ruleSpans(text);
    expect(spans.map((s) => [text.slice(s.start, s.end), s.type, s.source])).toEqual([
      ["19850312-4471", "PERSONNUMMER", "rule"],
      ["070-1740612", "TELEFON", "rule"],
      ["556147-9036", "ORGANISATIONSNUMMER", "rule"],
    ]);
  });

  it("finds company names, VAT numbers and bare domains", () => {
    const text = "Norrström Media AB (SE556147903601) finns på norrstrommedia.se. Norrström Media svarar.";
    const spans = ruleSpans(text);
    expect(spans.map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ["Norrström Media", "ORGANISATION"],
      ["SE556147903601", "ORGANISATIONSNUMMER"],
      ["norrstrommedia.se", "URL"],
      ["Norrström Media", "ORGANISATION"],
    ]);
  });

  it("finds car registration numbers, old and new style, but not currency amounts", () => {
    const text = "Bilen ABC 123 och DEF45G. Kostar SEK 100 eller EUR 12A.";
    expect(ruleSpans(text).map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ["ABC 123", "REGNUMMER"],
      ["DEF45G", "REGNUMMER"],
    ]);
  });

  it("keeps an email address whole and a URL whole", () => {
    const text = "anna@norrstrommedia.se, https://norrstrommedia.se/om";
    expect(ruleSpans(text).map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ["anna@norrstrommedia.se", "EPOST"],
      ["https://norrstrommedia.se/om", "URL"],
    ]);
  });

  it("leaves a five-digit table cell alone, and keeps a postnummer before its town", () => {
    const text = "Namn\tLön\nLisa Berg\t42000\nAnna Ek\t61000\tStockholm\n12345 Stockholm, 123 45 Lund";
    expect(ruleSpans(text).map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ["12345", "POSTNUMMER"],
      ["123 45", "POSTNUMMER"],
    ]);
  });

  it("finds labelled numbers, and leaves an org.nr to its own rule", () => {
    const text = "Kundnummer 48213377, avtalsnummer AB-1234-567, org.nr 556147-9036.";
    expect(ruleSpans(text).map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ["48213377", "REFERENSNUMMER"],
      ["AB-1234-567", "REFERENSNUMMER"],
      ["556147-9036", "ORGANISATIONSNUMMER"],
    ]);
  });
});
