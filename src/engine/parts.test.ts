import { describe, expect, it } from "vitest";
import { OVERLAP_CHARS, PART_CHARS, splitForModel } from "./parts.ts";

const words = (n: number) => "ord ".repeat(n);

describe("splitForModel", () => {
  it("gives one part for an empty or short text", () => {
    expect(splitForModel("")).toEqual([]);
    expect(splitForModel("Anna Berg ringde.")).toEqual([{ start: 0, end: 17 }]);
  });

  it("covers the whole text, in order, with no part over the limit", () => {
    const text = `${"Anna Berg ringde om avtalet. ".repeat(200)}\n\n${words(800)}`;
    const parts = splitForModel(text);
    expect(parts[0].start).toBe(0);
    expect(parts.at(-1)?.end).toBe(text.length);
    for (const [i, p] of parts.entries()) {
      expect(p.end - p.start).toBeLessThanOrEqual(PART_CHARS);
      if (i > 0) {
        expect(p.start).toBeLessThanOrEqual(parts[i - 1].end);
        expect(p.start).toBeGreaterThan(parts[i - 1].start);
      }
    }
  });

  it("prefers a paragraph break, then a sentence end", () => {
    const paragraph = `${"Ett stycke om avtalet. ".repeat(40)}\n\n${"Nästa stycke. ".repeat(80)}`;
    const first = splitForModel(paragraph)[0];
    expect(paragraph.slice(first.end - 2, first.end)).toBe("\n\n");

    const sentences = "Anna Berg ringde om avtalet igen. ".repeat(80);
    const cut = splitForModel(sentences)[0].end;
    expect(sentences.slice(cut - 2, cut)).toBe(". ");
  });

  it("overlaps after a sentence end too, since a full stop may be an abbreviation", () => {
    // "Anna B. " is the only sentence end in the search window of the first part.
    const text = `${words(200)}Anna B. Karlsson ${words(400)}`;
    const [first, second] = splitForModel(text);
    expect(text.slice(first.end - 8, first.end)).toBe("Anna B. ");
    expect(second.start).toBeLessThan(first.end);
    expect(first.end - second.start).toBeLessThanOrEqual(OVERLAP_CHARS);
    expect(text.slice(second.start, text.indexOf("Karlsson") + 8)).toContain("Anna B. Karlsson");
  });

  it("cuts a run without full stops between words, and overlaps the next part", () => {
    const text = words(1000);
    const [first, second] = splitForModel(text);
    expect(text[first.end - 1]).toBe(" ");
    expect(second.start).toBeLessThan(first.end);
    expect(first.end - second.start).toBeLessThanOrEqual(OVERLAP_CHARS);
    expect(text[second.start - 1]).toBe(" ");
  });

  it("never cuts inside a word", () => {
    const text = `${words(297)}Anna Berg ${words(400)}`;
    for (const p of splitForModel(text)) {
      expect(/\S/.test(text[p.start - 1] ?? " ") && /\S/.test(text[p.start])).toBe(false);
      expect(/\S/.test(text[p.end - 1]) && /\S/.test(text[p.end] ?? " ")).toBe(false);
    }
  });

  it("cuts a run with no whitespace at the limit, without overlap", () => {
    const text = "x".repeat(3000);
    expect(splitForModel(text)).toEqual([
      { start: 0, end: 1200 },
      { start: 1200, end: 2400 },
      { start: 2400, end: 3000 },
    ]);
  });
});
