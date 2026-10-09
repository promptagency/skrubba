import { describe, expect, it } from "vitest";
import type { Key } from "./Masker.ts";
import { tolerantRestore } from "./tolerantRestore.ts";

const key: Key = {
  entries: [
    { placeholder: "[NAMN_1]", value: "Anna Berg", type: "NAMN" },
    { placeholder: "[NAMN_2]", value: "Anders", type: "NAMN" },
    { placeholder: "[ORGANISATION_1]", value: "Atea", type: "ORGANISATION" },
    { placeholder: "[ORGANISATIONSNUMMER_1]", value: "556677-8899", type: "ORGANISATIONSNUMMER" },
    { placeholder: "[IP_ADRESS_1]", value: "10.0.0.1", type: "IP_ADRESS" },
  ],
  wordList: [],
  createdAt: "2026-10-09T00:00:00.000Z",
  app: "skrubba",
  version: 1,
};

const restore = (text: string, accepted?: ReadonlySet<string>) => tolerantRestore(text, key, accepted);

describe("tolerantRestore silent matches", () => {
  it.each([
    ["Hej [NAMN_1].", "Hej Anna Berg."],
    ["Hej NAMN_1.", "Hej Anna Berg."],
    ["Hej `NAMN_1`.", "Hej Anna Berg."],
    ["Hej namn_1.", "Hej Anna Berg."],
    ["Hej [Namn_1].", "Hej Anna Berg."],
    ['Hon skrev "[NAMN_1]".', 'Hon skrev "Anna Berg".'],
    ["[NAMN_1]s lön", "Anna Bergs lön"],
    ["[ORGANISATIONSNUMMER_1] för [ORGANISATION_1]", "556677-8899 för Atea"],
    ["IP [IP_ADRESS_1].", "IP 10.0.0.1."],
  ])("%s", (input, expected) => {
    const r = restore(input);
    expect(r.text).toBe(expected);
    expect(r.suggestions).toEqual([]);
    expect(r.unknown).toEqual([]);
  });

  it("reports restored spans with offsets in the output", () => {
    const r = restore("Till [NAMN_1] från [ORGANISATION_1]");
    expect(r.restored.map((s) => r.text.slice(s.start, s.end))).toEqual(["Anna Berg", "Atea"]);
    expect(r.restored.map((s) => s.placeholder)).toEqual(["[NAMN_1]", "[ORGANISATION_1]"]);
  });
});

describe("tolerantRestore suggestions", () => {
  it.each(["NAMN 1", "NAMN-1", "NAMN1", "NAMN_01", "NAMN_1s", "NAMN_1:s", "NAME_1", "[PERSON_1]"])(
    "suggests rather than restores %s",
    (found) => {
      const r = restore(`Hej ${found}, välkommen.`);
      expect(r.text).toBe(`Hej ${found}, välkommen.`);
      expect(r.restored).toEqual([]);
      expect(r.suggestions).toEqual([
        { start: 4, end: 4 + found.length, found, placeholder: "[NAMN_1]", value: "Anna Berg" },
      ]);
    },
  );

  it("restores a suggestion the user accepted", () => {
    expect(restore("Hej NAMN 1 och NAME_1", new Set(["NAMN 1"])).text).toBe("Hej Anna Berg och NAME_1");
  });

  it("restores an accepted inflected form as a Swedish genitive", () => {
    expect(restore("NAMN_1s bil och NAMN_2:s cykel", new Set(["NAMN_1s", "NAMN_2:s"])).text).toBe(
      "Anna Bergs bil och Anders cykel",
    );
  });
});

describe("tolerantRestore unknown placeholders", () => {
  it("reports a number that is not in the key and leaves it", () => {
    const r = restore("Hej [NAMN_7] och PERSON_9.");
    expect(r.text).toBe("Hej [NAMN_7] och PERSON_9.");
    expect(r.unknown.map((u) => u.found)).toEqual(["[NAMN_7]", "PERSON_9"]);
  });
});

describe("tolerantRestore leaves ordinary text alone", () => {
  it.each(["NAMNET_1", "SNAMN_1", "NAMN_", "Namn: Anna", "kostar 100 kr per 1 st", "NAMN_1234567"])("%s", (input) => {
    const r = restore(input);
    expect(r.text).toBe(input);
    expect(r.suggestions).toEqual([]);
    expect(r.restored).toEqual([]);
  });
});
