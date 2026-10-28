import type { Entity } from "../engine/index.ts";

export interface MaybeMissed {
  value: string;
  count: number;
}

/** Capitalised words that are not a name but often start a sentence or stand alone in one. */
const COMMON = new Set(
  (
    "jag du han hon hen vi ni de dem den det min din vår er hans hennes deras sin " +
    "och men att som om när här där nu så ja nej hej tack med för till på av hos i " +
    "måndag tisdag onsdag torsdag fredag lördag söndag " +
    "januari februari mars april maj juni juli augusti september oktober november december"
  ).split(" "),
);

const WORD = /\p{Lu}[\p{L}\p{M}'’-]*/gu;
/** Looked past, backwards, when deciding whether a word starts a sentence: space, quotes, brackets, list markers. */
const SKIPPED = /[\s"'”“„«»()[\]\-–•*]/;

function startsSentence(text: string, at: number): boolean {
  let i = at - 1;
  while (i >= 0 && SKIPPED.test(text[i])) i--;
  return i < 0 || /[.!?:;\n]/.test(text[i]);
}

/**
 * Capitalised words the detection left unmasked, for the user to look over.
 * Neighbouring words join into one row ("Volvo Personvagnar"). A lone word at
 * the start of a sentence counts only if the same word also stands mid-sentence,
 * since every ordinary word is capitalised there too. shortcut: a name that only
 * ever opens a sentence is missed, loosen if users report it.
 */
export function maybeMissed(text: string, entities: Entity[]): MaybeMissed[] {
  const covered = entities.flatMap((e) => e.occurrences);
  const isCovered = (start: number, end: number) => covered.some((o) => o.start < end && o.end > start);
  const isCandidate = (w: RegExpExecArray) =>
    !COMMON.has(w[0].toLowerCase()) && !(w[0].length > 1 && w[0] === w[0].toUpperCase()) && !isCovered(w.index, w.index + w[0].length);

  const counts = new Map<string, number>();
  const midSentence = new Set<string>();
  const words = [...text.matchAll(WORD)];
  for (let i = 0; i < words.length; ) {
    if (!isCandidate(words[i])) {
      i++;
      continue;
    }
    const start = words[i].index;
    let end = start + words[i][0].length;
    let j = i + 1;
    // Join the next word while it is a candidate and only one space away.
    while (j < words.length && words[j].index === end + 1 && text[end] === " " && isCandidate(words[j])) {
      end = words[j].index + words[j][0].length;
      j++;
    }
    const run = text.slice(start, end);
    if (j > i + 1 || !startsSentence(text, start)) midSentence.add(run);
    counts.set(run, (counts.get(run) ?? 0) + 1);
    i = j;
  }
  return [...counts].filter(([value]) => midSentence.has(value)).map(([value, count]) => ({ value, count }));
}
