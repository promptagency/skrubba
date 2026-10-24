import { describe, expect, it } from "vitest";
import { TextBuilder } from "./textBuilder.ts";

function table(rows: string[][], out = new TextBuilder()): TextBuilder {
  for (const row of rows) {
    for (const cell of row) {
      out.openCell();
      out.add(cell);
      out.closeCell();
    }
    out.closeRow();
  }
  return out;
}

describe("TextBuilder", () => {
  it("puts one row per line with cells by tab, empty cells included, and joins a cell's paragraphs", () => {
    // A trailing empty cell leaves nothing: blanks at a line's end are always dropped.
    expect(table([["Namn", "", "Anna\nBerg"], ["Ort", "Umeå", ""]]).toString()).toBe("Namn\t\tAnna Berg\nOrt\tUmeå");
  });

  it("keeps a nested table inside a cell and still separates the outer cells", () => {
    const out = new TextBuilder();
    out.openCell();
    out.add("A");
    out.closeCell();
    out.openCell();
    table([["x", "y"]], out);
    out.closeCell();
    out.openCell();
    out.add("C");
    out.closeCell();
    out.closeRow();
    expect(out.toString()).toBe("A\tx\ty\tC");
  });

  it("builds a hundred thousand rows in linear time", () => {
    const rows = Array.from({ length: 100_000 }, () => ["Anna Berg", "850412-1234", "Umeå"]);
    const started = performance.now();
    expect(table(rows).toString().split("\n")).toHaveLength(100_000);
    expect(performance.now() - started).toBeLessThan(2000); // stripping the row's last tab rescanned the text: 20 000 rows took 3 s
  });
});
