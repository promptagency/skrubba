import type { Entity } from "../engine/index.ts";

export interface Segment {
  text: string;
  start: number;
  entity?: Entity;
}

/** Text cut into plain and highlighted runs, for the overlay behind the textarea. */
export function segments(text: string, entities: Entity[]): Segment[] {
  const marks = entities
    .flatMap((entity) => entity.occurrences.map((o) => ({ start: o.start, end: o.end, entity })))
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor) continue;
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), start: cursor });
    out.push({ text: text.slice(m.start, m.end), start: m.start, entity: m.entity });
    cursor = m.end;
  }
  if (cursor < text.length || out.length === 0) out.push({ text: text.slice(cursor), start: cursor });
  return out;
}

/** The entity with an occurrence overlapping [start, end], or containing a caret at start. */
export function entityAt(entities: Entity[], start: number, end: number): Entity | undefined {
  return entities.find((e) =>
    e.occurrences.some((o) => (start === end ? o.start <= start && start <= o.end : o.start < end && o.end > start)),
  );
}
