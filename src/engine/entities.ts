import type { Entity, EntityType, KeyEntry, Occurrence, Source, Span } from "./Masker.ts";

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
  private readonly links = new Map<string, string>(); // first name or surname → full-name key
  private readonly counters = new Map<EntityType, number>();

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): Registered | undefined {
    return this.entries.get(key);
  }

  /**
   * The entry for `key`, created if new. A capitalised `value` replaces a
   * lowercase one already stored ("kalle", later "Kalle"), so restore writes
   * the name-like form; the placeholder stays.
   */
  register(key: string, value: string, type: EntityType): Registered {
    const existing = this.entries.get(key);
    if (existing) {
      if (CAPITALISED.test(value) && !CAPITALISED.test(existing.value)) existing.value = value;
      return existing;
    }
    const n = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, n);
    const entry = { placeholder: `[${type}_${n}]`, value, type };
    this.entries.set(key, entry);
    return entry;
  }

  /**
   * Start from an uploaded key: its values keep their placeholders, and new
   * values are numbered after the highest number per type. A [FÖRNAMN_n] or
   * [EFTERNAMN_n] row links that name to [NAMN_n] again.
   */
  seed(entries: KeyEntry[]): void {
    const byPlaceholder = new Map(entries.map((e) => [e.placeholder, e]));
    for (const e of entries) {
      if (e.type === "FÖRNAMN" || e.type === "EFTERNAMN") {
        const full = byPlaceholder.get(e.placeholder.replace(/^\[(FÖR|EFTER)NAMN_/, "[NAMN_"));
        if (full) this.link(norm(e.value), norm(full.value));
        continue;
      }
      const n = Number(/_(\d+)\]$/.exec(e.placeholder)?.[1] ?? 0);
      this.counters.set(e.type, Math.max(this.counters.get(e.type) ?? 0, n));
      const key = norm(e.value);
      if (!this.entries.has(key)) this.entries.set(key, { placeholder: e.placeholder, value: e.value, type: e.type });
    }
  }

  link(part: string, fullKey: string): void {
    this.links.set(part, fullKey);
  }

  linkedTo(part: string): string | undefined {
    return this.links.get(part);
  }

  linkedNames(): Iterable<string> {
    return this.links.keys();
  }
}

const CAPITALISED = /^\p{Lu}/u;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const firstWord = (key: string) => key.slice(0, key.indexOf(" "));
const lastWord = (key: string) => key.slice(key.lastIndexOf(" ") + 1);

interface Resolved {
  span: Span; // genitive suffix already cut off the end
  surface: string;
  key: string;
  value: string;
  firstName?: boolean;
  lastName?: boolean;
}

/** "[NAMN_3]" → "[FÖRNAMN_3]": the placeholder for the first name alone. */
export function firstNamePlaceholder(placeholder: string): string {
  return placeholder.replace(/^\[NAMN_/, "[FÖRNAMN_");
}

/** "[NAMN_3]" → "[EFTERNAMN_3]": the placeholder for the surname alone. */
export function lastNamePlaceholder(placeholder: string): string {
  return placeholder.replace(/^\[NAMN_/, "[EFTERNAMN_");
}

/** The placeholder an occurrence is written as. */
export function placeholderOf(entity: Entity, occurrence: Occurrence): string {
  if (occurrence.firstName) return firstNamePlaceholder(entity.placeholder);
  if (occurrence.lastName) return lastNamePlaceholder(entity.placeholder);
  return entity.placeholder;
}

function stripSuffix(span: Span, surface: string, key: string, n: number): Resolved {
  const value = surface.slice(0, -n);
  return { span: { ...span, end: span.end - n }, surface: value, key: key.slice(0, -n), value };
}

/** Group spans into entities, merging surface forms and linking first names and surnames. */
export function buildEntities(text: string, spans: Span[], registry: EntityRegistry): Entity[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const surfaces = sorted.map((s) => text.slice(s.start, s.end));

  // Every form a genitive could be the genitive of.
  const known = new Set<string>(registry.linkedNames());
  sorted.forEach((s, i) => {
    const key = norm(surfaces[i]);
    known.add(key);
    if (s.type === "NAMN" && key.includes(" ")) known.add(firstWord(key)).add(lastWord(key));
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

  // First name or surname → full names in this text that start or end with it.
  // A word that is the first name of one and the surname of another is two
  // candidates, so it is not linked.
  const fullNames = new Map<string, Map<string, string>>(); // part → (full key → value)
  for (const r of resolved) {
    if (r.span.type !== "NAMN" || !r.key.includes(" ")) continue;
    for (const part of new Set([firstWord(r.key), lastWord(r.key)])) {
      const forPart = fullNames.get(part) ?? new Map<string, string>();
      if (!forPart.has(r.key)) forPart.set(r.key, r.value);
      fullNames.set(part, forPart);
    }
  }

  const linkTo = (r: Resolved, fullKey: string, fullValue: string) => {
    if (firstWord(fullKey) === r.key) r.firstName = true;
    else r.lastName = true;
    r.key = fullKey;
    r.value = fullValue;
  };
  for (const r of resolved) {
    if (r.span.type !== "NAMN" || r.key.includes(" ")) continue;
    const candidates = fullNames.get(r.key);
    if (candidates?.size === 1) {
      const [[fullKey, fullValue]] = candidates;
      registry.link(r.key, fullKey);
      linkTo(r, fullKey, fullValue);
    } else if (!candidates) {
      const linked = registry.linkedTo(r.key);
      const entry = linked && registry.get(linked);
      if (linked && entry) linkTo(r, linked, entry.value);
    }
  }

  // One value per entity is stored in the key, and restore writes it wherever
  // the AI's answer has the placeholder: the answer says which entity, not
  // which spelling. So prefer a capitalised form, then the term as the user
  // typed it, then the first form seen.
  const stored = new Map<string, { value: string; rank: number }>();
  for (const r of resolved) {
    const linked = r.firstName || r.lastName;
    const value = linked ? r.value : (r.span.term ?? r.value);
    const rank = (CAPITALISED.test(value) ? 0 : 2) + (r.span.term !== undefined && !linked ? 0 : 1);
    const best = stored.get(r.key);
    if (!best || rank < best.rank) stored.set(r.key, { value, rank });
  }

  const byKey = new Map<string, Entity>();
  for (const r of resolved) {
    const reg = registry.register(r.key, stored.get(r.key)?.value ?? r.value, r.span.type);
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
    entity.occurrences.push({
      start: r.span.start,
      end: r.span.end,
      surface: r.surface,
      ...(r.firstName && { firstName: true }),
      ...(r.lastName && { lastName: true }),
    });
    if (SOURCE_RANK[r.span.source] < SOURCE_RANK[entity.source]) entity.source = r.span.source;
  }
  return [...byKey.values()];
}
