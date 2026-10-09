// Runs the real model from public/models/ (npm run fetch-model). Slow: loads
// the model once, then ~20 ms per sentence.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MODEL } from "../config.ts";
import { SENTENCES } from "./fixtures/sentences.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import type { NerBackend } from "./ner.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";

const modelPresent = existsSync(join("public/models", MODEL.directory, MODEL.onnxFile));
const recognizer = createRecognizer({ localModelPath: "public/models/", device: "cpu" });
const backend: NerBackend = {
  init: () => recognizer.ready,
  detect: (text) => modelSpans(text, recognizer),
};

const leaks = (masked: string, secrets: string[]) =>
  secrets.filter((s) => masked.toLowerCase().includes(s.toLowerCase()));

describe.skipIf(!modelPresent)("round trip with the real model", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it.each(SENTENCES)("$text", async ({ text, secrets }) => {
    const masker = new MaskeraMasker(backend);
    const entities = await masker.mask(text, { wordList: [], manual: [] });
    const { masked, key } = masker.applyMask(text, entities, []);
    expect(leaks(masked, secrets)).toEqual([]);
    expect(masker.restore(masked, key).text).toBe(text);
  });
});
