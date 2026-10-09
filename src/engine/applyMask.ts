import type { Entity, Key } from "./Masker.ts";

export function applyMask(text: string, entities: Entity[], wordList: string[]): { masked: string; key: Key } {
  const active = entities.filter((e) => e.active);
  const cuts = active
    .flatMap((e) => e.occurrences.map((o) => ({ start: o.start, end: o.end, placeholder: e.placeholder })))
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
      entries: active.map((e) => ({ placeholder: e.placeholder, value: e.value, type: e.type })),
      wordList: [...wordList],
      createdAt: new Date().toISOString(),
      app: "skrubba",
      version: 1,
    },
  };
}
