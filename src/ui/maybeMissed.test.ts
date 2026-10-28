import { describe, expect, it } from "vitest";
import type { Entity } from "../engine/index.ts";
import { maybeMissed } from "./maybeMissed.ts";

function entity(value: string, text: string): Entity {
  const start = text.indexOf(value);
  return {
    id: "[NAMN_1]",
    value,
    type: "NAMN",
    placeholder: "[NAMN_1]",
    occurrences: [{ start, end: start + value.length, surface: value }],
    active: true,
    source: "model",
  };
}

describe("maybeMissed", () => {
  it("lists capitalised words mid-sentence that no entity covers, with their count", () => {
    const text = "Vi träffade Personvagnar i går och Personvagnar igen idag.";
    expect(maybeMissed(text, [])).toEqual([{ value: "Personvagnar", count: 2 }]);
  });

  it("leaves out words an entity already covers, kept or not", () => {
    const text = "Vi träffade Anna och Erik.";
    const anna = entity("Anna", text);
    const erik = { ...entity("Erik", text), active: false };
    expect(maybeMissed(text, [anna, erik])).toEqual([]);
  });

  it("leaves out a lone word at the start of a sentence or line", () => {
    expect(maybeMissed("Ringde igår. Anna svarade.\nBerg kom.\n- Sara kom.\n1. Olle kom.", [])).toEqual([]);
  });

  it("counts a lone word at a sentence start when the same word also stands mid-sentence", () => {
    expect(maybeMissed("Anna ringde. Vi svarade Anna direkt.", [])).toEqual([{ value: "Anna", count: 2 }]);
  });

  it("joins neighbouring capitalised words into one row, also at a sentence start", () => {
    expect(maybeMissed("Anna Berg ringde till Volvo Personvagnar.", [])).toEqual([
      { value: "Anna Berg", count: 1 },
      { value: "Volvo Personvagnar", count: 1 },
    ]);
  });

  it("leaves out common capitalised words, acronyms and placeholders", () => {
    expect(maybeMissed("Hej Anna, Jag och Vi ses på Måndag i Mars hos HR om AI. [NAMN_1] kom.", [])).toEqual([
      { value: "Anna", count: 1 },
    ]);
  });

  it("keeps Swedish letters and hyphens inside a word", () => {
    expect(maybeMissed("Vi ringde Åsa-Britt Öhman.", [])).toEqual([{ value: "Åsa-Britt Öhman", count: 1 }]);
  });
});
