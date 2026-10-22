import { describe, expect, it } from "vitest";
import { applyMask } from "./applyMask.ts";
import type { Entity } from "./Masker.ts";

const entity = (over: Partial<Entity> & Pick<Entity, "placeholder" | "value" | "occurrences">): Entity => ({
  id: over.placeholder,
  type: "NAMN",
  active: true,
  source: "model",
  ...over,
});

const text = "Anna ringde Erik. Annas lön.";
const anna = entity({
  placeholder: "[NAMN_1]",
  value: "Anna",
  occurrences: [
    { start: 0, end: 4, surface: "Anna" },
    { start: 18, end: 22, surface: "Anna" },
  ],
});
const erik = entity({ placeholder: "[NAMN_2]", value: "Erik", occurrences: [{ start: 12, end: 16, surface: "Erik" }] });

describe("applyMask", () => {
  it("replaces every occurrence of active entities", () => {
    expect(applyMask(text, [anna, erik], []).masked).toBe("[NAMN_1] ringde [NAMN_2]. [NAMN_1]s lön.");
  });

  it("leaves entities set to Behåll in the clear and out of the key", () => {
    const { masked, key } = applyMask(text, [anna, { ...erik, active: false }], []);
    expect(masked).toBe("[NAMN_1] ringde Erik. [NAMN_1]s lön.");
    expect(key.entries).toEqual([{ placeholder: "[NAMN_1]", value: "Anna", type: "NAMN" }]);
  });

  it("writes a linked first name as [FÖRNAMN_n] and adds it to the key", () => {
    const t = "Johan Lindqvist är sjuk. Johans lön.";
    const johan = entity({
      placeholder: "[NAMN_1]",
      value: "Johan Lindqvist",
      occurrences: [
        { start: 0, end: 15, surface: "Johan Lindqvist" },
        { start: 25, end: 30, surface: "Johan", firstName: true },
      ],
    });
    const { masked, key } = applyMask(t, [johan], []);
    expect(masked).toBe("[NAMN_1] är sjuk. [FÖRNAMN_1]s lön.");
    expect(key.entries).toEqual([
      { placeholder: "[NAMN_1]", value: "Johan Lindqvist", type: "NAMN" },
      { placeholder: "[FÖRNAMN_1]", value: "Johan", type: "FÖRNAMN" },
    ]);
  });

  it("writes a linked surname as [EFTERNAMN_n] and adds it to the key", () => {
    const t = "Johan Lindqvist är sjuk. Lindqvists lön.";
    const johan = entity({
      placeholder: "[NAMN_1]",
      value: "Johan Lindqvist",
      occurrences: [
        { start: 0, end: 15, surface: "Johan Lindqvist" },
        { start: 25, end: 34, surface: "Lindqvist", lastName: true },
      ],
    });
    const { masked, key } = applyMask(t, [johan], []);
    expect(masked).toBe("[NAMN_1] är sjuk. [EFTERNAMN_1]s lön.");
    expect(key.entries).toEqual([
      { placeholder: "[NAMN_1]", value: "Johan Lindqvist", type: "NAMN" },
      { placeholder: "[EFTERNAMN_1]", value: "Lindqvist", type: "EFTERNAMN" },
    ]);
  });

  it("builds a key with the word list and metadata", () => {
    const { key } = applyMask(text, [anna], ["Nordljus"]);
    expect(key.wordList).toEqual(["Nordljus"]);
    expect(key.app).toBe("skrubba");
    expect(key.version).toBe(1);
    expect(Number.isNaN(Date.parse(key.createdAt))).toBe(false);
  });
});

describe("applyMask part of a value", () => {
  it("writes a linked word of a company as [DEL_ORGANISATION_n] and adds it to the key", () => {
    const text = "Volvo Cars växer. Volvo-fabriken.";
    const { masked, key } = applyMask(
      text,
      [
        {
          id: "[ORGANISATION_1]",
          value: "Volvo Cars",
          type: "ORGANISATION",
          placeholder: "[ORGANISATION_1]",
          occurrences: [
            { start: 0, end: 10, surface: "Volvo Cars" },
            { start: 18, end: 23, surface: "Volvo", firstName: true },
          ],
          active: true,
          source: "model",
        },
      ],
      [],
    );
    expect(masked).toBe("[ORGANISATION_1] växer. [DEL_ORGANISATION_1]-fabriken.");
    expect(key.entries).toEqual([
      { placeholder: "[ORGANISATION_1]", value: "Volvo Cars", type: "ORGANISATION" },
      { placeholder: "[DEL_ORGANISATION_1]", value: "Volvo", type: "DEL_ORGANISATION" },
    ]);
  });
});
