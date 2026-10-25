import { describe, expect, it } from "vitest";
import type { EntityType, Source, Span } from "./Masker.ts";
import {
  birthDatesAfterNames,
  looksFormal,
  resolveSpans,
  retypeOrganisations,
  splitAtLineBreaks,
  spreadModelValues,
  trimEdgeWords,
  withoutCommonWords,
  withoutDoseAddresses,
  withoutTitles,
} from "./spans.ts";

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

  it("drops a model span that is the rest of a compound after a rule-found place, as the worker's clipping leaves it", () => {
    const t = "Stockholmskontoret och Malmöbor";
    const spans = [at(t, "skontoret", "ORGANISATION", "model"), at(t, "Stockholm", "PLATS", "rule"), at(t, "bor", "ORGANISATION", "model"), at(t, "Malmö", "PLATS", "rule")];
    expect(show(t, resolveSpans(t, spans))).toEqual(["Stockholm:PLATS:rule", "Malmö:PLATS:rule"]);
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
  it("drops a part of a document, a span cut inside a number, and a label whose number a rule claimed", () => {
    const t = "Bilaga 3 och sid 1. Signerade 2026-10-22. Dokument-ID 0922211555 och Storgatan 5 3 tr. Bor på Storgatan. Kungsgatan 12 också.";
    const spans = [
      at(t, "Bilaga 3", "ADRESS", "model"),
      at(t, "sid 1", "ADRESS", "model"),
      at(t, "Signerade 20", "ADRESS", "model"),
      at(t, "Dokument-ID", "ADRESS", "model"),
      at(t, "Storgatan 5", "ADRESS", "model"),
      at(t, "Storgatan", "ADRESS", "model", t.indexOf("Bor")),
      at(t, "Kungsgatan", "ADRESS", "model"),
    ];
    expect(show(t, withoutDoseAddresses(t, spans))).toEqual(["Storgatan 5:ADRESS:model", "Storgatan:ADRESS:model", "Kungsgatan:ADRESS:model"]);
  });

  it("drops a lowercase label with no number, keeps a lowercase street with one", () => {
    const t = "reg.nr WNR 229, bor på storgatan 5, mätarställning 84 120 km";
    const spans = [at(t, "nr", "ADRESS", "model"), at(t, "storgatan 5", "ADRESS", "model"), at(t, "mätarställning 84 120", "ADRESS", "model")];
    expect(show(t, withoutDoseAddresses(t, spans))).toEqual(["storgatan 5:ADRESS:model", "mätarställning 84 120:ADRESS:model"]);
  });

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

describe("trimEdgeWords", () => {
  it("cuts plain lowercase words off both ends of a model name, organisation or place", () => {
    const t = "Please call Per Holm today. Fjällbris joined the call. wants a new deck. Hon bor i Umeå nu. Hi team, Dear Anna. Our contact Johan";
    const spans = [
      at(t, "Please call Per Holm today", "NAMN", "model"),
      at(t, "Fjällbris joined the call", "ORGANISATION", "model"),
      at(t, "wants a new deck", "PLATS", "model"),
      at(t, "i Umeå nu", "PLATS", "model"),
      at(t, "Hi", "ORGANISATION", "model"),
      at(t, "Dear Anna", "NAMN", "model"),
      // The model may split the opener off the name; joined again, it would hide "contact".
      at(t, "Our contact", "NAMN", "model"),
      at(t, "Johan", "NAMN", "model"),
    ];
    expect(show(t, trimEdgeWords(t, spans))).toEqual([
      "Per Holm:NAMN:model",
      "Fjällbris:ORGANISATION:model",
      "wants a new deck:PLATS:model",
      "Umeå:PLATS:model",
      "Anna:NAMN:model",
      "Johan:NAMN:model",
    ]);
  });

  it("keeps lowercase names, name particles, rule spans and other types", () => {
    const t = "the client (arla) and von Trapp, de la Gardie; see Storgatan 5 i dag; call anna berg";
    const spans = [
      at(t, "arla", "ORGANISATION", "model"),
      at(t, "von Trapp", "NAMN", "model"),
      at(t, "de la Gardie", "NAMN", "model"),
      at(t, "Storgatan 5 i dag", "ADRESS", "model"),
      at(t, "call anna berg", "NAMN", "rule"),
    ];
    expect(trimEdgeWords(t, spans)).toEqual(spans);
  });

  it("keeps a lowercase company in a chat whole, where only the company form is capitalised", () => {
    const t = "ring fjällbris konsult AB om fakturan, och arla Foods";
    const spans = [at(t, "fjällbris konsult AB", "ORGANISATION", "model"), at(t, "arla Foods", "ORGANISATION", "model")];
    expect(show(t, trimEdgeWords(t, spans))).toEqual(show(t, spans));
  });

  it("leaves Swedish text alone, where a lowercase word after a name is often a surname", () => {
    const t = "jag byter förnamn från Kjell-Olov till Kim. kjell-olov bäckman, piteå. alla kallar mig kim";
    const spans = [at(t, "Kim. kjell-olov bäckman", "NAMN", "model")];
    expect(trimEdgeWords(t, spans)).toEqual(spans);
  });

  it("cuts function words and single letters off in Swedish too", () => {
    const t = "Låntagaren i detta avtal och Anna Berg samt Volvo Cars är parter. Hon bor i Umeå nu.";
    const spans = [
      at(t, "Låntagaren i", "ORGANISATION", "model"),
      at(t, "och Anna Berg", "NAMN", "model"),
      at(t, "Volvo Cars är", "ORGANISATION", "model"),
      at(t, "i Umeå nu", "PLATS", "model"),
    ];
    expect(show(t, trimEdgeWords(t, spans))).toEqual([
      "Låntagaren:ORGANISATION:model",
      "Anna Berg:NAMN:model",
      "Volvo Cars:ORGANISATION:model",
      "Umeå nu:PLATS:model",
    ]);
  });
});

describe("withoutTitles", () => {
  it("drops a model span that is only a job title and cuts a title off a name", () => {
    const t = "Lisa Berg (CFO), Erik Ek (vice ordf.), Controller: Sara Lind. ÖL Per Holm. KTH. Konsult AB. Initierare. Dokument-ID";
    const spans = [
      at(t, "Lisa Berg", "NAMN", "model"),
      at(t, "Initierare", "NAMN", "model"),
      at(t, "ID", "NAMN", "model"),
      at(t, "CFO", "ORGANISATION", "model"),
      at(t, "vice ordf.", "ORGANISATION", "model"),
      at(t, "Controller", "ORGANISATION", "model"),
      at(t, "ÖL Per Holm", "NAMN", "model"),
      at(t, "KTH", "ORGANISATION", "model"),
      at(t, "Konsult AB", "ORGANISATION", "model"),
      at(t, "CFO", "ORGANISATION", "rule"),
    ];
    expect(show(t, withoutTitles(t, spans))).toEqual([
      "Lisa Berg:NAMN:model",
      "Per Holm:NAMN:model",
      "KTH:ORGANISATION:model",
      "Konsult AB:ORGANISATION:model",
      "CFO:ORGANISATION:rule",
    ]);
  });
});

describe("retypeOrganisations", () => {
  const types = (text: string, spans: Span[]) => retypeOrganisations(text, spans).map((s) => `${text.slice(s.start, s.end)}:${s.type}`);

  it("types a model name as a company when the text has it as a company elsewhere, genitive included", () => {
    const t = "Essitys vd ringde. Essity vill ha mer.";
    expect(types(t, [at(t, "Essitys", "NAMN", "model"), at(t, "Essity", "ORGANISATION", "model", 10)])).toEqual([
      "Essitys:ORGANISATION",
      "Essity:ORGANISATION",
    ]);
  });

  it("types the first word of a rule-found company name as the company", () => {
    const t = "Fjällbris Konsult AB svarar. Fjällbris vill se offerten.";
    expect(types(t, [at(t, "Fjällbris Konsult", "ORGANISATION", "rule"), at(t, "Fjällbris", "NAMN", "model", 20)])).toEqual([
      "Fjällbris Konsult:ORGANISATION",
      "Fjällbris:ORGANISATION",
    ]);
  });

  it("types a well-known company as a company, and leaves people and other sources alone", () => {
    const t = "Pitchen för Arla gick bra, sa Anna. Arla är med.";
    const spans = [at(t, "Arla", "NAMN", "model"), at(t, "Anna", "NAMN", "model"), at(t, "Arla", "NAMN", "rule", 20)];
    expect(types(t, spans)).toEqual(["Arla:ORGANISATION", "Anna:NAMN", "Arla:NAMN"]);
  });
});

describe("spreadModelValues stray hits", () => {
  const spread = (t: string, spans: Span[]) => show(t, spreadModelValues(t, spans));

  it("does not spread a single word the model found once while the text has it four times or more", () => {
    const t = "Elevens lärare (Emma). Elevens mamma. Elevens pappa. Elevens lärare igen, Emma.";
    expect(spread(t, [at(t, "Elevens", "NAMN", "model", 40), at(t, "Emma", "NAMN", "model")])).toEqual(["Emma:NAMN:model", "Emma:NAMN:model"]);
  });

  it("spreads a name found once in fewer occurrences, found twice, or of several words", () => {
    const t = "Anna, Anna, Anna. Berg Berg Berg Berg. Nya Tider Nya Tider Nya Tider Nya Tider.";
    const spans = [at(t, "Anna", "NAMN", "model"), at(t, "Berg", "NAMN", "model"), at(t, "Berg", "NAMN", "model", 25), at(t, "Nya Tider", "ORGANISATION", "model")];
    expect(spread(t, spans).length).toBe(3 + 4 + 4);
  });
});

describe("birthDatesAfterNames", () => {
  const dates = (t: string, spans: Span[]) => birthDatesAfterNames(t, spans).map((s) => `${t.slice(s.start, s.end)}:${s.type}:${s.source}`);

  it("leaves a date after a handle or a mail header name alone", () => {
    const t = "@erik, 12 maj funkar? Från: Anna Berg 2024-05-12";
    expect(dates(t, [at(t, "erik", "NAMN", "rule"), at(t, "Anna Berg", "NAMN", "rule")])).toEqual([]);
  });

  it("takes a date right after a name, with a comma, a parenthesis or a birth asterisk", () => {
    const t = "Anna Berg, 1987-03-14, chef. Erik Ek (*14/3-87). Siv Lund 19870314 och Bo Alm (1987-03-14).";
    const spans = [at(t, "Anna Berg", "NAMN", "model"), at(t, "Erik Ek", "NAMN", "model"), at(t, "Siv Lund", "NAMN", "model"), at(t, "Bo Alm", "NAMN", "model")];
    expect(dates(t, spans)).toEqual([
      "1987-03-14:FÖDELSEDATUM:rule",
      "14/3-87:FÖDELSEDATUM:rule",
      "19870314:FÖDELSEDATUM:rule",
      "1987-03-14:FÖDELSEDATUM:rule",
    ]);
  });

  it("leaves a log line, a date after other words and a date after a company alone", () => {
    const t = "Anna Berg 2024-05-01 10:32 skrev. Anna Berg skrev 2024-05-01. Volvo 2024-05-01.";
    const spans = [at(t, "Anna Berg", "NAMN", "model"), at(t, "Anna Berg", "NAMN", "model", 30), at(t, "Volvo", "ORGANISATION", "model")];
    expect(dates(t, spans)).toEqual([]);
  });
});

const FORMAL = Array.from({ length: 16 }, (_, i) => `Mening ${i + 1} står här.`).join(" ") + " Se t.ex. bilagan. Följande gäller: a) ett, b) två.";

describe("looksFormal", () => {
  it("is true for a document of capitalised sentences, abbreviations and colon lists allowed", () => {
    expect(looksFormal(FORMAL)).toBe(true);
  });

  it("is false for a chat and for a short note", () => {
    expect(looksFormal(Array.from({ length: 20 }, () => "hej kan du kolla detta. tack.").join("\n"))).toBe(false);
    expect(looksFormal("kunden (arla) vill flytta lanseringen")).toBe(false);
  });
});

describe("withoutCommonWords", () => {
  it("keeps a name made of the letters i, v and x, since a roman numeral is all lowercase or all uppercase", () => {
    const t = "Ring Vivi och Xi. Se punkt II och iv.";
    const spans = [at(t, "Vivi", "NAMN", "model"), at(t, "Xi", "NAMN", "model"), at(t, "II", "NAMN", "model"), at(t, "iv", "NAMN", "model")];
    expect(show(t, withoutCommonWords(t, spans))).toEqual(["Vivi:NAMN:model", "Xi:NAMN:model"]);
  });

  it("drops list markers everywhere, and lowercase model names, organisations and places in a formal document", () => {
    const t = `${FORMAL} Volvo Cars, penningtvätt, relevanta nationella myndigheter, ii, iii och Umeå.`;
    const spans = [
      at(t, "Volvo Cars", "ORGANISATION", "model"),
      at(t, "penningtvätt", "ORGANISATION", "model"),
      at(t, "relevanta nationella myndigheter", "ORGANISATION", "model"),
      at(t, "ii", "NAMN", "model"),
      at(t, "iii", "ORGANISATION", "model"),
      at(t, "Umeå", "PLATS", "model"),
    ];
    expect(show(t, withoutCommonWords(t, spans))).toEqual(["Volvo Cars:ORGANISATION:model", "Umeå:PLATS:model"]);
  });

  it("keeps a lowercase name in a chat, and never touches rule spans", () => {
    const t = "kunden (arla) vill flytta lanseringen, säger anna. ii";
    const spans = [at(t, "arla", "ORGANISATION", "model"), at(t, "anna", "NAMN", "model"), at(t, "ii", "NAMN", "rule")];
    expect(withoutCommonWords(t, spans)).toEqual(spans);
  });
});

describe("trimEdgeWords on organisations and places", () => {
  it("cuts a lowercase word at the start but keeps one at the end, as Swedish names capitalise only the first word", () => {
    const t = `${FORMAL} Enligt lånevillkor InvestEU-garanti och Europeiska investeringsbanken samt EU:s ekonomi.`;
    const spans = [
      at(t, "lånevillkor InvestEU-garanti", "ORGANISATION", "model"),
      at(t, "Europeiska investeringsbanken", "ORGANISATION", "model"),
      at(t, "EU:s ekonomi", "ORGANISATION", "model"),
    ];
    expect(show(t, trimEdgeWords(t, spans))).toEqual([
      "InvestEU-garanti:ORGANISATION:model",
      "Europeiska investeringsbanken:ORGANISATION:model",
      "EU:s ekonomi:ORGANISATION:model",
    ]);
  });
});

describe("splitAtLineBreaks", () => {
  it("cuts a model span at every line break and leaves rule spans alone", () => {
    const t = "Stödet avser: Sikta Högre\nOvanstående tjänst. Almi\nFöretagspartners rådgivning.\nAnna Berg";
    const spans = [at(t, "Sikta Högre\nOvanstående", "ORGANISATION", "model"), at(t, "Almi\nFöretagspartners", "ORGANISATION", "model"), at(t, "Anna Berg", "NAMN", "rule")];
    expect(show(t, splitAtLineBreaks(t, spans))).toEqual([
      "Sikta Högre:ORGANISATION:model",
      "Ovanstående:ORGANISATION:model",
      "Almi:ORGANISATION:model",
      "Företagspartners:ORGANISATION:model",
      "Anna Berg:NAMN:rule",
    ]);
  });

  it("cuts at a colon with a space after it and drops a piece without letters, but not a genitive or a property unit", () => {
    const t = "Term sheet från Bergvik Ventures: 12 MSEK. Kontakt: Johanna Ferm. Zephyr:s team. Majorna 12:4.";
    const spans = [
      at(t, "Bergvik Ventures: 12", "ORGANISATION", "model"),
      at(t, "Kontakt: Johanna Ferm", "NAMN", "model"),
      at(t, "Zephyr:s", "ORGANISATION", "model"),
      at(t, "Majorna 12:4", "PLATS", "model"),
    ];
    expect(show(t, splitAtLineBreaks(t, spans))).toEqual([
      "Bergvik Ventures:ORGANISATION:model",
      "Kontakt:NAMN:model",
      "Johanna Ferm:NAMN:model",
      "Zephyr:s:ORGANISATION:model",
      "Majorna 12:4:PLATS:model",
    ]);
  });
});
