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
