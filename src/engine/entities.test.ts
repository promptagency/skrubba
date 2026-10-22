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

  it("stores the first capitalised form as the value", () => {
    const text = "det är kalle. Hej Kalle!";
    expect(summary(build(text, [["kalle", "NAMN"], ["Kalle", "NAMN"]]))).toEqual(["[NAMN_1]=Kalle×2"]);
  });

  it("keeps a lowercase value when no other form is seen", () => {
    expect(summary(build("det är kalle", [["kalle", "NAMN"]]))).toEqual(["[NAMN_1]=kalle×1"]);
  });

  it("stores a word-list term as the user typed it", () => {
    const text = "fenix och FENIX";
    const spans = spansFor(text, [["fenix", "ORD", "wordlist"], ["FENIX", "ORD", "wordlist"]]).map((s) => ({
      ...s,
      term: "Fenix",
    }));
    expect(summary(buildEntities(text, spans, new EntityRegistry()))).toEqual(["[ORD_1]=Fenix×2"]);
  });

  it("replaces a lowercase value with a capitalised one from a later text, keeping the placeholder", () => {
    const registry = new EntityRegistry();
    build("det är kalle", [["kalle", "NAMN"]], registry);
    expect(summary(build("Hej Kalle", [["Kalle", "NAMN"]], registry))).toEqual(["[NAMN_1]=Kalle×1"]);
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

  it("links a lone surname and its genitive, flagged so they can be written as [EFTERNAMN_1]", () => {
    const text = "Johan Lindqvist. Lindqvist ringde. Lindqvists lön.";
    const [e] = build(text, [["Johan Lindqvist", "NAMN"], ["Lindqvist", "NAMN"], ["Lindqvists", "NAMN"]]);
    expect(summary([e])).toEqual(["[NAMN_1]=Johan Lindqvist×3"]);
    expect(e.occurrences.map((o) => o.lastName ?? false)).toEqual([false, true, true]);
    expect(e.occurrences.some((o) => o.firstName)).toBe(false);
  });

  it("does not link when two full names share the surname", () => {
    const text = "Johan Lindqvist och Eva Lindqvist. Lindqvist ringde.";
    expect(summary(build(text, [["Johan Lindqvist", "NAMN"], ["Eva Lindqvist", "NAMN"], ["Lindqvist", "NAMN"]]))).toEqual([
      "[NAMN_1]=Johan Lindqvist×1",
      "[NAMN_2]=Eva Lindqvist×1",
      "[NAMN_3]=Lindqvist×1",
    ]);
  });

  it("does not link a word that is one name's first name and another's surname", () => {
    const text = "Henrik Jonas och Jonas Berg. Jonas ringde.";
    expect(summary(build(text, [["Henrik Jonas", "NAMN"], ["Jonas Berg", "NAMN"], ["Jonas", "NAMN"]]))).toEqual([
      "[NAMN_1]=Henrik Jonas×1",
      "[NAMN_2]=Jonas Berg×1",
      "[NAMN_3]=Jonas×1",
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

  it("reads a [DEL_ORGANISATION_n] row as a word of [ORGANISATION_n]", () => {
    const registry = new EntityRegistry();
    registry.seed([
      { placeholder: "[ORGANISATION_1]", value: "Volvo Cars", type: "ORGANISATION" },
      { placeholder: "[ORD_1]", value: "Aurora X", type: "ORD" },
      { placeholder: "[DEL_ORGANISATION_1]", value: "Volvo", type: "DEL_ORGANISATION" },
    ]);
    const [e] = build("Volvo-fabriken.", [["Volvo", "ORGANISATION"]], registry);
    expect(summary([e])).toEqual(["[ORGANISATION_1]=Volvo Cars×1"]);
    expect(e.occurrences[0].firstName).toBe(true);
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

  it("reads an [EFTERNAMN_n] row as the surname of [NAMN_n]", () => {
    const registry = new EntityRegistry();
    registry.seed([
      { placeholder: "[NAMN_1]", value: "Johan Lindqvist", type: "NAMN" },
      { placeholder: "[EFTERNAMN_1]", value: "Lindqvist", type: "EFTERNAMN" },
    ]);
    const [e] = build("Lindqvist ringde.", [["Lindqvist", "NAMN"]], registry);
    expect(summary([e])).toEqual(["[NAMN_1]=Johan Lindqvist×1"]);
    expect(e.occurrences[0].lastName).toBe(true);
  });
});

describe("buildEntities part linking ([DEL_<type>_n])", () => {
  it("links the first word of a company to it, flagged so it is written as [DEL_ORGANISATION_n]", () => {
    const text = "Volvo Cars växer. Volvo-fabriken och Volvos vd.";
    const [e] = build(text, [["Volvo Cars", "ORGANISATION"], ["Volvo", "ORGANISATION"], ["Volvos", "ORGANISATION"]]);
    expect(summary([e])).toEqual(["[ORGANISATION_1]=Volvo Cars×3"]);
    expect(e.occurrences.map((o) => o.firstName ?? false)).toEqual([false, true, true]);
  });

  it("links the last word of a word-list term, and a place", () => {
    const text = "Projekt Havsvind. Havsvind-teamet. Södra Sandby och Sandby-borna.";
    const out = build(text, [["Projekt Havsvind", "ORD", "wordlist"], ["Havsvind", "ORD", "wordlist"], ["Södra Sandby", "PLATS"], ["Sandby", "PLATS"]]);
    expect(summary(out)).toEqual(["[ORD_1]=Projekt Havsvind×2", "[PLATS_1]=Södra Sandby×2"]);
    expect(out.map((e) => e.occurrences[1].lastName)).toEqual([true, true]);
  });

  it("does not link across types, nor a word two values share", () => {
    const text = "Volvo Cars och Volvo Trucks. Volvo. Aurora X på listan. Aurora själv.";
    const out = build(text, [
      ["Volvo Cars", "ORGANISATION"],
      ["Volvo Trucks", "ORGANISATION"],
      ["Volvo", "ORGANISATION"],
      ["Aurora X", "ORD", "wordlist"],
      ["Aurora", "ORGANISATION"],
    ]);
    expect(summary(out)).toEqual([
      "[ORGANISATION_1]=Volvo Cars×1",
      "[ORGANISATION_2]=Volvo Trucks×1",
      "[ORGANISATION_3]=Volvo×1",
      "[ORD_1]=Aurora X×1",
      "[ORGANISATION_4]=Aurora×1",
    ]);
  });

  it("links one word per value: a second one stays an entity of its own", () => {
    const text = "Volvo Cars. Volvo-fabriken. Aurora X. Aurora-lanseringen. Cars-divisionen.";
    const out = build(text, [
      ["Volvo Cars", "ORGANISATION"],
      ["Volvo", "ORGANISATION"],
      ["Aurora X", "ORD", "wordlist"],
      ["Aurora", "ORD", "wordlist"],
      ["Cars", "ORGANISATION"],
    ]);
    expect(summary(out)).toEqual(["[ORGANISATION_1]=Volvo Cars×2", "[ORD_1]=Aurora X×2", "[ORGANISATION_2]=Cars×1"]);
  });

  it("keeps the link for the rest of the session", () => {
    const registry = new EntityRegistry();
    build("Volvo Cars. Volvo-fabriken.", [["Volvo Cars", "ORGANISATION"], ["Volvo", "ORGANISATION"]], registry);
    const [e] = build("Volvo-mötet.", [["Volvo", "ORGANISATION"]], registry);
    expect(summary([e])).toEqual(["[ORGANISATION_1]=Volvo Cars×1"]);
    expect(e.occurrences[0].firstName).toBe(true);
  });
});
