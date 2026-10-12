import { ENTITY_TYPES, type EntityType, type Key, type KeyEntry } from "./Masker.ts";

const PLACEHOLDER = /^\[([A-ZÅÄÖ_]+)_([1-9]\d*)\]$/;
const isString = (x: unknown): x is string => typeof x === "string";

/**
 * Read a key file the user uploads. Anything that is not exactly a Skrubba
 * key is rejected (null), so a wrong file can never restore wrong values.
 */
export function parseKey(raw: string): Key | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const k = data as Record<string, unknown>;
  if (k.app !== "skrubba" || k.version !== 1 || !isString(k.createdAt)) return null;
  if (!Array.isArray(k.wordList) || !k.wordList.every(isString)) return null;
  if (!Array.isArray(k.entries)) return null;

  const entries: KeyEntry[] = [];
  const seen = new Set<string>();
  for (const e of k.entries as unknown[]) {
    if (typeof e !== "object" || e === null) return null;
    const { placeholder, value, type } = e as Record<string, unknown>;
    if (!isString(placeholder) || !isString(value) || !isString(type)) return null;
    const m = PLACEHOLDER.exec(placeholder);
    if (!m || m[1] !== type || !ENTITY_TYPES.includes(type as EntityType) || seen.has(placeholder)) return null;
    seen.add(placeholder);
    entries.push({ placeholder, value, type: type as EntityType });
  }
  return { entries, wordList: [...k.wordList], createdAt: k.createdAt, app: "skrubba", version: 1 };
}

/** Entries of a key built up over several copies. A placeholder keeps its first value. */
export function mergeEntries(existing: KeyEntry[], add: KeyEntry[]): KeyEntry[] {
  const out = [...existing];
  const have = new Set(existing.map((e) => e.placeholder));
  for (const e of add) {
    if (have.has(e.placeholder)) continue;
    have.add(e.placeholder);
    out.push(e);
  }
  return out;
}

export function keyFileName(date: Date): string {
  return `skrubba-kodnyckel-${date.toISOString().slice(0, 10)}.json`;
}
