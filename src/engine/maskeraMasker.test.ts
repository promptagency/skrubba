import { describe, expect, it } from "vitest";
import type { EntityType, MaskInput, Span } from "./Masker.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import type { NerBackend } from "./ner.ts";

// Stands in for the model: marks the given words wherever they occur.
function fakeNer(marks: Array<[string, EntityType]>): NerBackend {
  return {
    init: async () => {},
    detect: async (text) => {
      const spans: Span[] = [];
      for (const [word, type] of marks) {
        for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1))
          spans.push({ start: i, end: i + word.length, type, source: "model" });
      }
      return spans;
    },
  };
}

const none: MaskInput = { wordList: [], manual: [] };
const summary = (entities: Awaited<ReturnType<MaskeraMasker["mask"]>>) =>
  entities.map((e) => `${e.placeholder}=${e.value}:${e.source}`);

describe("MaskeraMasker.maskRules", () => {
  it("finds rule hits, word list terms and manual terms without the model", () => {
    const masker = new MaskeraMasker(fakeNer([["Anna", "NAMN"]]));
    const text = "Anna, 19850312-4471, Projekt Nordljus, Polaris Air";
    const input = { wordList: ["Nordljus"], manual: ["Polaris Air"] };
    expect(summary(masker.maskRules(text, input))).toEqual([
      "[PERSONNUMMER_1]=19850312-4471:rule",
      "[ORD_1]=Nordljus:wordlist",
      "[ORD_2]=Polaris Air:manual",
    ]);
  });
});

describe("MaskeraMasker.mask", () => {
  it("adds model entities to the rule entities", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna", "NAMN"]]));
    expect(summary(await masker.mask("Anna 19850312-4471", none))).toEqual([
      "[NAMN_1]=Anna:model",
      "[PERSONNUMMER_1]=19850312-4471:rule",
    ]);
  });

  it("lets the word list win over the model", async () => {
    const masker = new MaskeraMasker(fakeNer([["Polaris Air", "ORGANISATION"]]));
    expect(summary(await masker.mask("Polaris Air", { wordList: ["Polaris Air"], manual: [] }))).toEqual([
      "[ORD_1]=Polaris Air:wordlist",
    ]);
  });

  it("keeps placeholders stable across calls", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna", "NAMN"], ["Erik", "NAMN"]]));
    await masker.mask("Anna", none);
    expect(summary(await masker.mask("Erik och Anna", none))).toEqual(["[NAMN_2]=Erik:model", "[NAMN_1]=Anna:model"]);
  });
});

// Stands in for a model that finds each word in one place only: the nth occurrence.
function onceNer(marks: Array<[string, EntityType, number]>): NerBackend {
  return {
    init: async () => {},
    detect: async (text) =>
      marks.map(([word, type, nth]) => {
        let start = -1;
        for (let i = 0; i <= nth; i++) start = text.indexOf(word, start + 1);
        return { start, end: start + word.length, type, source: "model" as const };
      }),
  };
}

const masked = async (masker: MaskeraMasker, text: string) =>
  masker.applyMask(text, await masker.mask(text, none), []).masked;

describe("a name the model finds in one place", () => {
  it("is masked wherever else it occurs in the text", async () => {
    const masker = new MaskeraMasker(onceNer([["Norrström Media", "ORGANISATION", 1]]));
    const text = "Arbetsgivare, Norrström Media AB.\nNorrström Media har gjort en omorganisation.";
    expect(await masked(masker, text)).toBe(
      "Arbetsgivare, [ORGANISATION_1] AB.\n[ORGANISATION_1] har gjort en omorganisation.",
    );
  });

  it("is masked in the genitive too", async () => {
    const masker = new MaskeraMasker(onceNer([["Anna Berg", "NAMN", 1]]));
    expect(await masked(masker, "Anna Bergs lön. Anna Berg ringde.")).toBe("[NAMN_1]s lön. [NAMN_1] ringde.");
  });

  it("is masked as a whole word only", async () => {
    const masker = new MaskeraMasker(onceNer([["Anna", "NAMN", 0]]));
    expect(await masked(masker, "Anna bor på Annagatan.")).toBe("[NAMN_1] bor på Annagatan.");
  });

  it("is not spread when it is a lowercase word or shorter than three letters", async () => {
    const masker = new MaskeraMasker(onceNer([["teknik", "ORGANISATION", 0], ["AI", "ORGANISATION", 0]]));
    expect(await masked(masker, "AI, teknik. AI och teknik.")).toBe("[ORGANISATION_1], [ORGANISATION_2]. AI och teknik.");
  });
});

describe("MaskeraMasker round trip", () => {
  it("restores the masked text to the original", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna Berg", "NAMN"], ["Umeå", "PLATS"]]));
    const text = "Anna Berg (19850312-4471) flyttar till Umeå. Ring 070-1740612.";
    const entities = await masker.mask(text, none);
    const { masked, key } = masker.applyMask(text, entities, []);
    expect(masked).not.toContain("Anna");
    expect(masker.restore(masked, key).text).toBe(text);
  });
});

describe("MaskeraMasker key handling", () => {
  it("continues an uploaded key's numbering", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna", "NAMN"], ["Erik", "NAMN"]]));
    masker.loadKey({
      entries: [{ placeholder: "[NAMN_3]", value: "Anna", type: "NAMN" }],
      wordList: [],
      createdAt: "2026-10-10T00:00:00.000Z",
      app: "skrubba",
      version: 1,
    });
    expect(summary(await masker.mask("Erik och Anna", none))).toEqual(["[NAMN_4]=Erik:model", "[NAMN_3]=Anna:model"]);
  });

  it("starts numbering over after reset", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna", "NAMN"], ["Erik", "NAMN"]]));
    await masker.mask("Anna", none);
    masker.reset();
    expect(summary(await masker.mask("Erik", none))).toEqual(["[NAMN_1]=Erik:model"]);
  });
});
