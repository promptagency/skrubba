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

function escapeRegExp(s: string): string {
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
  return spans;
}
