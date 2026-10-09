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

  it("builds a key with the word list and metadata", () => {
    const { key } = applyMask(text, [anna], ["Nordljus"]);
    expect(key.wordList).toEqual(["Nordljus"]);
    expect(key.app).toBe("skrubba");
    expect(key.version).toBe(1);
    expect(Number.isNaN(Date.parse(key.createdAt))).toBe(false);
  });
});
