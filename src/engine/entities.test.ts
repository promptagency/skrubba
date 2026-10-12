import { describe, expect, it } from "vitest";
import type { EntityType, Source, Span } from "./Masker.ts";
import { buildEntities, EntityRegistry } from "./entities.ts";

type Mark = [needle: string, type: EntityType, source?: Source];

// Marks every occurrence of each needle (whole word) as a span, longest
// needle first and without overlaps, like resolved input would be.
function spansFor(text: string, marks: Mark[]): Span[] {
  const spans: Span[] = [];
  const byLength = [...marks].sort((a, b) => b[0].length - a[0].length);
  for (const [needle, type, source = "model"] of byLength) {
    const re = new RegExp(`(?<![\\p{L}])${needle}(?![\\p{L}:])`, "gu");
    for (const m of text.matchAll(re)) {
      const span = { start: m.index, end: m.index + needle.length, type, source };
      if (spans.some((s) => s.start < span.end && s.end > span.start)) continue;
      spans.push(span);
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function build(text: string, marks: Mark[], registry = new EntityRegistry()) {
  return buildEntities(text, spansFor(text, marks), registry);
}

const summary = (entities: ReturnType<typeof build>) =>
  entities.map((e) => `${e.placeholder}=${e.value}×${e.occurrences.length}`);

describe("buildEntities numbering", () => {
  it("gives the same value the same placeholder and numbers per type in order", () => {
    const text = "Anna ringde Erik. Anna bor i Umeå.";
    expect(summary(build(text, [["Anna", "NAMN"], ["Erik", "NAMN"], ["Umeå", "PLATS"]]))).toEqual([
      "[NAMN_1]=Anna×2",
      "[NAMN_2]=Erik×1",
      "[PLATS_1]=Umeå×1",
    ]);
  });

  it("merges case and whitespace variants", () => {
    const text = "Anna Berg och anna  berg";
    expect(summary(build(text, [["Anna Berg", "NAMN"], ["anna  berg", "NAMN"]]))).toEqual(["[NAMN_1]=Anna Berg×2"]);
  });

  it("numbers ORD like other types", () => {
    expect(summary(build("Nordljus", [["Nordljus", "ORD", "wordlist"]]))).toEqual(["[ORD_1]=Nordljus×1"]);
  });

  it("marks every entity active", () => {
    expect(build("Anna", [["Anna", "NAMN"]]).every((e) => e.active)).toBe(true);
  });
});

describe("buildEntities genitive", () => {
  it("merges a genitive with its base form and keeps the base as value", () => {
    const text = "Anna Bergs lön. Anna Berg ringde.";
    expect(summary(build(text, [["Anna Bergs", "NAMN"], ["Anna Berg", "NAMN"]]))).toEqual(["[NAMN_1]=Anna Berg×2"]);
  });

  it("merges the colon genitive", () => {
    const text = "Atea:s avtal med Atea";
    expect(summary(build(text, [["Atea:s", "ORGANISATION"], ["Atea", "ORGANISATION"]]))).toEqual([
      "[ORGANISATION_1]=Atea×2",
    ]);
  });

  it("keeps a name that ends in s when no base form exists", () => {
    expect(summary(build("Anders ringde", [["Anders", "NAMN"]]))).toEqual(["[NAMN_1]=Anders×1"]);
  });
});

describe("buildEntities across types", () => {
  it("merges the same value found as PLATS and ORGANISATION, typed by the first seen", () => {
    const text = "kontoret i Göteborg. Stena i Göteborg";
    const spans: Span[] = [
      { start: 11, end: 19, type: "PLATS", source: "model" },
      { start: 29, end: 37, type: "ORGANISATION", source: "model" },
    ];
    expect(summary(buildEntities(text, spans, new EntityRegistry()))).toEqual(["[PLATS_1]=Göteborg×2"]);
  });
});

describe("buildEntities first-name linking", () => {
  it("links a lone first name and its genitive to the full name", () => {
    const text = "Johan Lindqvist är sjuk. Johan ringde. Johans lön.";
    const [e] = build(text, [["Johan Lindqvist", "NAMN"], ["Johan", "NAMN"], ["Johans", "NAMN"]]);
    expect(e.placeholder).toBe("[NAMN_1]");
    expect(e.value).toBe("Johan Lindqvist");
    expect(e.occurrences.map((o) => o.surface)).toEqual(["Johan Lindqvist", "Johan", "Johan"]);
  });

  it("flags the linked first-name occurrences so they can be written as [FÖRNAMN_1]", () => {
    const text = "Johan Lindqvist är sjuk. Johan ringde. Johans lön.";
    const [e] = build(text, [["Johan Lindqvist", "NAMN"], ["Johan", "NAMN"], ["Johans", "NAMN"]]);
    expect(e.occurrences.map((o) => o.firstName ?? false)).toEqual([false, true, true]);
  });

  it("leaves the genitive s outside the occurrence so the output reads [NAMN_1]s", () => {
    const text = "Anna Berg. Anna Bergs lön. Atea:s avtal med Atea.";
    const out = build(text, [["Anna Berg", "NAMN"], ["Anna Bergs", "NAMN"], ["Atea:s", "ORGANISATION"], ["Atea", "ORGANISATION"]]);
    const after = out.flatMap((e) => e.occurrences.map((o) => text.slice(o.end, o.end + 2)));
    expect(after).toEqual([". ", "s ", ":s", "."]);
  });

  it("links when the first name comes before the full name", () => {
    const text = "Hej Sofia. Kontakt: Sofia Brandt.";
    expect(summary(build(text, [["Sofia", "NAMN"], ["Sofia Brandt", "NAMN"]]))).toEqual([
      "[NAMN_1]=Sofia Brandt×2",
    ]);
  });

  it("does not link when two full names share the first name", () => {
    const text = "Anna Berg och Anna Ek. Anna ringde.";
    expect(summary(build(text, [["Anna Berg", "NAMN"], ["Anna Ek", "NAMN"], ["Anna", "NAMN"]]))).toEqual([
      "[NAMN_1]=Anna Berg×1",
      "[NAMN_2]=Anna Ek×1",
      "[NAMN_3]=Anna×1",
    ]);
  });

  it("does not link a lone surname", () => {
    const text = "Johan Lindqvist. Lindqvist ringde.";
    expect(summary(build(text, [["Johan Lindqvist", "NAMN"], ["Lindqvist", "NAMN"]]))).toEqual([
      "[NAMN_1]=Johan Lindqvist×1",
      "[NAMN_2]=Lindqvist×1",
    ]);
  });

  it("does not link across types", () => {
    const text = "Johan Lindqvist bor på Johan Banérs gata";
    const out = build(text, [["Johan Lindqvist", "NAMN"], ["Johan Banérs gata", "ADRESS", "rule"]]);
    expect(summary(out)).toEqual(["[NAMN_1]=Johan Lindqvist×1", "[ADRESS_1]=Johan Banérs gata×1"]);
  });
});

describe("EntityRegistry across edits", () => {
  it("keeps placeholders when the text changes", () => {
    const registry = new EntityRegistry();
    build("Anna och Erik", [["Anna", "NAMN"], ["Erik", "NAMN"]], registry);
    expect(summary(build("Erik och Anna", [["Anna", "NAMN"], ["Erik", "NAMN"]], registry))).toEqual([
      "[NAMN_2]=Erik×1",
      "[NAMN_1]=Anna×1",
    ]);
  });

  it("never reuses a retired number", () => {
    const registry = new EntityRegistry();
    build("Anna", [["Anna", "NAMN"]], registry);
    expect(summary(build("Erik", [["Erik", "NAMN"]], registry))).toEqual(["[NAMN_2]=Erik×1"]);
  });

  it("keeps a first-name link after the full name is edited away", () => {
    const registry = new EntityRegistry();
    build("Johan Lindqvist. Johan.", [["Johan Lindqvist", "NAMN"], ["Johan", "NAMN"]], registry);
    const [e] = build("Johan ringde.", [["Johan", "NAMN"]], registry);
    expect(summary([e])).toEqual(["[NAMN_1]=Johan Lindqvist×1"]);
    expect(e.occurrences[0].firstName).toBe(true);
  });

  it("drops a remembered link when the text now has two matching full names", () => {
    const registry = new EntityRegistry();
    build("Anna Berg. Anna.", [["Anna Berg", "NAMN"], ["Anna", "NAMN"]], registry);
    const text = "Anna Berg och Anna Ek. Anna.";
    expect(summary(build(text, [["Anna Berg", "NAMN"], ["Anna Ek", "NAMN"], ["Anna", "NAMN"]], registry))).toEqual([
      "[NAMN_1]=Anna Berg×1",
      "[NAMN_2]=Anna Ek×1",
      "[NAMN_3]=Anna×1",
    ]);
  });
});

describe("EntityRegistry.seed", () => {
  it("reuses placeholders from a key and numbers new values after them", () => {
    const registry = new EntityRegistry();
    registry.seed([
      { placeholder: "[NAMN_1]", value: "Anna Berg", type: "NAMN" },
      { placeholder: "[NAMN_4]", value: "Erik Ek", type: "NAMN" },
    ]);
    const text = "Erik Ek, Anna Berg och Sara Holm";
    expect(summary(build(text, [["Erik Ek", "NAMN"], ["Anna Berg", "NAMN"], ["Sara Holm", "NAMN"]], registry))).toEqual([
      "[NAMN_4]=Erik Ek×1",
      "[NAMN_1]=Anna Berg×1",
      "[NAMN_5]=Sara Holm×1",
    ]);
  });

  it("reads a [FÖRNAMN_n] row as the first name of [NAMN_n], not as a value of its own", () => {
    const registry = new EntityRegistry();
    registry.seed([
      { placeholder: "[NAMN_1]", value: "Johan Lindqvist", type: "NAMN" },
      { placeholder: "[FÖRNAMN_1]", value: "Johan", type: "FÖRNAMN" },
    ]);
    const [e] = build("Johan ringde. Erik Ek svarade.", [["Johan", "NAMN"], ["Erik Ek", "NAMN"]], registry);
    expect(summary([e])).toEqual(["[NAMN_1]=Johan Lindqvist×1"]);
    expect(e.occurrences[0].firstName).toBe(true);
  });
});
