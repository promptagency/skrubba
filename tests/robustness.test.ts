// The robustness exam. Seven pass/fail properties:
// 1 no leaks, 2 known leaks only shrink, 3 lossless round trip, 4 keeps stay
// (these four through the real model, npm run fetch-model), 5 tolerant
// restore as documented in docs/ARCHITECTURE.md, 6 hostile files end as text
// or a named error in time, 7 linear growth of reading and masking.
// REQUIRE_MODEL=1 makes a missing or skipped model fail the run.
import { performance } from "node:perf_hooks";
import { beforeAll, describe, expect, it } from "vitest";
import type { Key } from "../src/engine/Masker.ts";
import { MaskeraMasker } from "../src/engine/maskeraMasker.ts";
import { backend, modelPresent, runModelTests } from "../src/engine/modelForTests.ts";
import { tolerantRestore } from "../src/engine/tolerantRestore.ts";
import { extract } from "../src/reader/extract.ts";
import { LIMITS } from "../src/reader/limits.ts";
import { buildDocx, latin1, wp } from "./fixtures/documents/build.ts";
import { CASES, KNOWN_LEAK_BASELINE } from "./fuzz/cases.ts";
import { ALIAS_FORMS, MANGLES, personnummer } from "./fuzz/generate.ts";
import { HOSTILE } from "./fuzz/hostile.ts";

const PNR = personnummer("850709", "123");
const run = await runModelTests();
const requireModel = process.env.REQUIRE_MODEL === "1";
if (!run && !requireModel) console.warn("Robustness exam: model cases skipped (no model, or a CPU it cannot run on).");

const leaks = (masked: string, secrets: string[]) => secrets.filter((s) => masked.toLowerCase().includes(s.toLowerCase()));

/**
 * The same pattern as src/reader/textBuilder.test.ts: one warm-up, the best of
 * two big runs (free of a GC pause), the median of three small ones. Measured
 * up to three times, keeping the lowest ratio: with the whole suite running
 * beside it, the linear RTF reader measured 22–24 against about 9 alone, while
 * a quadratic step gives about 100 every time.
 */
async function growth(timed: (scale: number) => Promise<number>, limit = 20): Promise<number> {
  let best = Infinity;
  for (let attempt = 0; attempt < 3 && best >= limit; attempt++) {
    await timed(1);
    const big = Math.min(await timed(10), await timed(10));
    const small = [await timed(1), await timed(1), await timed(1)].sort((a, b) => a - b)[1];
    best = Math.min(best, big / small);
  }
  return best;
}

const clock = async (fn: () => unknown) => {
  const started = performance.now();
  await fn();
  return performance.now() - started;
};

describe("the model", () => {
  it.runIf(requireModel)("is present and runs (REQUIRE_MODEL=1)", () => {
    expect(modelPresent, "model missing: npm run fetch-model").toBe(true);
    expect(run, "model tests would be skipped on this machine").toBe(true);
  });
});

describe.skipIf(!run)("text cases through the real model", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it("2. known leaks only shrink: flagged cases stay at or under the baseline", () => {
    expect(CASES.filter((c) => c.knownLeak).length).toBeLessThanOrEqual(KNOWN_LEAK_BASELINE);
  });

  for (const c of CASES) {
    describe(c.probe, () => {
      let masked = "";
      let key: Key;
      let masker: MaskeraMasker;
      beforeAll(async () => {
        masker = new MaskeraMasker(backend);
        const wordList = c.wordList ?? [];
        const entities = await masker.mask(c.text, { wordList, manual: [] });
        ({ masked, key } = masker.applyMask(c.text, entities, wordList));
      }, 60_000);

      if (c.knownLeak) {
        it("2. known leak: logged when fixed", () => {
          if (leaks(masked, c.secrets).length === 0) console.log(`Known leak fixed, owner can unflag: ${c.probe}`);
        });
      } else {
        it("1. no leaks", () => expect(leaks(masked, c.secrets), masked).toEqual([]));
      }
      it("3. lossless round trip", () => expect(masker.restore(masked, key).text.toLowerCase()).toBe(c.text.toLowerCase()));
      it("4. keeps stay", () => expect((c.keeps ?? []).filter((k) => !masked.includes(k)), masked).toEqual([]));
    });
  }
});

