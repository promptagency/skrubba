// The one interface the app talks to. Nothing outside src/engine/ imports
// maskera or transformers.js; see docs/ARCHITECTURE.md.

/**
 * maskera's labels verbatim, so placeholders match its format, plus ORD
 * (manual selection or word list) and FÖRNAMN: a first name standing alone
 * for a full name in the text, numbered like that name ([FÖRNAMN_1] is the
 * first name of [NAMN_1]), so restore writes back the form that was there.
 */
export const ENTITY_TYPES = [
  "NAMN",
  "FÖRNAMN",
  "PLATS",
  "ORGANISATION",
  "ADRESS",
  "PERSONNUMMER",
  "SAMORDNINGSNUMMER",
  "ORGANISATIONSNUMMER",
  "TELEFON",
  "EPOST",
  "POSTNUMMER",
  "LAGENHETSNUMMER",
  "BANKGIRO",
  "PLUSGIRO",
  "IBAN",
  "KORTNUMMER",
  "KONTONUMMER",
  "IP_ADRESS",
  "URL",
  "JOURNALNUMMER",
  "REFERENSNUMMER",
  "REGNUMMER",
  "ORD",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type Source = "manual" | "wordlist" | "rule" | "model";

/** One detected stretch of text, before it is grouped into entities. */
export interface Span {
  start: number;
  end: number;
  type: EntityType;
  source: Source;
  /** For manual and word-list spans: the term as the user typed it. */
  term?: string;
}

export interface Occurrence {
  start: number;
  end: number;
  surface: string;
  /** A first name linked to the entity's full name. Masked as [FÖRNAMN_n]. */
  firstName?: boolean;
}

export interface Entity {
  id: string; // stable within session
  value: string; // canonical surface form, what restore writes back
  type: EntityType;
  placeholder: string; // "[NAMN_1]"
  occurrences: Occurrence[];
  active: boolean; // false = Behåll
  source: Source;
}

export interface KeyEntry {
  placeholder: string;
  value: string;
  type: EntityType;
}

export interface Key {
  entries: KeyEntry[];
  wordList: string[];
  createdAt: string;
  app: "skrubba";
  version: 1;
}

export interface MaskInput {
  wordList: string[];
  /** Terms the user selected by hand. Highest priority. */
  manual: string[];
}

export interface RestoredSpan {
  /** Offsets in the restored text. */
  start: number;
  end: number;
  placeholder: string;
  value: string;
}

export interface Suggestion {
  /** Offsets in the input text. */
  start: number;
  end: number;
  found: string;
  placeholder: string;
  value: string;
}

export interface UnknownPlaceholder {
  start: number;
  end: number;
  found: string;
}

export interface RestoreResult {
  text: string;
  restored: RestoredSpan[];
  suggestions: Suggestion[];
  unknown: UnknownPlaceholder[];
}

export interface Progress {
  loaded: number;
  total: number;
}

export interface InitOptions {
  /** Let transformers.js keep its own copy of the model. Off when the service worker caches it. */
  browserCache: boolean;
}

export interface MaskOptions {
  /**
   * How far the model has read, in characters. Called at once with the run's
   * current progress, then after each part. A caller that joins a run already
   * under way gets its progress from there on.
   */
  onProgress?(done: number, total: number): void;
}

export interface Masker {
  /** Loads the NER model. Rejects if it cannot; rules keep working. */
  init(onProgress: (p: Progress) => void, options?: InitOptions): Promise<void>;
  /** Rules, context rules, word list and manual terms. Sync, instant. */
  maskRules(text: string, input: MaskInput): Entity[];
  /**
   * maskRules plus NER, merged. The model runs once per text: a call for the
   * same text joins the run, and a call for a new text stops the old run,
   * whose promise then rejects with an AbortError.
   */
  mask(text: string, input: MaskInput, opts?: MaskOptions): Promise<Entity[]>;
  applyMask(text: string, entities: Entity[], wordList: string[]): { masked: string; key: Key };
  /** Start over from an uploaded key: its placeholders are reused, new ones numbered after them. */
  loadKey(key: Key): void;
  /** Forget all numbering (Rensa allt, and Ny text in Skrubba). */
  reset(): void;
  /** `accepted` lists `found` strings of suggestions the user confirmed. */
  restore(text: string, key: Key, accepted?: ReadonlySet<string>): RestoreResult;
}
