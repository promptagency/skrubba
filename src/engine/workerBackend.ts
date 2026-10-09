import type { Progress, Span } from "./Masker.ts";
import type { NerBackend } from "./ner.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

/** NER in a Web Worker. See the worker protocol in docs/ARCHITECTURE.md. */
export function createWorkerBackend(): NerBackend {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const send = (msg: ToWorker) => worker.postMessage(msg);
  const pending = new Map<number, { resolve: (s: Span[]) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let onInit: { resolve: () => void; reject: (e: Error) => void; progress: (p: Progress) => void } | null = null;

  worker.onmessage = (e: MessageEvent<FromWorker>) => {
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
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || "worker failed");
    onInit?.reject(err);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };

  return {
    init(onProgress) {
      return new Promise<void>((resolve, reject) => {
        onInit = { resolve, reject, progress: onProgress };
        send({ type: "init" });
      });
    },
    detect(text) {
      const id = nextId++;
      return new Promise<Span[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: "ner", id, text });
      });
    },
  };
}
