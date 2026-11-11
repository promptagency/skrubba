import { describe, expect, it } from "vitest";
import { foldForModel, unshout } from "./nerModel.ts";

describe("foldForModel", () => {
  it("gives letters outside Swedish their base letter and keeps å, ä and ö", () => {
    expect(foldForModel("Dragan Petrović, Ivan Kovačević, Anna Łukasiewicz, Zoë Ørsted, André i Göteborg")).toBe(
      "Dragan Petrovic, Ivan Kovacevic, Anna Lukasiewicz, Zoe Orsted, Andre i Göteborg",
    );
  });

  it("keeps the length, so model offsets fit the original", () => {
    const text = "Đorđe Æbelø, straße, 😀 ”Petrović” ﬁ";
    expect(foldForModel(text)).toHaveLength(text.length);
  });
});

describe("unshout", () => {
  it("puts a line in capitals in title case and leaves other lines alone", () => {
    expect(unshout("LEONORA BEXELL PÅ BRÄNNVIK KONSULT AB\nHej Anna, ring HR.")).toBe(
      "Leonora Bexell På Brännvik Konsult Ab\nHej Anna, ring HR.",
    );
  });

  it("leaves a short acronym line and a mixed line as they are", () => {
    expect(unshout("HR\nVD Anna Berg ringde i dag om avtalet")).toBe("HR\nVD Anna Berg ringde i dag om avtalet");
  });
});
