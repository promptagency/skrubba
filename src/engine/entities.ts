import type { Entity, EntityType, Source, Span } from "./Masker.ts";

const GENITIVE_TYPES: ReadonlySet<EntityType> = new Set(["NAMN", "PLATS", "ORGANISATION"]);
const SOURCE_RANK: Record<Source, number> = { manual: 0, wordlist: 1, rule: 2, model: 3 };

interface Registered {
  placeholder: string;
  value: string;
  type: EntityType;
}

/**
 * Session-wide numbering. A value keeps its placeholder for the whole session
 * and numbers are never reused, so the key stays stable while the user edits.
 * Values are keyed without type: one value, one entity, typed by the first
 * type seen.
 */
export class EntityRegistry {
  private readonly entries = new Map<string, Registered>();
  private readonly links = new Map<string, string>(); // first name → full-name key
  private readonly counters = new Map<EntityType, number>();

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): Registered | undefined {
    return this.entries.get(key);
  }

  register(key: string, value: string, type: EntityType): Registered {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const n = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, n);
    const entry = { placeholder: `[${type}_${n}]`, value, type };
    this.entries.set(key, entry);
    return entry;
  }

  link(firstName: string, fullKey: string): void {
    this.links.set(firstName, fullKey);
  }

  linkedTo(firstName: string): string | undefined {
    return this.links.get(firstName);
  }

  linkedNames(): Iterable<string> {
    return this.links.keys();
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const firstWord = (key: string) => key.slice(0, key.indexOf(" "));

interface Resolved {
  span: Span; // genitive suffix already cut off the end
  surface: string;
  key: string;
  value: string;
}

function stripSuffix(span: Span, surface: string, key: string, n: number): Resolved {
  const value = surface.slice(0, -n);
  return { span: { ...span, end: span.end - n }, surface: value, key: key.slice(0, -n), value };
}

/** Group spans into entities, merging surface forms and linking first names. */
export function buildEntities(text: string, spans: Span[], registry: EntityRegistry): Entity[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const surfaces = sorted.map((s) => text.slice(s.start, s.end));

  // Every form a genitive could be the genitive of.
  const known = new Set<string>(registry.linkedNames());
  sorted.forEach((s, i) => {
    const key = norm(surfaces[i]);
    known.add(key);
    if (s.type === "NAMN" && key.includes(" ")) known.add(firstWord(key));
  });

  const resolved: Resolved[] = sorted.map((span, i) => {
    const surface = surfaces[i];
    const key = norm(surface);
    if (GENITIVE_TYPES.has(span.type)) {
      if (key.endsWith(":s")) return stripSuffix(span, surface, key, 2);
      if (key.endsWith("s") && (known.has(key.slice(0, -1)) || registry.has(key.slice(0, -1))))
        return stripSuffix(span, surface, key, 1);
    }
    return { span, surface, key, value: surface };
  });

  // First name → full names in this text that start with it.
  const fullNames = new Map<string, Map<string, string>>(); // first → (full key → value)
  for (const r of resolved) {
    if (r.span.type !== "NAMN" || !r.key.includes(" ")) continue;
    const first = firstWord(r.key);
    const forFirst = fullNames.get(first) ?? new Map<string, string>();
    if (!forFirst.has(r.key)) forFirst.set(r.key, r.value);
    fullNames.set(first, forFirst);
  }

  for (const r of resolved) {
    if (r.span.type !== "NAMN" || r.key.includes(" ")) continue;
    const candidates = fullNames.get(r.key);
    if (candidates?.size === 1) {
      const [[fullKey, fullValue]] = candidates;
      registry.link(r.key, fullKey);
      r.key = fullKey;
      r.value = fullValue;
    } else if (!candidates) {
      const linked = registry.linkedTo(r.key);
      const entry = linked && registry.get(linked);
      if (linked && entry) {
        r.key = linked;
        r.value = entry.value;
      }
    }
  }

  const byKey = new Map<string, Entity>();
  for (const r of resolved) {
    const reg = registry.register(r.key, r.value, r.span.type);
    let entity = byKey.get(r.key);
    if (!entity) {
      entity = {
        id: reg.placeholder,
        value: reg.value,
        type: reg.type,
        placeholder: reg.placeholder,
        occurrences: [],
        active: true,
        source: r.span.source,
      };
      byKey.set(r.key, entity);
    }
    entity.occurrences.push({ start: r.span.start, end: r.span.end, surface: r.surface });
    if (SOURCE_RANK[r.span.source] < SOURCE_RANK[entity.source]) entity.source = r.span.source;
  }
  return [...byKey.values()];
}
