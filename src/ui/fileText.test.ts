import { describe, expect, it } from "vitest";
import { preview, statsLine } from "./fileText.ts";

const result = (format: "pdf" | "docx" | "pptx" | "xlsx", stats: object) =>
  ({ kind: "text", text: "", format, stats, notes: [] }) as Parameters<typeof statsLine>[0];

describe("statsLine", () => {
  it("names the type and counts words with a Swedish thousands space", () => {
    expect(statsLine(result("docx", { words: 1240 }))).toBe("Word · 1 240 ord");
  });

  it("puts pages before words", () => {
    expect(statsLine(result("pdf", { words: 4300, pages: 12 }))).toBe("PDF · 12 sidor · 4 300 ord");
    expect(statsLine(result("pdf", { words: 3, pages: 1 }))).toBe("PDF · 1 sida · 3 ord");
  });

  it("counts slides and sheets", () => {
    expect(statsLine(result("pptx", { words: 9, slides: 1 }))).toBe("PowerPoint · 1 bild · 9 ord");
    expect(statsLine(result("xlsx", { words: 9, sheets: 2 }))).toBe("Excel · 2 blad · 9 ord");
  });
});

describe("preview", () => {
  it("shows a short text whole", () => {
    expect(preview("Anna Berg")).toBe("Anna Berg");
  });

  it("cuts a long text at a word and marks the cut", () => {
    const text = `${"ord ".repeat(300)}slut`;
    const shown = preview(text);
    expect(shown.length).toBeLessThanOrEqual(1002);
    expect(shown.endsWith("ord …")).toBe(true);
  });
});
