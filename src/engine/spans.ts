import { COMPANY_FORM, DATE } from "./contextRules.ts";
import type { Source, Span } from "./Masker.ts";
import { KNOWN_ORGANISATIONS } from "./organisations.ts";
import { startsCompound } from "./wordList.ts";

const PRIORITY: Record<Source, number> = { manual: 0, wordlist: 1, rule: 2, model: 3 };
const WORD_CHAR = /[\p{L}\p{N}]/u;
const JOIN_GAP = /^[ '’]$/u;
const ONLY_COMPANY_FORM = new RegExp(`^${COMPANY_FORM}$`, "u");

/**
 * Turn spans from all sources into one non-overlapping list, sorted by start.
 *
 * Higher-priority spans claim their text first (manual > word list > rule >
 * model; within a source, earliest start then longest). A later span wholly
 * inside claimed text is dropped; one that partially overlaps is clipped to
 * its unclaimed parts, as maskera does, so the remainder is not leaked. A
 * remainder that is only a company form ("AB" after a claimed name) is
 * dropped, since it identifies no one, and so is a lowercase remainder glued
 * to the claimed text ("kampanjen" after a word-list "Nordljus"), which is the
 * rest of a compound word.
 * Finally, model spans separated only by a space or apostrophe are joined.
 */
export function resolveSpans(text: string, spans: Span[]): Span[] {
  const ordered = [...spans].sort(
    (a, b) => PRIORITY[a.source] - PRIORITY[b.source] || a.start - b.start || b.end - a.end,
  );
  const kept: Span[] = [];
  for (const span of ordered) {
    for (const [start, end] of unclaimed(span, kept)) {
      const trimmed = trim(text, start, end);
      if (!trimmed) continue;
      const wasClipped = trimmed[0] !== span.start || trimmed[1] !== span.end;
      if (wasClipped && trimmed[1] - trimmed[0] < 2) continue;
      // The worker already clips model spans against the rules, so the leftover
      // form arrives as a span of its own, unclipped.
      if ((wasClipped || span.source === "model") && ONLY_COMPANY_FORM.test(text.slice(trimmed[0], trimmed[1]))) continue;
      if ((wasClipped || span.source === "model") && isCompoundTail(text, trimmed[0])) continue;
      kept.push({ ...span, start: trimmed[0], end: trimmed[1] });
    }
  }
  kept.sort((a, b) => a.start - b.start);
  return joinModelSpans(text, kept);
}

function isCompoundTail(text: string, start: number): boolean {
  return /\p{L}/u.test(text[start - 1] ?? "") && /\p{Ll}/u.test(text[start] ?? "");
}

function unclaimed(span: Span, claimed: Span[]): Array<[number, number]> {
  const overlapping = claimed
    .filter((c) => c.start < span.end && c.end > span.start)
    .sort((a, b) => a.start - b.start);
  const parts: Array<[number, number]> = [];
  let cursor = span.start;
  for (const c of overlapping) {
    if (c.start > cursor) parts.push([cursor, c.start]);
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < span.end) parts.push([cursor, span.end]);
  return parts;
}

function trim(text: string, start: number, end: number): [number, number] | null {
  while (start < end && !WORD_CHAR.test(text[start] ?? "")) start++;
  while (end > start && !WORD_CHAR.test(text[end - 1] ?? "")) end--;
  return end > start ? [start, end] : null;
}

function joinModelSpans(text: string, spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.source === "model" &&
      span.source === "model" &&
      JOIN_GAP.test(text.slice(prev.end, span.start))
    ) {
      const type = prev.type === "ORGANISATION" || span.type === "ORGANISATION" ? "ORGANISATION" : prev.type;
      out[out.length - 1] = { ...prev, end: span.end, type };
      continue;
    }
    out.push(span);
  }
  return out;
}

const PROPER_NOUN = /^\p{Lu}/u;
// Companies and places start compounds ("Volvoavtalet", "Malmökontoret"). A
// person's name mostly does so in a street name ("Annagatan"), so not names.
const COMPOUND_TYPES: ReadonlySet<Span["type"]> = new Set(["ORGANISATION", "PLATS"]);
const HEAD_TYPES: ReadonlySet<Span["type"]> = new Set(["ORGANISATION", "PLATS", "ADRESS"]);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The model can find a name in one place and miss it in another, for example
 * "Norrström Media" in a sentence but not in "Norrström Media AB" in a header. Every
 * value the model found that looks like a proper noun (capital first letter,
 * three characters or more) is also marked wherever else it occurs as a whole
 * word, genitive included, or for a company or place at the start of a
