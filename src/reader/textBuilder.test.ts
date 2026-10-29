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
    const timed = (n: number) => {
      const rows = Array.from({ length: n }, () => ["Anna Berg", "850412-1234", "Umeå"]);
      const started = performance.now();
      expect(table(rows).toString().split("\n")).toHaveLength(n);
      return performance.now() - started;
    };
    timed(10_000); // warm the JIT, or a cold big run inflates the ratio on a slow CI runner
    const big = Math.min(timed(100_000), timed(100_000)); // the best run, free of a GC pause
    const small = [timed(10_000), timed(10_000), timed(10_000)].sort((a, b) => a - b)[1];
    // Ten times the rows should take about ten times as long; stripping the
    // row's last tab once rescanned the text, which made it a hundred times.
    expect(big / small).toBeLessThan(40);
  });
});
