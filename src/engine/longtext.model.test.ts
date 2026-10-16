// 10 000 characters through the real model: nothing leaks where maskera
// splits long text into chunks, and it is fast enough. Uses the raw model
// in .cache/model-src/ (npm run fetch-model).
import { performance } from "node:perf_hooks";
import { beforeAll, describe, expect, it } from "vitest";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { backend, runModelTests } from "./modelForTests.ts";
import { PART_CHARS, splitForModel } from "./parts.ts";

const FIRST = ["Anna", "Erik", "Sara", "Johan", "Maria", "Lars", "Karin", "Ahmed", "Fatima", "Nils", "Eva", "Oskar", "Lina", "Per", "Ingrid"];
const LAST = ["Berg", "Lindqvist", "Holm", "Ekström", "Hassan", "Sundberg", "Nyberg", "Wallin", "Brandt", "Strand", "Persson", "Lundgren", "Olsson", "Svensson"];
const VERBS = ["ringde om avtalet", "skickade ett mejl om lönen", "var sjuk hela veckan", "bokade ett möte om budgeten"];

// One sentence per unique full name until the text is 10 000 characters.
function longText(): { text: string; names: string[] } {
  const names: string[] = [];
  let text = "";
  for (let i = 0; text.length < 10_000; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    names.push(name);
    text += `Enligt protokollet ${name} ${VERBS[i % VERBS.length]}. `;
    if (i % 6 === 5) text += "\n\n";
  }
  return { text, names: [...new Set(names)] };
}

// Transcribed speech: no full stops, so every part ends between words and
// overlaps the next. Each name occurs once (so spreading a name found
// elsewhere cannot hide a miss) and sits right across a part's limit: the
// space inside the name is the last whitespace before it, so the cut falls
// between first and last name.
// Not ending in "ekonomin": right before a name, the model takes that word for
// the name and misses the real one, with or without parts (seen 2026-10-16).
const FILLER = "och sen sa att vi skulle ta det på mötet i morgon".split(" ");

function runOnText(): { text: string; names: string[] } {
  const names: string[] = [];
  let text = "";
  let partStart = 0;
  let w = 0;
  for (let i = 0; i < 5; i++) {
    const [first, last] = [FIRST[i], LAST[i]];
    const limit = partStart + PART_CHARS;
    // Filler up to just before the limit, then "First " ending one character before it.
    while (text.length + FILLER[w % FILLER.length].length + 1 + first.length + 1 < limit - 1) text += `${FILLER[w++ % FILLER.length]} `;
    text += " ".repeat(limit - 1 - first.length - 1 - text.length);
    text += `${first} ${last} `;
    names.push(`${first} ${last}`);
    // Where the next part starts, by the splitter itself.
    const parts = splitForModel(`${text}${"och ".repeat(400)}`);
    partStart = parts[i + 1].start;
  }
  return { text: `${text}${FILLER.join(" ")}`, names };
}

const run = await runModelTests();

describe.skipIf(!run)("10 000 characters", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it("masks every name, including at chunk boundaries", async () => {
    const { text, names } = longText();
    expect(text.length).toBeGreaterThanOrEqual(10_000);
    const masker = new MaskeraMasker(backend);
    const { masked } = masker.applyMask(text, await masker.mask(text, { wordList: [], manual: [] }), []);
    const leaked = names.filter((n) => masked.includes(n.split(" ")[1]));
    expect(leaked).toEqual([]);
  }, 60_000);

  it("finds each name whole in a transcript without full stops, even where a part ends inside it", async () => {
    const { text, names } = runOnText();
    // The fixture really puts every name across a cut.
    const cuts = splitForModel(text).map((p) => p.end);
    for (const name of names) {
      const at = text.indexOf(name);
      expect(cuts.some((c) => c > at && c < at + name.length), name).toBe(true);
    }
    const masker = new MaskeraMasker(backend);
    const entities = await masker.mask(text, { wordList: [], manual: [] });
    const found = new Set(entities.map((e) => e.value));
    expect(names.filter((n) => !found.has(n))).toEqual([]);
  }, 120_000);

  it("never misses a name that the model finds in the whole text at once", async () => {
    // Whole words only: a hit inside a word ("protokol" in "protokollet") is a model slip, not a name.
    const letter = /[\p{L}\p{N}]/u;
    const wholeWord = (text: string, s: { start: number; end: number }) =>
      !letter.test(text[s.start - 1] ?? " ") && !letter.test(text[s.end] ?? " ");
    for (const text of [runOnText().text, longText().text]) {
      const whole = (await backend.detect(text))
        .filter((s) => s.type === "NAMN" && wholeWord(text, s))
        .map((s) => text.slice(s.start, s.end));
      const masker = new MaskeraMasker(backend);
      const inParts = new Set((await masker.mask(text, { wordList: [], manual: [] })).map((e) => e.value));
      expect(whole.filter((n) => !inParts.has(n))).toEqual([]);
    }
  }, 240_000);

  it("runs the rules in under 50 ms", () => {
    const { text } = longText();
    const masker = new MaskeraMasker(backend);
    masker.maskRules(text, { wordList: [], manual: [] }); // warm up
    const t0 = performance.now();
    masker.maskRules(text, { wordList: [], manual: [] });
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
