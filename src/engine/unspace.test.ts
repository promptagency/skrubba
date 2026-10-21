import { describe, expect, it } from "vitest";
import { mapBack, unspace } from "./unspace.ts";

describe("unspace", () => {
  it("removes the spaces inside letter-spaced words and maps spans back", () => {
    const original = "Avtal: A n d e r s  E k s t r ö m skrev under.";
    const { text, back } = unspace(original);
    // The two spaces between the words stay: they are the word break.
    expect(text).toBe("Avtal: Anders  Ekström skrev under.");
    const found = { start: text.indexOf("Anders"), end: text.indexOf("Ekström") + "Ekström".length };
    const span = mapBack(found, back);
    expect(original.slice(span.start, span.end)).toBe("A n d e r s  E k s t r ö m");
  });

  it("leaves ordinary text alone, offsets included", () => {
    const original = "Anna Berg, i Umeå, tel 070-1 2 3.";
    const { text, back } = unspace(original);
    expect(text).toBe(original);
    expect(mapBack({ start: 5, end: 9 }, back)).toEqual({ start: 5, end: 9 });
  });

  it("maps a span at the very end of the text", () => {
    const original = "Hej K a r i n";
    const { text, back } = unspace(original);
    expect(mapBack({ start: 4, end: text.length }, back)).toEqual({ start: 4, end: original.length });
  });
});
