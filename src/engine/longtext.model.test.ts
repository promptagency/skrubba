// 10 000 characters through the real model: nothing leaks where maskera
// splits long text into chunks, and it is fast enough. Uses the raw model
// in .cache/model-src/ (npm run fetch-model).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { beforeAll, describe, expect, it } from "vitest";
import { MODEL, MODEL_SRC_DIR } from "../config.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import type { NerBackend } from "./ner.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";

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

const modelPresent = existsSync(join(MODEL_SRC_DIR, MODEL.directory, MODEL.onnxFile));
const recognizer = createRecognizer({ localModelPath: MODEL_SRC_DIR, device: "cpu" });
const backend: NerBackend = { init: () => recognizer.ready, detect: (text) => modelSpans(text, recognizer) };

describe.skipIf(!modelPresent)("10 000 characters", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it("masks every name, including at chunk boundaries", async () => {
    const { text, names } = longText();
    expect(text.length).toBeGreaterThanOrEqual(10_000);
    const masker = new MaskeraMasker(backend);
    const { masked } = masker.applyMask(text, await masker.mask(text, { wordList: [], manual: [] }), []);
    const leaked = names.filter((n) => masked.includes(n.split(" ")[1]));
    expect(leaked).toEqual([]);
  }, 60_000);

  it("runs the rules in under 50 ms", () => {
    const { text } = longText();
    const masker = new MaskeraMasker(backend);
    masker.maskRules(text, { wordList: [], manual: [] }); // warm up
    const t0 = performance.now();
    masker.maskRules(text, { wordList: [], manual: [] });
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
