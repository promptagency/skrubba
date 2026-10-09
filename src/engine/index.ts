export type * from "./Masker.ts";
import { MaskeraMasker } from "./maskeraMasker.ts";
import { createWorkerBackend } from "./workerBackend.ts";

export function createBrowserMasker(): MaskeraMasker {
  return new MaskeraMasker(createWorkerBackend());
}
