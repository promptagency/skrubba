import { hybridDefaultDetectors } from "maskera";
import { describe, expect, it } from "vitest";
import { orgnrInContext } from "./contextRules.ts";
import { ruleDetectors, ruleSpans } from "./rules.ts";

describe("ruleDetectors", () => {
  it("is maskera's hybrid default set plus our context rule", () => {
    expect(ruleDetectors).toEqual([...hybridDefaultDetectors, orgnrInContext]);
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
});
