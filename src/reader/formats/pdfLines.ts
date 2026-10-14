// pdf.js gives a page's text as positioned pieces. This puts them back into
// lines: top to bottom, left to right, with a space where the gap between two
// pieces is wider than a quarter of the font size.

export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pageText(items: PdfItem[]): string {
  const lines: PdfItem[][] = [];
  const sorted = items.filter((i) => i.str !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - item.y) <= Math.max(line[0].height, item.height, 1) / 2) line.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let prev: PdfItem | null = null;
      for (const item of line) {
        if (prev) {
          const gap = item.x - (prev.x + prev.width);
          if (gap > Math.max(prev.height, 1) / 4 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += " ";
        }
        out += item.str;
        prev = item;
      }
      return out.trim();
    })
    .filter(Boolean)
    .join("\n");
}
