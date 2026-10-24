// Tidies text pasted into Din text. Text copied from a PDF has a hard line
// break at the end of every printed line and hidden characters that can split
// a name so the model misses it. Runs in the browser like everything else.

const LIGATURES: Record<string, string> = { ﬀ: "ff", ﬁ: "fi", ﬂ: "fl", ﬃ: "ffi", ﬄ: "ffl", ﬅ: "st", ﬆ: "st" };

/** A line that starts a numbered or bulleted item: "2. Bakgrund", "a) ...", "- mjölk". */
const LIST_ITEM = /^(?:\d+[.)]|\p{Ll}\)|[-–•*·])\s/u;
const ENDS_SENTENCE = /[.:;!?]$/;
const STARTS_LOWERCASE = /^\p{Ll}/u;
const WORD_START = /^[\p{L}\p{N}]/u;
const SPLIT_WORD = /(\p{L})-$/u;
/** A printed line wrapped by the PDF is near the full width; a heading or an address line is not. */
const LONG_LINE = { min: 40, ofLongest: 0.6 };

/** Characters that look like nothing, or like a space, in a PDF copy. */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/(?<![ \t])[ \t]+$/gm, ""); // the lookbehind keeps a long run of spaces linear
}

type Join = " " | "" | "-" | null;

/** How to join line `a` to line `b`: with a space, directly, keeping the hyphen, or not at all. */
function joinOf(a: string, b: string, long: number): Join {
  if (!a.trim() || !b.trim() || LIST_ITEM.test(b)) return null;
  const split = SPLIT_WORD.exec(a);
  if (split && STARTS_LOWERCASE.test(b)) return STARTS_LOWERCASE.test(split[1]) ? "" : "-";
  if (STARTS_LOWERCASE.test(b)) return " ";
  if (!ENDS_SENTENCE.test(a) && a.length >= long && WORD_START.test(b)) return " ";
  return null;
}

/**
 * Clean pasted text. Hidden characters are always fixed. Lines are joined only
 * when the text looks wrapped: at least two breaks fall mid-sentence, and they
 * are at least a third of all single line breaks. Blank lines, headings and
 * list items stay as they are. `unjoined` is the cleaned text with its line
 * breaks still in, for Ångra: the raw paste may have Windows line breaks,
 * which the textarea drops, so the highlights would sit off by one per line.
 */
export function cleanPaste(raw: string): { text: string; joined: boolean; unjoined?: string } {
  const text = normalise(raw);
  const lines = text.split("\n");
  const long = Math.max(LONG_LINE.min, LONG_LINE.ofLongest * lines.reduce((m, l) => Math.max(m, l.length), 0));
  const joins = lines.slice(1).map((b, i) => joinOf(lines[i], b, long));
  const breaks = lines.slice(1).filter((b, i) => lines[i].trim() && b.trim()).length;
  const count = joins.filter((j) => j !== null).length;
  if (count < 2 || count * 3 < breaks) return { text, joined: false };

  let out = lines[0];
  joins.forEach((join, i) => {
    const next = lines[i + 1];
    if (join === null) out += "\n" + next;
    else if (join === "") out = out.slice(0, -1) + next;
    else if (join === "-") out += next;
    else out += " " + next.trimStart();
  });
  return { text: out, joined: true, unjoined: text };
}
