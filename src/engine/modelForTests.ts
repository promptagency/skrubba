// The real model for the Node tests (*.model.test.ts), from .cache/model-src/
// (npm run fetch-model). Not imported by the app.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MODEL, MODEL_SRC_DIR } from "../config.ts";
import type { NerBackend } from "./ner.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";

export const modelPresent = existsSync(join(MODEL_SRC_DIR, MODEL.directory, MODEL.onnxFile));
export const recognizer = createRecognizer({ localModelPath: MODEL_SRC_DIR, device: "cpu" });
export const backend: NerBackend = { init: () => recognizer.ready, detect: (text) => modelSpans(text, recognizer) };

/**
 * Whether to run the model tests here. Node runs the model on native ONNX
 * Runtime, whose int8 maths saturates on x86 processors without VNNI: on
 * some GitHub runners (AMD EPYC 7763 and 9V74) the model then finds nothing
 * at all. Users are not affected, since the browser runs the model in
 * WebAssembly, which gives the same results on every processor
 * (tests/e2e/model.spec.ts checks that). So on CI such a runner skips the
 * model tests, with a warning, instead of failing; on a developer machine
 * they always run, and fail loudly if the model is broken.
 */
export async function runModelTests(): Promise<boolean> {
  if (!modelPresent) return false;
  if (!process.env.CI) return true;
  await recognizer.ready;
  if ((await recognizer.detect("Johan Lindqvist bor i Umeå.")).length > 0) return true;
  console.warn("Skipping the model tests: native ONNX Runtime finds nothing on this CPU (int8 without VNNI).");
  return false;
}
