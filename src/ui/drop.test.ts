import { describe, expect, it } from "vitest";
import { isTextFile } from "./drop.ts";

describe("isTextFile", () => {
  it.each([
    ["brev.txt", "text/plain"],
    ["anteckningar.md", "text/markdown"],
    ["ANTECKNINGAR.MD", ""],
    ["utan-typ.txt", ""],
  ])("accepts %s (%s)", (name, type) => {
    expect(isTextFile({ name, type })).toBe(true);
  });

  it.each([
    ["avtal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["avtal.pdf", "application/pdf"],
    ["bild.png", "image/png"],
    ["data.csv", "text/csv"],
    ["sida.html", "text/html"],
    ["text.txt.exe", "application/octet-stream"],
  ])("refuses %s (%s)", (name, type) => {
    expect(isTextFile({ name, type })).toBe(false);
  });
});
