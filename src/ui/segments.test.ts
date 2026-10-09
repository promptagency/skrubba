import { describe, expect, it } from "vitest";
import type { Entity } from "../engine/index.ts";
import { entityAt, segments } from "./segments.ts";

const text = "Anna ringde Erik. Anna igen.";
const anna: Entity = {
  id: "[NAMN_1]",
  value: "Anna",
  type: "NAMN",
  placeholder: "[NAMN_1]",
  occurrences: [
    { start: 0, end: 4, surface: "Anna" },
    { start: 18, end: 22, surface: "Anna" },
  ],
  active: true,
  source: "model",
};
const erik: Entity = { ...anna, id: "[NAMN_2]", placeholder: "[NAMN_2]", value: "Erik", occurrences: [{ start: 12, end: 16, surface: "Erik" }] };

describe("segments", () => {
  it("splits text into plain and highlighted runs in order", () => {
    expect(segments(text, [erik, anna]).map((s) => [s.text, s.entity?.placeholder ?? null])).toEqual([
      ["Anna", "[NAMN_1]"],
      [" ringde ", null],
      ["Erik", "[NAMN_2]"],
      [". ", null],
      ["Anna", "[NAMN_1]"],
      [" igen.", null],
    ]);
  });

  it("returns one plain run without entities", () => {
    expect(segments("Hej", [])).toEqual([{ text: "Hej", start: 0 }]);
  });
});

describe("entityAt", () => {
  it("finds the entity overlapping a selection", () => {
    expect(entityAt([anna, erik], 13, 14)?.placeholder).toBe("[NAMN_2]");
    expect(entityAt([anna, erik], 5, 10)).toBeUndefined();
  });

  it("finds the entity at a caret", () => {
    expect(entityAt([anna, erik], 2, 2)?.placeholder).toBe("[NAMN_1]");
  });
});
