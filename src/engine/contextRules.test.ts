import { describe, expect, it } from "vitest";
import { orgnrInContext } from "./contextRules.ts";

const values = (text: string) => orgnrInContext.detect(text).map((d) => d.value);

describe("orgnrInContext", () => {
  it("masks an org.nr with a failing checksum when labelled", () => {
    expect(values("Stena Recycling AB, org.nr 556147-9036, Göteborg")).toEqual(["556147-9036"]);
  });

  it("accepts orgnr, organisationsnummer, a colon and no dash", () => {
    expect(values("orgnr: 5561479036. Organisationsnummer 556147-9036")).toEqual(["5561479036", "556147-9036"]);
  });

  it("ignores the same number without a label", () => {
    expect(values("Ring 556147-9036")).toEqual([]);
  });

  it("reports offsets of the number only", () => {
    const [d] = orgnrInContext.detect("org.nr 556147-9036");
    expect(d).toEqual({ start: 7, end: 18, value: "556147-9036" });
  });

  it("is labelled ORGANISATIONSNUMMER", () => {
    expect(orgnrInContext.label).toBe("ORGANISATIONSNUMMER");
  });
});
