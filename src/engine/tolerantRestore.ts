import {
  ENTITY_TYPES,
  type EntityType,
  type Key,
  type RestoredSpan,
  type RestoreResult,
  type Suggestion,
  type UnknownPlaceholder,
} from "./Masker.ts";

const TYPES: readonly EntityType[] = ENTITY_TYPES;

// Translated or reworded type names an LLM tends to produce. Short words that
// occur in ordinary text ("per", "tel", "ort") are left out on purpose.
const ALIASES: Record<string, EntityType> = {
  NAME: "NAMN",
  PERSON: "NAMN",
  FORNAMN: "FÖRNAMN",
  FIRSTNAME: "FÖRNAMN",
  FIRST_NAME: "FÖRNAMN",
  PLACE: "PLATS",
  LOCATION: "PLATS",
  CITY: "PLATS",
  ORGANIZATION: "ORGANISATION",
  COMPANY: "ORGANISATION",
  FÖRETAG: "ORGANISATION",
  ADDRESS: "ADRESS",
  EMAIL: "EPOST",
  "E-POST": "EPOST",
  PHONE: "TELEFON",
  SSN: "PERSONNUMMER",
  ORGNR: "ORGANISATIONSNUMMER",
  WORD: "ORD",
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const typeWords = [...TYPES, ...Object.keys(ALIASES)].sort((a, b) => b.length - a.length).map(escapeRegExp);

// Brackets and backticks are consumed; quotes are not (they belong to the prose).
const CANDIDATE = new RegExp(
  `(?<![\\p{L}\\p{N}_])([\\[\`]*)(${typeWords.join("|")})([_ -]?)(\\d+)(:?s)?(?![\\p{L}\\p{N}_])([\\]\`]*)`,
  "giu",
);

function genitive(value: string): string {
  return /[sxz]$/i.test(value) ? value : `${value}s`;
}

/**
 * Put real values back into an LLM answer. Exact placeholders, with or without
 * brackets and in any case, are restored silently. Other separators, leading
 * zeros, inflections and translated type names become suggestions the user
 * confirms (pass their `found` in `accepted`). Numbers not in the key are
 * reported and never guessed. See docs/ARCHITECTURE.md.
 */
export function tolerantRestore(text: string, key: Key, accepted: ReadonlySet<string> = new Set()): RestoreResult {
  const values = new Map(key.entries.map((e) => [e.placeholder, e.value]));
  const restored: RestoredSpan[] = [];
  const suggestions: Suggestion[] = [];
  const unknown: UnknownPlaceholder[] = [];
  let out = "";
  let cursor = 0;

  for (const m of text.matchAll(CANDIDATE)) {
    const [found, , rawType, sep, digits, suffix] = m;
    const start = m.index;
    const end = start + found.length;
    const upper = rawType.toUpperCase();
    const canonical = TYPES.includes(upper as EntityType);
    const type = canonical ? (upper as EntityType) : ALIASES[upper];
    const placeholder = `[${type}_${Number(digits)}]`;
    const value = values.get(placeholder);

    if (value === undefined) {
      unknown.push({ start, end, found });
      continue;
    }
    const exact = canonical && sep === "_" && !digits.startsWith("0") && !suffix;
    if (!exact && !accepted.has(found)) {
      suggestions.push({ start, end, found, placeholder, value });
      continue;
    }
    const replacement = suffix ? genitive(value) : value;
    out += text.slice(cursor, start);
    restored.push({ start: out.length, end: out.length + replacement.length, placeholder, value });
    out += replacement;
    cursor = end;
  }
  out += text.slice(cursor);
  return { text: out, restored, suggestions, unknown };
}
