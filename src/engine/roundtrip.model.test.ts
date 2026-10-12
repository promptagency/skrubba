// Runs the real model from .cache/model-src/ (npm run fetch-model). Slow: loads
// the model once, then ~20 ms per sentence.
import { beforeAll, describe, expect, it } from "vitest";
import { SENTENCES } from "./fixtures/sentences.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { backend, runModelTests } from "./modelForTests.ts";

const run = await runModelTests();

const leaks = (masked: string, secrets: string[]) =>
  secrets.filter((s) => masked.toLowerCase().includes(s.toLowerCase()));

describe.skipIf(!run)("round trip with the real model", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  it.each(SENTENCES)("$text", async ({ text, secrets }) => {
    const masker = new MaskeraMasker(backend);
    const entities = await masker.mask(text, { wordList: [], manual: [] });
    const { masked, key } = masker.applyMask(text, entities, []);
    expect(leaks(masked, secrets)).toEqual([]);
    expect(masker.restore(masked, key).text).toBe(text);
  });
});
