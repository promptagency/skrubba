import { describe, expect, it } from "vitest";
import type { EntityType, MaskInput, Span } from "./Masker.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import type { NerBackend } from "./ner.ts";
import { splitForModel } from "./parts.ts";

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
const splitCount = (text: string) => splitForModel(text).length;
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

  it("is masked at the start of a compound word when it is a company or place", async () => {
    const masker = new MaskeraMasker(onceNer([["Volvo", "ORGANISATION", 0], ["Malmö", "PLATS", 0]]));
    expect(await masked(masker, "Volvo i Malmö. Volvoavtalet och Malmökontoret.")).toBe(
      "[ORGANISATION_1] i [PLATS_1]. [ORGANISATION_1]avtalet och [PLATS_1]kontoret.",
    );
  });

  it("cuts a compound the model found whole to the name inside it", async () => {
    const masker = new MaskeraMasker(onceNer([["Volvo", "ORGANISATION", 0], ["Volvoavtalet", "ORGANISATION", 0]]));
    expect(await masked(masker, "Volvo. Volvoavtalet löper ut.")).toBe("[ORGANISATION_1]. [ORGANISATION_1]avtalet löper ut.");
  });

  it("leaves the rest of a compound unmasked after a word-list term", async () => {
    const masker = new MaskeraMasker(onceNer([["Nordljuskampanjen", "ORGANISATION", 0]]));
    const entities = await masker.mask("Nordljuskampanjen startar.", { wordList: ["Nordljus"], manual: [] });
    expect(masker.applyMask("Nordljuskampanjen startar.", entities, []).masked).toBe("[ORD_1]kampanjen startar.");
  });

  it("is not spread when it is a lowercase word or shorter than three letters", async () => {
    const masker = new MaskeraMasker(onceNer([["teknik", "ORGANISATION", 0], ["AI", "ORGANISATION", 0]]));
    expect(await masked(masker, "AI, teknik. AI och teknik.")).toBe("[ORGANISATION_1], [ORGANISATION_2]. AI och teknik.");
  });
});

describe("a date right after a name the model finds", () => {
  it("is masked as a birth date", async () => {
    const masker = new MaskeraMasker(fakeNer([["Anna Berg", "NAMN"]]));
    const text = "Deltagare: Anna Berg, 1987-03-14, och mötet 2024-05-01.";
    const entities = await masker.mask(text, none);
    expect(summary(entities)).toEqual(["[NAMN_1]=Anna Berg:model", "[FÖDELSEDATUM_1]=1987-03-14:rule"]);
    expect(masker.applyMask(text, entities, []).masked).toBe("Deltagare: [NAMN_1], [FÖDELSEDATUM_1], och mötet 2024-05-01.");
  });
});

describe("the head word of a multi-word value the model finds", () => {
  it("is masked where it starts a hyphenated word, not bare or glued on, as [DEL_ORGANISATION_n] of the value", async () => {
    const masker = new MaskeraMasker(fakeNer([["Zephyr 2", "ORGANISATION"], ["Byrå Nord", "ORGANISATION"]]));
    const text = "Zephyr 2 lanseras. Zephyr-teamet och Zephyrmötet. Zephyr själv. Byrå Nord och Byråchefen.";
    const entities = await masker.mask(text, none);
    expect(summary(entities)).toEqual(["[ORGANISATION_1]=Zephyr 2:model", "[ORGANISATION_2]=Byrå Nord:model"]);
    const { masked, key } = masker.applyMask(text, entities, []);
    expect(masked).toBe("[ORGANISATION_1] lanseras. [DEL_ORGANISATION_1]-teamet och Zephyrmötet. Zephyr själv. [ORGANISATION_2] och Byråchefen.");
    expect(key.entries.find((e) => e.type === "DEL_ORGANISATION")).toEqual({ placeholder: "[DEL_ORGANISATION_1]", value: "Zephyr", type: "DEL_ORGANISATION" });
    expect(masker.restore(masked, key).text).toBe(text);
  });

  it("links the word of a word-list term the same way, and restores the compound as written", async () => {
    const masker = new MaskeraMasker(fakeNer([]));
    const text = "Aurora X släpps i maj. Aurora-lanseringen är hemlig. Projekt Havsvind och Havsvindsteamet.";
    const entities = await masker.mask(text, { wordList: ["Aurora X", "Projekt Havsvind"], manual: [] });
    expect(summary(entities)).toEqual(["[ORD_1]=Aurora X:wordlist", "[ORD_2]=Projekt Havsvind:wordlist"]);
    const { masked, key } = masker.applyMask(text, entities, ["Aurora X", "Projekt Havsvind"]);
    expect(masked).toBe("[ORD_1] släpps i maj. [DEL_ORD_1]-lanseringen är hemlig. [ORD_2] och [DEL_ORD_2]steamet.");
    expect(masker.restore(masked, key).text).toBe(text);
  });
});

describe("a company the model takes for a person", () => {
  it("is typed and spread as a company", async () => {
    const masker = new MaskeraMasker(fakeNer([["Arla", "NAMN"]]));
    expect(summary(await masker.mask("Pitchen för Arla gick bra. Arlaavtalet är klart.", none))).toEqual(["[ORGANISATION_1]=Arla:model"]);
  });
});

