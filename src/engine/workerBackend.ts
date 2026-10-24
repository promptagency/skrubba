import type { Progress, Span } from "./Masker.ts";
import type { NerBackend } from "./ner.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

/** A part is at most 1 200 characters; a slow phone needs seconds, not a minute. */
export const DETECT_TIMEOUT_MS = 60_000;

/** NER in a Web Worker. See the worker protocol in docs/ARCHITECTURE.md. */
export function createWorkerBackend(): NerBackend {
  // Created on first use, not here: a worker started before the service
  // worker controls the page would bypass its cache.
  let worker: Worker | null = null;
  const send = (msg: ToWorker) => (worker ??= start()).postMessage(msg);
  const pending = new Map<number, { resolve: (s: Span[]) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let initPromise: Promise<void> | null = null;
  let onInit: { resolve: () => void; reject: (e: Error) => void; progress: (p: Progress) => void } | null = null;

  function start(): Worker {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.onmessage = onMessage;
    w.onerror = onError;
    return w;
  }

  function onMessage(e: MessageEvent<FromWorker>) {
    const msg = e.data;
    switch (msg.type) {
      case "progress":
        onInit?.progress({ loaded: msg.loaded, total: msg.total });
        return;
      case "ready":
        onInit?.progress({ loaded: 1, total: 1 });
        onInit?.resolve();
        return;
      case "ner-result":
        pending.get(msg.id)?.resolve(msg.spans);
        pending.delete(msg.id);
        return;
      case "error":
        if (msg.id === undefined) onInit?.reject(new Error(msg.message));
        else {
          pending.get(msg.id)?.reject(new Error(msg.message));
          pending.delete(msg.id);
        }
    }
  }

  function onError(e: ErrorEvent) {
    const err = new Error(e.message || "worker failed");
    onInit?.reject(err);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  }

  return {
    init(onProgress, options = { browserCache: true }) {
      // Idempotent: React StrictMode runs effects twice in dev.
      initPromise ??= new Promise<void>((resolve, reject) => {
        onInit = { resolve, reject, progress: (p) => onProgress(p) };
        send({ type: "init", browserCache: options.browserCache });
      });
      return initPromise;
    },
    detect(text) {
      const id = nextId++;
      return new Promise<Span[]>((resolve, reject) => {
        // A worker that hangs would otherwise leave the app on "Skrubbar …" for good.
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("the model did not answer in time"));
        }, DETECT_TIMEOUT_MS);
        const settle = <T,>(f: (x: T) => void) => (x: T) => {
          clearTimeout(timer);
          f(x);
        };
        pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
        send({ type: "ner", id, text });
      });
    },
  };
}
