import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkerBackend, DETECT_TIMEOUT_MS } from "./workerBackend.ts";

// A worker that never answers.
const workers: SilentWorker[] = [];
class SilentWorker {
  onmessage: unknown = null;
  onerror: unknown = null;
  sent: unknown[] = [];
  terminated = false;
  constructor() {
    workers.push(this);
  }
  postMessage(msg: unknown): void {
    this.sent.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe("createWorkerBackend", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    workers.length = 0;
  });

  it("gives up on a part the worker never answers, and replaces the worker", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", SilentWorker);
    const backend = createWorkerBackend();
    void backend.init(() => {}, { browserCache: false });
    const outcome = backend.detect("Anna Berg").then(
      () => "answered",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(DETECT_TIMEOUT_MS);
    expect(await outcome).toBe("the model did not answer in time");
    expect(workers.map((w) => w.terminated)).toEqual([true, false]);
    expect(workers[1].sent).toEqual([{ type: "init", browserCache: false }]);
    void backend.detect("Anna Berg");
    expect(workers[1].sent).toHaveLength(2);
    expect(workers).toHaveLength(2);
  });
});
