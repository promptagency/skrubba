// Collects a document's text: paragraphs as lines, table cells separated by
// tabs, one table row per line. A cell's own paragraphs are joined by spaces
// so a row stays on one line.
/** Spaces and tabs at the end of a line. The lookbehind starts a match only at the run's first blank, so a line of 100 000 spaces is one pass, not a quadratic one. */
export const TRAILING_BLANKS = /(?<![ \t])[ \t]+$/gm;

/** A text with no blanks at line ends, at most one blank line in a row, and none at either end. */
export const tidy = (s: string) => s.replace(TRAILING_BLANKS, "").replace(/\n{3,}/g, "\n\n").trim();

export class TextBuilder {
  private parts: string[] = [""];
  /** Cells closed so far in the current row, per nesting level of `parts`. */
  private cells: number[] = [0];

  add(s: string): void {
    this.parts[this.parts.length - 1] += s;
  }

  openCell(): void {
    this.parts.push("");
    this.cells.push(0);
  }

  closeCell(): void {
    if (this.parts.length === 1) return;
    const cell = this.parts.pop() ?? "";
    this.cells.pop();
    // The tab goes before every cell but the row's first, so a row never ends
    // in a tab to strip: rescanning the text at every row was quadratic.
    const top = this.cells.length - 1;
    this.add(`${this.cells[top]++ ? "\t" : ""}${cell.trim().replace(/\s*\n\s*/g, " ")}`);
  }

  closeRow(): void {
    this.add("\n");
    this.cells[this.cells.length - 1] = 0;
  }

  toString(): string {
    return tidy(this.parts.join(""));
  }
}
