// Long texts go to the model in parts, so the masker can say how far it has
// come. Parts stay below the length at which maskera splits on its own (480
// KB-BERT tokens), so the model sees the same kind of chunks as before. A
// part ends at a paragraph break, else a sentence end, else between words;
// a cut between words could split a name, so the next part then starts a
// little earlier and the overlap is read twice.

export const PART_CHARS = 1200;
export const OVERLAP_CHARS = 200;
/** A cut is looked for in the last 40 % of a part, so parts stay reasonably long. */
const SEARCH_FROM = Math.floor(PART_CHARS * 0.6);

export interface Part {
  start: number;
  end: number;
}

/** The end of the last match of `re` in `window` that ends at or after `from`, or -1. */
function lastEnd(window: string, re: RegExp, from: number): number {
  let end = -1;
  for (const m of window.matchAll(re)) {
    const e = (m.index ?? 0) + m[0].length;
    if (e >= from) end = e;
  }
  return end;
}

export function splitForModel(text: string): Part[] {
  const parts: Part[] = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= PART_CHARS) {
      parts.push({ start, end: text.length });
      break;
    }
    const window = text.slice(start, start + PART_CHARS);
    let cut = lastEnd(window, /\n\s*\n/g, SEARCH_FROM);
    if (cut < 0) cut = lastEnd(window, /[.!?]\s+/g, SEARCH_FROM);
    let overlap = false;
    if (cut < 0) {
      cut = lastEnd(window, /\s+/g, 1);
      overlap = cut > 0;
    }
    if (cut <= 0) cut = PART_CHARS;
    const end = start + cut;
    parts.push({ start, end });
    if (!overlap) {
      start = end;
      continue;
    }
    // Start the next part up to OVERLAP_CHARS earlier, at the start of a word.
    const from = Math.max(start + 1, end - OVERLAP_CHARS);
    const gap = text.slice(from, end).search(/\s\S/);
    start = gap >= 0 ? from + gap + 1 : end;
  }
  return parts;
}
