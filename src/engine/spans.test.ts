import { describe, expect, it } from "vitest";
import type { EntityType, Source, Span } from "./Masker.ts";
import { resolveSpans, withoutDoseAddresses } from "./spans.ts";

function at(text: string, needle: string, type: EntityType, source: Source, from = 0): Span {
  const start = text.indexOf(needle, from);
  if (start < 0) throw new Error(`"${needle}" not in text`);
  return { start, end: start + needle.length, type, source };
}

const show = (text: string, spans: Span[]) => spans.map((s) => `${text.slice(s.start, s.end)}:${s.type}:${s.source}`);

describe("resolveSpans priority", () => {
  it("drops a company form left over when a rule claims the name", () => {
    const t = "Avtal med Norrström Media AB i dag";
    const spans = [at(t, "Norrström Media AB", "ORGANISATION", "model"), at(t, "Norrström Media", "ORGANISATION", "rule")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Norrström Media:ORGANISATION:rule"]);
  });

  it("drops a model span that is only a company form, as the worker's clipping leaves it", () => {
    const t = "Avtal med Norrström Media AB i dag";
    const spans = [at(t, "AB", "ORGANISATION", "model"), at(t, "Norrström Media", "ORGANISATION", "rule")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Norrström Media:ORGANISATION:rule"]);
  });

  it("keeps non-overlapping spans sorted by position", () => {
    const t = "Anna bor i Umeå";
    expect(show(t, resolveSpans(t, [at(t, "Umeå", "PLATS", "model"), at(t, "Anna", "NAMN", "model")]))).toEqual([
      "Anna:NAMN:model",
      "Umeå:PLATS:model",
    ]);
  });

  it("word list beats a model span covering the same text", () => {
    const t = "Lansering av Polaris Air i höst";
    const spans = [at(t, "Polaris Air", "ORGANISATION", "model"), at(t, "Polaris Air", "ORD", "wordlist")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Polaris Air:ORD:wordlist"]);
  });

  it("manual beats word list beats rule beats model", () => {
    const t = "X 556677-8899 Y";
    const s = (source: Source, type: EntityType) => at(t, "556677-8899", type, source);
    const all = [s("model", "ADRESS"), s("rule", "ORGANISATIONSNUMMER"), s("wordlist", "ORD"), s("manual", "ORD")];
    expect(resolveSpans(t, all).map((x) => x.source)).toEqual(["manual"]);
    expect(resolveSpans(t, all.slice(0, 3)).map((x) => x.source)).toEqual(["wordlist"]);
    expect(resolveSpans(t, all.slice(0, 2)).map((x) => x.source)).toEqual(["rule"]);
  });

  it("clips a partially overlapping lower-priority span instead of dropping it", () => {
    const t = "Kampanj för Polaris Air Max nu";
    const spans = [at(t, "Polaris Air Max", "ORGANISATION", "model"), at(t, "Polaris", "ORD", "wordlist")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Polaris:ORD:wordlist", "Air Max:ORGANISATION:model"]);
  });

  it("drops a clipped remnant shorter than two word characters", () => {
    const t = "Anna B.";
    const spans = [at(t, "Anna B", "NAMN", "model"), at(t, "Anna", "ORD", "manual")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Anna:ORD:manual"]);
  });
});

describe("resolveSpans joining", () => {
  it("joins model spans split by a space, as ORGANISATION if either part is", () => {
    const t = "Kund: Fjällgren Outdoor ska";
    const spans = [at(t, "Fjällgren", "NAMN", "model"), at(t, "Outdoor", "ORGANISATION", "model")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Fjällgren Outdoor:ORGANISATION:model"]);
  });

  it("joins model spans split by an apostrophe", () => {
    const t = "som Arc'teryx.";
    const spans = [at(t, "Arc", "ORGANISATION", "model"), at(t, "teryx", "NAMN", "model")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Arc'teryx:ORGANISATION:model"]);
  });

  it("keeps the first type when no part is ORGANISATION", () => {
    const t = "Anna Berg";
    const spans = [at(t, "Anna", "NAMN", "model"), at(t, "Berg", "PLATS", "model")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Anna Berg:NAMN:model"]);
  });

  it("does not join across a comma, a newline or two spaces", () => {
    const t = "Anna, Berg\nEk  Holm";
    const spans = ["Anna", "Berg", "Ek", "Holm"].map((n) => at(t, n, "NAMN", "model"));
    expect(resolveSpans(t, spans)).toHaveLength(4);
  });

  it("does not join a model span to a rule span", () => {
    const t = "Anna 070-1740612";
    const spans = [at(t, "Anna", "NAMN", "model"), at(t, "070-1740612", "TELEFON", "rule")];
    expect(resolveSpans(t, spans)).toHaveLength(2);
  });
});

describe("withoutDoseAddresses", () => {
  it("drops a model address that is a dose, keeps a street with a number", () => {
    const t = "Sertralin 50 mg, Alvedon 500 mg x 3, Storgatan 5 g, Vintergatan 12, 2 st";
    const spans = [
      at(t, "Sertralin 50 mg", "ADRESS", "model"),
      at(t, "Alvedon 500 mg x 3", "ADRESS", "model"),
      at(t, "Storgatan 5 g", "ADRESS", "model"),
      at(t, "Vintergatan 12", "ADRESS", "model"),
      at(t, "2 st", "ADRESS", "rule"),
    ];
    expect(show(t, withoutDoseAddresses(t, spans))).toEqual(["Storgatan 5 g:ADRESS:model", "Vintergatan 12:ADRESS:model", "2 st:ADRESS:rule"]);
  });
});
