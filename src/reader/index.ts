// Reading documents (PDF, Word and others) into text, in the browser. The
// only part of src/reader/ the UI imports. See docs/ARCHITECTURE.md.
import { LIMITS } from "./limits.ts";
import type { FromReader, ToReader } from "./protocol.ts";
import type { Progress, ReadResult } from "./types.ts";

export type { ErrorReason, Format, Note, ReadResult, Stats } from "./types.ts";

export interface ReadOptions {
  onProgress?: Progress;
  signal?: AbortSignal;
}

/** Reads a file in a worker of its own. Rejects with an AbortError when `signal` aborts. */
export function readDocument(file: File, opts: ReadOptions = {}): Promise<ReadResult> {
  if (file.size > LIMITS.fileBytes) return Promise.resolve({ kind: "error", reason: "tooLarge" });
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./readerWorker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const stop = () => {
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      opts.signal?.removeEventListener("abort", onAbort);
    };
    const finish = (result: ReadResult) => {
      if (settled) return;
      stop();
      resolve(result);
    };
    const onAbort = () => {
      if (settled) return;
      stop();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => finish({ kind: "error", reason: "timeout" }), LIMITS.timeoutMs);
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener("abort", onAbort);
    worker.onmessage = (e: MessageEvent<FromReader>) => {
      if (e.data.type === "progress") opts.onProgress?.(e.data.page, e.data.pages);
      else finish(e.data.result);
    };
    worker.onerror = () => finish({ kind: "error", reason: "failed" });
    file.arrayBuffer().then(
      (bytes) => {
        if (settled) return;
        const msg: ToReader = { bytes, name: file.name };
        worker.postMessage(msg, [bytes]);
      },
      () => finish({ kind: "error", reason: "failed" }),
    );
  });
}
