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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole word, case-insensitive. A trailing genitive "s" or ":s" may follow the
// term; it stays outside the span so the output reads "[ORD_1]s".
export function findTerms(text: string, terms: string[], source: Extract<Source, "manual" | "wordlist">): Span[] {
  const sorted = [...terms].filter((t) => t.trim()).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [];
  const alternatives = sorted.map((t) => escapeRegExp(t.trim())).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?=(?::?s)?(?![\\p{L}\\p{N}]))`, "giu");
  const spans: Span[] = [];
  for (const m of text.matchAll(re)) {
    const start = m.index;
    spans.push({ start, end: start + m[1].length, type: "ORD", source });
  }
  return spans;
}