describe("5. tolerant restore", () => {
  const VALUES: Record<string, string> = {
    NAMN: "Tilda Granqvist",
    FÖRNAMN: "Tilda",
    EFTERNAMN: "Granqvist",
    PLATS: "Hagfors",
    ORGANISATION: "Brännvik Konsult AB",
    DEL_ORGANISATION: "Brännvik",
    ADRESS: "Lingonstigen 14B",
    EPOST: "tilda@exempel.se",
    TELEFON: "070-123 45 67",
    PERSONNUMMER: PNR,
    IP_ADRESS: "10.0.0.7",
    ORD: "Lodjur",
    DEL_ORD: "Nimbus",
  };
  const key: Key = {
    entries: Object.entries(VALUES).map(([type, value]) => ({ placeholder: `[${type}_1]`, value, type: type as Key["entries"][number]["type"] })),
    wordList: [],
    createdAt: "2026-11-11T00:00:00.000Z",
    app: "skrubba",
    version: 1,
  };
  const wrap = (form: string) => `Svar: ${form} ska kontaktas.`;

  for (const m of MANGLES) {
    describe(m.probe, () => {
      it.each(Object.keys(VALUES))("%s", (type) => {
        const value = VALUES[type];
        const form = m.form(type, 1);
        const text = wrap(form);
        const result = tolerantRestore(text, key);
        const restoredText = wrap((m.restored ?? ((v: string) => v))(value));
        if (m.expect === "silent") {
          expect(result.text).toBe(restoredText);
          expect(result.suggestions).toEqual([]);
        } else if (m.expect === "suggest") {
          expect(result.text, "a suggestion is not applied before it is accepted").toBe(text);
          expect(result.suggestions.map((s) => s.placeholder)).toEqual([`[${type}_1]`]);
          expect(tolerantRestore(text, key, new Set(result.suggestions.map((s) => s.found))).text).toBe(restoredText);
        } else {
          expect(result).toMatchObject({ text, restored: [], suggestions: [], unknown: [] });
        }
        expect(result.unknown).toEqual([]);
      });
    });
  }

  it.each(ALIAS_FORMS)("translated type %s_1 is a suggestion for %s", (alias, type) => {
    const text = wrap(`[${alias}_1]`);
    const result = tolerantRestore(text, key);
    expect(result.text).toBe(text);
    expect(result.suggestions.map((s) => s.placeholder)).toEqual([`[${type}_1]`]);
  });

  it.each(["[NAMN_99]", "NAMN_2", "namn_7", "[NAMN_099]", "NAMN 42", "[PERSON_99]", "[ORD_3]s", "`EPOST_5`"])(
    "unknown number %s is reported and never restored",
    (form) => {
      const text = wrap(form);
      const result = tolerantRestore(text, key, new Set([form]));
      expect(result.text).toBe(text);
      expect(result.unknown).toHaveLength(1);
      expect(result.suggestions).toEqual([]);
    },
  );
});

describe("6. hostile files end as text or a named error, in time", () => {
  const REASONS = ["unsupported", "encrypted", "empty", "noText", "tooLarge", "timeout", "failed"];
  for (const h of HOSTILE) {
    it(
      `${h.probe} (${h.name})`,
      async () => {
        const started = performance.now();
        const result = await extract(h.bytes(), h.name);
        expect(performance.now() - started).toBeLessThan(LIMITS.timeoutMs);
        if (result.kind === "text") expect(result.text.length).toBeLessThanOrEqual(LIMITS.textChars);
        else expect(REASONS).toContain(result.reason);
        if (h.reason) expect(result).toEqual({ kind: "error", reason: h.reason });
      },
      LIMITS.timeoutMs + 5_000,
    );
  }
});

describe("7. linear growth: ten times the input takes at most twenty times as long", () => {
  const LINE = `Tilda Granqvist, ${PNR}, ringer 070-123 45 67 om Lingonstigen 14B, 123 45 Hagfors.`;
  const READERS: Array<[name: string, file: string, make: (n: number) => Uint8Array]> = [
    ["txt", "brev.txt", (n) => new TextEncoder().encode(`${LINE}\n`.repeat(n))],
    ["csv", "lista.csv", (n) => new TextEncoder().encode(`Namn;Nummer;Ort\n${`Tilda Granqvist;${PNR};Hagfors\n`.repeat(n)}`)],
    ["html", "sida.html", (n) => new TextEncoder().encode(`<table>${`<tr><td>${LINE}</td><td>x</td></tr>`.repeat(n)}</table>`)],
    ["rtf", "brev.rtf", (n) => latin1(`{\\rtf1 ${`Tilda Granqvist\\tab Hagfors\\par `.repeat(n)}}`)],
    ["docx", "avtal.docx", (n) => buildDocx({ body: wp(LINE).repeat(n) })],
  ];
  for (const [name, file, make] of READERS) {
    it(`reader: ${name}`, async () => {
      const inputs = { 1: make(2_000), 10: make(20_000) };
      const ratio = await growth((s) => clock(() => extract(inputs[s as 1 | 10], file)));
      expect(ratio).toBeLessThan(20);
    }, 60_000);
  }

  it("masking with rules, mask and restore", async () => {
    const masker = new MaskeraMasker(backend);
    // The old quadratic resolveSpans measured 22 at 500 and 5 000 lines, 26 at these sizes.
    const texts = { 1: `${LINE}\n`.repeat(1_000), 10: `${LINE}\n`.repeat(10_000) };
    const ratio = await growth((s) =>
      clock(() => {
        const text = texts[s as 1 | 10];
        const entities = masker.maskRules(text, { wordList: ["Lodjur"], manual: [] });
        const { masked, key } = masker.applyMask(text, entities, ["Lodjur"]);
        masker.restore(masked, key);
      }),
    );
    expect(ratio).toBeLessThan(20);
  }, 60_000);

  it.skipIf(!run)("masking with the model", async () => {
    await backend.init(() => {});
    const masker = new MaskeraMasker(backend);
    // Distinct texts each run, so a run never joins the last one's model result.
    let salt = 0;
    const ratio = await growth((s) =>
      clock(() => masker.mask(`Ärende ${++salt}.\n${`${LINE}\n`.repeat(8 * s)}`, { wordList: [], manual: [] })),
    );
    expect(ratio).toBeLessThan(20);
  }, 600_000);
});
