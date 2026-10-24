// Collects a document's text: paragraphs as lines, table cells separated by
// tabs, one table row per line. A cell's own paragraphs are joined by spaces
// so a row stays on one line.
/** Spaces and tabs at the end of a line. The lookbehind starts a match only at the run's first blank, so a line of 100 000 spaces is one pass, not a quadratic one. */
export const TRAILING_BLANKS = /(?<![ \t])[ \t]+$/gm;

export class TextBuilder {
  private parts: string[] = [""];

  add(s: string): void {
    this.parts[this.parts.length - 1] += s;
  }

  openCell(): void {
    this.parts.push("");
  }

  closeCell(): void {
    if (this.parts.length === 1) {
      this.add("\t");
      return;
    }
    const cell = this.parts.pop() ?? "";
    this.add(`${cell.trim().replace(/\s*\n\s*/g, " ")}\t`);
  }

  closeRow(): void {
    const last = this.parts.length - 1;
    this.parts[last] = `${this.parts[last].replace(/\t$/, "")}\n`;
  }

  toString(): string {
    return this.parts
      .join("")
      .replace(TRAILING_BLANKS, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
