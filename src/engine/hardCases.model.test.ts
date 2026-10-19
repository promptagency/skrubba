// Hard texts through the real model (npm run fetch-model). Each case must mask
// every secret and restore to the original, up to case: an entity has one
// stored spelling, so "johan" next to "Johan Lindqvist" comes back as "Johan".
// A case the engine cannot handle yet is listed in KNOWN_FAILURES, so the
// test fails when it starts passing.
import { beforeAll, describe, expect, it } from "vitest";
import { HARD_CASES } from "./fixtures/hardCases.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { backend, runModelTests } from "./modelForTests.ts";

const run = await runModelTests();

const KNOWN_FAILURES = new Set<string>([]);

const leaks = (masked: string, secrets: string[]) =>
  secrets.filter((s) => masked.toLowerCase().includes(s.toLowerCase()));

describe.skipIf(!run)("hard cases with the real model", () => {
  beforeAll(() => backend.init(() => {}), 60_000);

  for (const { text, secrets, wordList = [] } of HARD_CASES) {
    const test = KNOWN_FAILURES.has(text) ? it.fails : it;
    test(text, async () => {
      const masker = new MaskeraMasker(backend);
      const entities = await masker.mask(text, { wordList, manual: [] });
      const { masked, key } = masker.applyMask(text, entities, wordList);
      expect(leaks(masked, secrets), masked).toEqual([]);
      expect(masker.restore(masked, key).text.toLowerCase()).toBe(text.toLowerCase());
    });
  }
});
