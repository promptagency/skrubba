export type * from "./Masker.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { createWorkerBackend } from "./workerBackend.ts";

export function createBrowserMasker(): MaskeraMasker {
  return new MaskeraMasker(createWorkerBackend());
}
export { parseWordList } from "./wordList.ts";
export { keyFileName, mergeEntries, parseKey } from "./key.ts";
export { firstNamePlaceholder, lastNamePlaceholder, placeholderOf } from "./entities.ts";
export { ENTITY_TYPES } from "./Masker.ts";
