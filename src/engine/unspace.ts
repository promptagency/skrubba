// Text where a PDF or OCR left a space between every letter ("A n d e r s
// E k s t r ö m"). The model sees single letters and finds nothing, so it is
// given the text with those spaces removed, and its spans are mapped back.

/** Three or more single letters with one space between each, as a whole word. */
const SPACED_RUN = /(?<![\p{L}\p{N}])\p{L}(?: \p{L}){2,}(?![\p{L}\p{N}])/gu;

export interface Unspaced {
  text: string;
  /** Original offset of each character in `text`, plus one past the end. */
  back: number[];
}

export function unspace(original: string): Unspaced {
  const back: number[] = [];
  let text = "";
  let cursor = 0;
  for (const m of original.matchAll(SPACED_RUN)) {
    for (let i = cursor; i < m.index; i++) back.push(i);
    text += original.slice(cursor, m.index);
    for (let i = 0; i < m[0].length; i++) {
      if (m[0][i] === " ") continue;
      back.push(m.index + i);
      text += m[0][i];
    }
    cursor = m.index + m[0].length;
  }
  for (let i = cursor; i < original.length; i++) back.push(i);
  text += original.slice(cursor);
  back.push(original.length);
  return { text, back };
}

/** A span's offsets in the original text. */
export function mapBack(span: { start: number; end: number }, back: number[]): { start: number; end: number } {
  return { start: back[span.start], end: back[span.end - 1] + 1 };
}
