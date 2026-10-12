import { firstNamePlaceholder, placeholderOf } from "./entities.ts";
import type { Entity, Key, KeyEntry } from "./Masker.ts";

export function applyMask(text: string, entities: Entity[], wordList: string[]): { masked: string; key: Key } {
  const active = entities.filter((e) => e.active);
  const cuts = active
    .flatMap((e) => e.occurrences.map((o) => ({ start: o.start, end: o.end, placeholder: placeholderOf(e, o) })))
    .sort((a, b) => a.start - b.start);
  let masked = "";
  let cursor = 0;
  for (const c of cuts) {
    masked += text.slice(cursor, c.start) + c.placeholder;
    cursor = c.end;
  }
  masked += text.slice(cursor);
  return {
    masked,
    key: {
      entries: active.flatMap(keyEntries),
      wordList: [...wordList],
      createdAt: new Date().toISOString(),
      app: "skrubba",
      version: 1,
    },
  };
}

/** The entity's row, plus a [FÖRNAMN_n] row when its first name stands alone somewhere. */
function keyEntries(e: Entity): KeyEntry[] {
  const entry: KeyEntry = { placeholder: e.placeholder, value: e.value, type: e.type };
  if (!e.occurrences.some((o) => o.firstName)) return [entry];
  const firstName = e.value.split(/\s+/)[0];
  return [entry, { placeholder: firstNamePlaceholder(e.placeholder), value: firstName, type: "FÖRNAMN" }];
}
