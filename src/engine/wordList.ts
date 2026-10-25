import type { Source, Span } from "./Masker.ts";

export function parseWordList(raw: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const line of raw.split("\n")) {
    const term = line.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms;
}

const COMPOUND_MIN = 4;
const WORD_END = /(?::?s)?(?![\p{L}\p{N}])/uy;

/**
 * Whether text[start, end) is a proper noun that a longer word starts with:
 * capitalised, four characters or more, and followed by a lowercase letter.
 * Used for values the model found: shorter or lowercase ones would hit
 * ordinary words ("Anna" in "annan").
 */
export function startsCompound(text: string, start: number, end: number): boolean {
  return end - start >= COMPOUND_MIN && /^\p{Lu}/u.test(text[start] ?? "") && /^\p{Ll}/u.test(text[end] ?? "");
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole word, case-insensitive. A trailing genitive "s" or ":s" may follow the
// term; it stays outside the span so the output reads "[ORD_1]s". A term of
// four characters or more that starts a longer word, in any case
// ("Fenixlanseringen", "fenixlanseringen", "Sommarglödens"), is masked too, as
// "[ORD_1]lanseringen". The user chose the term, so a hit in an ordinary word
// ("Anna" in "annan") is an over-mask they can keep.
export function findTerms(text: string, terms: string[], source: Extract<Source, "manual" | "wordlist">): Span[] {
  const sorted = [...terms].filter((t) => t.trim()).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [];
  const typed = new Map(sorted.map((t) => [t.trim().toLowerCase(), t.trim()]));
  const alternatives = sorted.map((t) => escapeRegExp(t.trim())).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?=(?::?s)?(?![\\p{L}\\p{N}])|\\p{L})`, "giu");
  const spans: Span[] = [];
  for (const m of text.matchAll(re)) {
    const start = m.index;
    const end = start + m[1].length;
    WORD_END.lastIndex = end;
    if (!WORD_END.test(text) && !(end - start >= COMPOUND_MIN && /^\p{L}/u.test(text[end] ?? ""))) continue;
    spans.push({ start, end, type: "ORD", source, term: typed.get(m[1].toLowerCase()) ?? m[1] });
  }
  // The words of a multi-word term where they start a longer word, never bare.
  // The head ("Aurora" of "Aurora X") only hyphenated ("Aurora-lanseringen"),
  // since it is often an ordinary word: "Projekt Fenix" must not take
  // "projektledaren". The last word ("Havsvind" of "Projekt Havsvind") is the
  // distinctive one, so hyphenated or glued on ("Havsvind-teamet",
  // "Havsvindsteamet"). Each is an entity of its own, so restore writes the
  // compound back as it was.
  for (const term of sorted) {
    const words = term.trim().split(/\s+/);
    if (words.length < 2) continue;
    const parts: Array<[string, string]> = [[words[0], String.raw`-\p{Ll}`], [words.at(-1)!, String.raw`-\p{Ll}|\p{L}`]];
    for (const [word, after] of parts) {
      if (word.length < COMPOUND_MIN) continue;
      for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?=${after})`, "giu")))
        if (!spans.some((s) => s.start <= m.index && m.index < s.end))
          spans.push({ start: m.index, end: m.index + word.length, type: "ORD", source, term: word });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