compound word (see startsCompound). Line breaks inside a value match any whitespace.
 * Lowercase and short values are left alone so a stray hit does not spread.
 */
export function spreadModelValues(text: string, resolved: Span[]): Span[] {
  const values = new Map<string, Span["type"]>();
  for (const s of resolved) {
    const value = text.slice(s.start, s.end).replace(/\s+/g, " ");
    if (s.source === "model" && value.length >= 3 && PROPER_NOUN.test(value) && !values.has(value))
      values.set(value, s.type);
  }
  // "Volvoavtalet" found next to "Volvo" is a compound of it: spread "Volvo" only.
  const compounding = (v: string) => COMPOUND_TYPES.has(values.get(v) ?? "NAMN");
  for (const value of values.keys())
    if ([...values.keys()].some((v) => compounding(v) && value.startsWith(v) && startsCompound(value, 0, v.length)))
      values.delete(value);
  const spread: Span[] = [];
  // The head word of a multi-word company, place or address ("Zephyr" of
  // "Zephyr 2") where it starts a hyphenated word ("Zephyr-teamet"), never
  // bare or glued on: it could be any word ("Norra", "Byrå" in "byråchefen").
  for (const [value, type] of values) {
    const head = value.split(" ")[0];
    if (!value.includes(" ") || head.length < 4 || !HEAD_TYPES.has(type)) continue;
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escape(head)}(?=-\\p{Ll})`, "gu")))
      spread.push({ start: m.index, end: m.index + head.length, type, source: "model" });
  }
  for (const [value, type] of values) {
    const pattern = value.split(" ").map(escape).join("\\s+");
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?:(?::?s)?(?![\\p{L}\\p{N}])|(?=\\p{L}))`, "gu"))) {
      const end = m.index + m[0].length;
      if (/\p{L}/u.test(text[end] ?? "") && !(COMPOUND_TYPES.has(type) && startsCompound(text, m.index, end))) continue;
      spread.push({ start: m.index, end, type, source: "model" });
    }
  }
  return spread;
}

const stem = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/(?::s|s)$/u, "");

/**
 * Model NAMN spans that are a company: the model types a company it does not
 * know as a person now and then. A value is a company when the text has it
 * typed ORGANISATION elsewhere (by the model or a rule), when it is the first
 * word of a company name a rule found ("Fjällbris" next to "Fjällbris Konsult
 * AB"), or when it is a well-known company (KNOWN_ORGANISATIONS).
 */
export function retypeOrganisations(text: string, spans: Span[]): Span[] {
  const orgs = new Set<string>();
  for (const s of spans) {
    if (s.type !== "ORGANISATION") continue;
    const value = text.slice(s.start, s.end);
    orgs.add(stem(value));
    if (s.source === "rule" && value.includes(" ")) orgs.add(stem(value.slice(0, value.indexOf(" "))));
  }
  return spans.map((s) => {
    if (s.source !== "model" || s.type !== "NAMN") return s;
    const value = text.slice(s.start, s.end);
    const key = stem(value);
    const known = orgs.has(key) || orgs.has(value.toLowerCase()) || KNOWN_ORGANISATIONS.has(key) || KNOWN_ORGANISATIONS.has(value.toLowerCase());
    return known ? { ...s, type: "ORGANISATION" } : s;
  });
}

// A date right after a name, as in a list of people ("Anna Berg, 1987-03-14",
// "Anna Berg (*1987-03-14)"). Not when a time follows: that is a log line.
const DATE_AFTER_NAME = new RegExp(String.raw`^[ \t]*[,(]?[ \t]*\*?[ \t]*(${DATE})(?![\p{L}\p{N}])(?![ \t]*(?:kl\.?[ \t]*)?\d{1,2}[:.]\d{2})`, "iu");

/** FÖDELSEDATUM spans for a date that directly follows a NAMN span. */
export function birthDatesAfterNames(text: string, spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.type !== "NAMN") continue;
    const m = DATE_AFTER_NAME.exec(text.slice(s.end, s.end + 40));
    if (!m) continue;
    const start = s.end + m[0].length - m[1].length;
    out.push({ start, end: start + m[1].length, type: "FÖDELSEDATUM", source: "rule" });
  }
  return out;
}

