import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkerBackend, DETECT_TIMEOUT_MS } from "./workerBackend.ts";

// A worker that never answers.
class SilentWorker {
  onmessage: unknown = null;
  onerror: unknown = null;
  postMessage(): void {}
}

describe("createWorkerBackend", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up on a part the worker never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", SilentWorker);
    const detect = createWorkerBackend().detect("Anna Berg");
    const outcome = detect.then(
      () => "answered",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(DETECT_TIMEOUT_MS);
    expect(await outcome).toBe("the model did not answer in time");
  });
});