describe("plain words the model tacks onto a name", () => {
  it("are trimmed, also when the model split them off the name", async () => {
    const masker = new MaskeraMasker(fakeNer([["Our", "NAMN"], ["contact", "NAMN"], ["Johan Nilsson", "NAMN"]]));
    expect(summary(await masker.mask("Our contact Johan Nilsson presents.", none))).toEqual(["[NAMN_1]=Johan Nilsson:model"]);
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

// Stands in for the model and records every call, so a test can count runs.
function countingNer(marks: Array<[string, EntityType]>) {
  const calls: string[] = [];
  let failNext = false;
  const backend: NerBackend = {
    init: async () => {},
    detect: async (text) => {
      calls.push(text);
      await new Promise((r) => setTimeout(r, 1));
      if (failNext) {
        failNext = false;
        throw new Error("worker died");
      }
      return fakeNer(marks).detect(text);
    },
  };
  return {
    backend,
    calls,
    failOnce: () => {
      failNext = true;
    },
  };
}

const longText = (n: number) => "Anna Berg ringde om avtalet. ".repeat(n);

describe("MaskeraMasker.mask on a long text", () => {
  it("sends the text in parts and reports progress up to the whole text", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = longText(150);
    const seen: number[] = [];
    const entities = await masker.mask(text, none, { onProgress: (done, total) => seen.push(done / total) });
    expect(calls.length).toBeGreaterThan(2);
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(entities.find((e) => e.value === "Anna Berg")?.occurrences).toHaveLength(150);
  });

  it("finds a name that a cut between words splits, once", async () => {
    const { backend } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = `${"ord ".repeat(298)}Anna Berg ${"ord ".repeat(400)}`;
    const entities = await masker.mask(text, none);
    expect(entities.map((e) => e.value)).toEqual(["Anna Berg"]);
    expect(entities[0].occurrences).toHaveLength(1);
  });

  it("runs the model once for the same text, during and after the run", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = longText(150);
    const first = masker.mask(text, none);
    const joined: number[] = [];
    const second = masker.mask(text, none, { onProgress: (done) => joined.push(done) });
    await Promise.all([first, second]);
    const after = calls.length;
    await masker.mask(text, { wordList: ["avtalet"], manual: [] });
    expect(calls.length).toBe(after);
    expect(joined.length).toBeGreaterThan(1);
    expect(joined[0]).toBe(0);
  });

  it("stops a run when a different text comes, and rejects it", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const old = masker.mask(longText(150), none);
    await new Promise((r) => setTimeout(r, 2));
    const fresh = masker.mask("Erik Holm ringde.", none);
    await expect(old).rejects.toMatchObject({ name: "AbortError" });
    await fresh;
    expect(calls.filter((c) => c.startsWith("Anna")).length).toBeLessThan(splitCount(longText(150)));
  });

  it("does not keep a run that failed, so the next call tries again", async () => {
    const { backend, calls, failOnce } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    failOnce();
    await expect(masker.mask("Anna Berg ringde.", none)).rejects.toThrow("worker died");
    const entities = await masker.mask("Anna Berg ringde.", none);
    expect(entities.map((e) => e.value)).toEqual(["Anna Berg"]);
    expect(calls).toHaveLength(2);
  });

  it("drops the run on reset, so the next call runs the model again", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    await masker.mask("Anna Berg ringde.", none);
    masker.reset();
    await masker.mask("Anna Berg ringde.", none);
    expect(calls).toHaveLength(2);
  });
});

// Stands in for a model whose answers the test releases by hand, so something
// can happen while a part is being read.
function heldNer(marks: Array<[string, EntityType]>) {
  const waiting: Array<() => void> = [];
  const backend: NerBackend = {
    init: async () => {},
    detect: (text) => new Promise((resolve) => waiting.push(() => void fakeNer(marks).detect(text).then(resolve))),
  };
  return { backend, release: () => waiting.splice(0).forEach((go) => go()) };
}

describe("MaskeraMasker.mask while its only part is being read", () => {
  it("drops the run on reset: the old call rejects and its names never reach the new numbering", async () => {
    const { backend, release } = heldNer([
      ["Anna Svensson", "NAMN"],
      ["Bertil Berg", "NAMN"],
    ]);
    const masker = new MaskeraMasker(backend);
    const old = masker.mask("Hej Anna Svensson.", none);
    masker.reset();
    release();
    await expect(old).rejects.toMatchObject({ name: "AbortError" });
    const next = masker.mask("Bertil Berg ringde.", none);
    release();
    expect(summary(await next)).toEqual(["[NAMN_1]=Bertil Berg:model"]);
  });

  it("rejects the old call when a new text comes during its last part", async () => {
    const { backend, release } = heldNer([["Anna Svensson", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const old = masker.mask("Hej Anna Svensson.", none);
    const fresh = masker.mask("Hej igen.", none);
    release();
    await expect(old).rejects.toMatchObject({ name: "AbortError" });
    release();
    await fresh;
  });
});
