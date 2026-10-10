import type { Entity } from "../engine/index.ts";

export interface Mark<T> {
  start: number;
  end: number;
  data: T;
}

export interface Segment<T> {
  text: string;
  start: number;
  data?: T;
}

/** Text cut into plain and marked runs, for a highlight layer behind a textarea. */
export function segments<T>(text: string, marks: Mark<T>[]): Segment<T>[] {
  const sorted = [...marks].sort((a, b) => a.start - b.start);
  const out: Segment<T>[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.start < cursor) continue;
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), start: cursor });
    out.push({ text: text.slice(m.start, m.end), start: m.start, data: m.data });
    cursor = m.end;
  }
  if (cursor < text.length || out.length === 0) out.push({ text: text.slice(cursor), start: cursor });
  return out;
}

export function entityMarks(entities: Entity[]): Mark<Entity>[] {
  return entities.flatMap((entity) => entity.occurrences.map((o) => ({ start: o.start, end: o.end, data: entity })));
}

/** The entity with an occurrence overlapping [start, end], or containing a caret at start. */
export function entityAt(entities: Entity[], start: number, end: number): Entity | undefined {
  return entities.find((e) =>
    e.occurrences.some((o) => (start === end ? o.start <= start && start <= o.end : o.start < end && o.end > start)),
  );
}
