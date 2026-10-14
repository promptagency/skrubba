import { describe, expect, it } from "vitest";
import { type PdfItem, pageText } from "./pdfLines.ts";

const item = (str: string, x: number, y: number, width = str.length * 6, height = 12): PdfItem => ({ str, x, y, width, height });

describe("pageText", () => {
  it("orders lines top to bottom and items left to right", () => {
    expect(pageText([item("Umeå", 72, 700), item("Berg", 100, 720), item("Anna", 72, 720)])).toBe("Anna Berg\nUmeå");
  });

  it("puts a space only where the gap is wider than a quarter of the font size", () => {
    expect(pageText([item("Ber", 72, 720), item("g", 90.5, 720)])).toBe("Berg");
    expect(pageText([item("Anna", 72, 720), item("Berg", 100, 720)])).toBe("Anna Berg");
  });

  it("keeps items a little off the baseline on the same line", () => {
    expect(pageText([item("Anna", 72, 720), item("Berg", 100, 718)])).toBe("Anna Berg");
  });

  it("does not double a space the items already have", () => {
    expect(pageText([item("Anna ", 72, 720), item("Berg", 110, 720)])).toBe("Anna Berg");
  });

  it("skips empty items", () => {
    expect(pageText([item("", 72, 740, 0), item("Anna", 72, 720)])).toBe("Anna");
  });
});
