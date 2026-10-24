// Web Worker: loads the model and runs NER. The only place transformers.js
// runs in the browser; the main thread never blocks on inference.
import { env } from "@huggingface/transformers";
import { MODEL, MODEL_BASE, RUNTIME_FILES } from "../config.ts";
import { PACKED, RUNTIME_DIR } from "./assets.generated.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";
import { hashed, partUrl, sha256, unpack } from "./packed.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

const post = (msg: FromWorker) => postMessage(msg);
const plainFetch = env.fetch;
const weightsPath = `${MODEL_BASE}${MODEL.directory}/${MODEL.onnxFile}`;
/** Hash of the weights, computed as they stream to onnxruntime. Null when they came from transformers.js's cache. */
let weightsHash: Promise<string> | null = null;

// Large files are served gzipped in parts (Cloudflare's 25 MiB per-file cap,
// and fewer bytes). PACKED, generated at build time, says which; every
// request for one of them goes through `unpack`, which also feeds the
// loading percentage.
const totalPacked = Object.values(PACKED).reduce((n, info) => n + info.packedBytes, 0);
const loadedByFile = new Map<string, number>();
let lastPct = -1;
function reportProgress(path: string, loaded: number) {
  loadedByFile.set(path, Math.max(loadedByFile.get(path) ?? 0, loaded)); // a file read twice must not run the bar backwards
  const sum = [...loadedByFile.values()].reduce((n, x) => n + x, 0);
  const pct = Math.floor((sum / totalPacked) * 100);
  if (pct === lastPct) return;
  lastPct = pct;
  post({ type: "progress", loaded: sum, total: totalPacked });
}

env.fetch = async (input, init) => {
  const url = new URL(String(input), self.location.href);
  const info = url.origin === self.location.origin ? PACKED[url.pathname] : undefined;
  if (!info || init?.method === "HEAD") return plainFetch(input, init);
  const res = unpack(
    (i) => plainFetch(partUrl(url.pathname, i)),
    info.parts,
    (n) => reportProgress(url.pathname, n),
  );
  if (url.pathname !== weightsPath) return res;
  // Hash the weights on their way to onnxruntime: the check then needs no
  // second download and no second unzip (before 2026-10-24 it re-read them,
  // and the bar ran 0 to 100 twice on every return visit).
  const h = hashed(res);
  weightsHash = h.hash;
  weightsHash.catch(() => {}); // a failed download is reported by the model load itself
  return h.res;
};

// The ONNX runtime, from our origin, never jsDelivr. We hand it the wasm
// bytes ourselves (unpacked). useWasmCache would load the .mjs as a blob: URL,
// which our CSP blocks.
env.useWasmCache = false;
const wasm = env.backends.onnx?.wasm;
const wasmPath = `${RUNTIME_DIR}${RUNTIME_FILES.wasm}`;
if (wasm) wasm.wasmPaths = { mjs: `${RUNTIME_DIR}${RUNTIME_FILES.mjs}`, wasm: wasmPath };

async function loadRuntime(): Promise<void> {
  if (!wasm) throw new Error("onnxruntime wasm backend missing");
  const bytes = await (await env.fetch(wasmPath)).arrayBuffer();
  const info = PACKED[wasmPath];
  if (!info || (await sha256(bytes)) !== info.sha256) throw new Error("runtime checksum mismatch");
  wasm.wasmBinary = new Uint8Array(bytes);
}

// sha256 of the weights onnxruntime was handed. localModelPath disables
// maskera's hash check, so a poisoned deploy or cache would otherwise go
// unnoticed. Hashed on the way in when they were downloaded; when
// transformers.js served them from its own Cache Storage entry instead, they
// are read back from there (a local read).
async function verifyWeights(): Promise<void> {
  let hash = weightsHash;
  if (!hash) {
    const res =
      typeof caches === "undefined"
        ? undefined
        : await caches
            .open(env.cacheKey)
            .then((c) => c.match(weightsPath))
            .catch(() => undefined);
    if (!res) throw new Error(`could not read ${weightsPath} back`);
    hash = res.arrayBuffer().then(sha256);
  }
  if ((await hash) !== MODEL.files[MODEL.onnxFile]) throw new Error("model checksum mismatch");
}

let ready: Promise<ReturnType<typeof createRecognizer>> | null = null;

function load() {
  ready ??= (async () => {
    post({ type: "progress", loaded: 0, total: 1 });
    await loadRuntime();
    const recognizer = createRecognizer({ device: "wasm" });
    await recognizer.ready;
    await verifyWeights();
    return recognizer;
  })();
  return ready;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "init") {
    // With the service worker caching the packed files, transformers.js's own
    // cache would only hold a second, unpacked copy of the model. A slow first
    // visit may have left one (the page gave up waiting for the service
    // worker); drop it now that the packed copy is kept.
    env.useBrowserCache = msg.browserCache;
    if (!msg.browserCache && typeof caches !== "undefined") caches.delete(env.cacheKey).catch(() => {});
    try {
      await load();
      post({ type: "ready" });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  try {
    const recognizer = await load();
    post({ type: "ner-result", id: msg.id, spans: await modelSpans(msg.text, recognizer) });
  } catch (err) {
    post({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