// A dose or a quantity: "50 mg", "500 mg x 3", "2 st".
const DOSE = /\d\s?(?:mg|g|ml|mikrog|µg|mcg|st|tabl|x\s?\d)(?![\p{L}\p{N}])/iu;
const STREET = /(?:gata|gatan|väg|vägen|gränd|gränden|torg|torget|plan|allé|allén|stig|stigen|backe|backen|led|leden|ring|ringen|plats|platsen|kaj|kajen|esplanaden|promenaden|strand|stranden|väg\.|v\.|g\.)\s?\d/iu;

/**
 * The model's address detector fires on "word + number + unit", so a
 * medication ("Sertralin 50 mg") comes out as an address. Such a span is
 * dropped unless it has a street name's ending before the number.
 */
export function withoutDoseAddresses(text: string, spans: Span[]): Span[] {
  return spans.filter((s) => {
    if (s.source !== "model" || s.type !== "ADRESS") return true;
    const value = text.slice(s.start, s.end);
    return !DOSE.test(value) || STREET.test(value);
  });
}

const EDGE_TYPES = new Set(["NAMN", "ORGANISATION", "PLATS"]);
// Lowercase words that belong to a name, so they are not trimmed off.
const PARTICLE = /^(?:af|av|von|van|der|den|de|la|le|du|di|da)$/u;
// English words that start a sentence or greeting right before a name.
const OPENER = /^(?:hi|hello|dear|please|the|our|your|my|call|contact)$/iu;
const CAPITAL_WORD = /(?:^|\s)[\p{Lu}\p{N}]/u;
const ENGLISH_WORDS = /(?<!\p{L})(?:the|and|from|with|please|call|will|for|is|are|our|your|team|meeting|notes|on|at|to|of)(?!\p{L})/giu;
const SWEDISH_WORDS = /(?<!\p{L})(?:och|att|det|som|med|för|på|är|till|från|inte|jag|vi|den|en|ett|hon|han)(?!\p{L})/giu;

/** Whether the text reads as English rather than Swedish, by its function words. */
export function looksEnglish(text: string): boolean {
  return (text.match(ENGLISH_WORDS)?.length ?? 0) > (text.match(SWEDISH_WORDS)?.length ?? 0);
}

/**
 * In English text, model name, organisation and place spans without the plain
 * words the Swedish-trained model tacks on ("Please call Per Holm", "Fjällbris
 * joined the call"): the AI would lose those words. Lowercase words come off
 * both ends, and a few English openers also when capitalised. A span with no
 * capitalised word ("arla") stays whole, since the user may write names in
 * lowercase, and so does a lowercase name particle ("von", "de la"). A span of
 * plain words only ("Please call", which the model may split off the name) is
 * dropped, since resolveSpans would join it back onto the name. Swedish text
 * is left alone: there a lowercase word after a name is often a surname
 * ("kjell-olov bäckman" in a chat).
 */
export function trimEdgeWords(text: string, spans: Span[]): Span[] {
  if (!looksEnglish(text)) return spans;
  return spans.flatMap((s) => {
    if (s.source !== "model" || !EDGE_TYPES.has(s.type) || !CAPITAL_WORD.test(text.slice(s.start, s.end))) return [s];
    const words = text.slice(s.start, s.end).split(/(\s+)/);
    const plain = (w: string) => (/^\p{Ll}+$/u.test(w) && !PARTICLE.test(w)) || OPENER.test(w);
    let first = 0;
    let last = words.length - 1;
    while (first <= last && plain(words[first])) first += 2;
    while (first <= last && plain(words[last])) last -= 2;
    if (first > last) return [];
    const start = s.start + words.slice(0, first).join("").length;
    const end = s.end - words.slice(last + 1).join("").length;
    return [start === s.start && end === s.end ? s : { ...s, start, end }];
  });
}

/**
 * Model spans that cover a spread value plus a compound tail ("Volvoavtalet",
 * where "Volvo" was spread), so the value alone is masked: "[ORGANISATION_1]avtalet".
 */
export function withoutCompoundForms(text: string, spans: Span[], spread: Span[]): Span[] {
  return spans.filter(
    (s) =>
      s.source !== "model" ||
      !spread.some((p) => p.start === s.start && p.end < s.end && startsCompound(text, p.start, p.end)),
  );
}
