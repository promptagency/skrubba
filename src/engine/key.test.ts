import { describe, expect, it } from "vitest";
import { keyFileName, mergeEntries, parseKey } from "./key.ts";
import type { Key } from "./Masker.ts";

const valid: Key = {
  entries: [
    { placeholder: "[NAMN_1]", value: "Anna Berg", type: "NAMN" },
    { placeholder: "[ORD_2]", value: "Havsvind", type: "ORD" },
  ],
  wordList: ["Havsvind"],
  createdAt: "2026-10-10T08:00:00.000Z",
  app: "skrubba",
  version: 1,
};

describe("parseKey", () => {
  it("accepts a key downloaded from Skrubba", () => {
    expect(parseKey(JSON.stringify(valid))).toEqual(valid);
  });

  it("accepts a first-name row, Ö and all", () => {
    const withFirstName = { ...valid, entries: [...valid.entries, { placeholder: "[FÖRNAMN_1]", value: "Anna", type: "FÖRNAMN" }] };
    expect(parseKey(JSON.stringify(withFirstName))).toEqual(withFirstName);
  });

  it.each([
    ["not JSON", "{"],
    ["another app", JSON.stringify({ ...valid, app: "other" })],
    ["another version", JSON.stringify({ ...valid, version: 2 })],
    ["entries missing", JSON.stringify({ ...valid, entries: undefined })],
    ["a bad placeholder", JSON.stringify({ ...valid, entries: [{ placeholder: "NAMN_1", value: "x", type: "NAMN" }] })],
    ["an unknown type", JSON.stringify({ ...valid, entries: [{ placeholder: "[FOO_1]", value: "x", type: "FOO" }] })],
    ["a type that does not match the placeholder", JSON.stringify({ ...valid, entries: [{ placeholder: "[PLATS_1]", value: "x", type: "NAMN" }] })],
    ["a duplicate placeholder", JSON.stringify({ ...valid, entries: [valid.entries[0], { ...valid.entries[0], value: "Erik" }] })],
    ["a word list that is not strings", JSON.stringify({ ...valid, wordList: [1] })],
  ])("rejects %s", (_, raw) => {
    expect(parseKey(raw)).toBeNull();
  });
});

describe("mergeEntries", () => {
  it("adds new placeholders, and gives an existing one its latest value in its old place", () => {
    const merged = mergeEntries(valid.entries, [
      { placeholder: "[NAMN_1]", value: "anna berg", type: "NAMN" },
      { placeholder: "[NAMN_2]", value: "Erik Ek", type: "NAMN" },
    ]);
    expect(merged.map((e) => `${e.placeholder}=${e.value}`)).toEqual(["[NAMN_1]=anna berg", "[ORD_2]=Havsvind", "[NAMN_2]=Erik Ek"]);
  });
});

describe("keyFileName", () => {
  it("dates the file", () => {
    expect(keyFileName(new Date("2026-10-10T08:00:00Z"))).toBe("skrubba-kodnyckel-2026-10-10.json");
  });
});
