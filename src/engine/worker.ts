// Web Worker: loads the model and runs NER. The only place transformers.js
// runs in the browser; the main thread never blocks on inference.
import { env } from "@huggingface/transformers";
import { MODEL, MODEL_BASE, RUNTIME_BASE, RUNTIME_FILES } from "../config.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";
import { type PackedManifest, partUrl, unpack } from "./packed.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

const post = (msg: FromWorker) => postMessage(msg);
const plainFetch = env.fetch;

async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Large files are served gzipped in parts (Cloudflare's 25 MiB per-file cap,
// and fewer bytes). /packed.json says which; every request for one of them
// goes through `unpack`, which also feeds the loading percentage.
let manifest: Promise<PackedManifest> | null = null;
const getManifest = () =>
  (manifest ??= plainFetch("/packed.json").then((r: Response) => {
    if (!r.ok) throw new Error(`packed.json: ${r.status}`);
    return r.json() as Promise<PackedManifest>;
  }));

const loadedByFile = new Map<string, number>();
let lastPct = -1;
async function reportProgress(path: string, loaded: number) {
  loadedByFile.set(path, loaded);
  const total = Object.values(await getManifest()).reduce((n, info) => n + info.packedBytes, 0);
  const sum = [...loadedByFile.values()].reduce((n, x) => n + x, 0);
  const pct = Math.floor((sum / total) * 100);
  if (pct === lastPct) return;
  lastPct = pct;
  post({ type: "progress", loaded: sum, total });
}

env.fetch = async (input, init) => {
  const url = new URL(String(input), self.location.href);
  const info = url.origin === self.location.origin ? (await getManifest())[url.pathname] : undefined;
  if (!info || init?.method === "HEAD") return plainFetch(input, init);
  return unpack(
    (i) => plainFetch(partUrl(url.pathname, i)),
    info.parts,
    (n) => void reportProgress(url.pathname, n),
  );
};

// The ONNX runtime, from our origin, never jsDelivr. We hand it the wasm
// bytes ourselves (unpacked). useWasmCache would load the .mjs as a blob: URL,
// which our CSP blocks.
env.useWasmCache = false;
const wasm = env.backends.onnx?.wasm;
const wasmPath = `${RUNTIME_BASE}${RUNTIME_FILES.wasm}`;
if (wasm) wasm.wasmPaths = { mjs: `${RUNTIME_BASE}${RUNTIME_FILES.mjs}`, wasm: wasmPath };

async function loadRuntime(): Promise<void> {
  if (!wasm) throw new Error("onnxruntime wasm backend missing");
  const bytes = await (await env.fetch(wasmPath)).arrayBuffer();
  const info = (await getManifest())[wasmPath];
  if (!info || (await sha256(bytes)) !== info.sha256) throw new Error("runtime checksum mismatch");
  wasm.wasmBinary = new Uint8Array(bytes);
}

// sha256 of the weights onnxruntime was handed, read back from
// transformers.js's own Cache Storage entry (a local read). localModelPath
// disables maskera's hash check, so a poisoned deploy or cache would otherwise
// go unnoticed.
async function verifyWeights(): Promise<void> {
  const path = `${MODEL_BASE}${MODEL.directory}/${MODEL.onnxFile}`;
  let res: Response | undefined;
  if (typeof caches !== "undefined") {
    res = await caches
      .open(env.cacheKey)
      .then((c) => c.match(path))
      .catch(() => undefined);
  }
  if (!res) res = (await env.fetch(path)) as Response;
  if (!res.ok) throw new Error(`could not read ${path}: ${res.status}`);
  if ((await sha256(await res.arrayBuffer())) !== MODEL.files[MODEL.onnxFile]) throw new Error("model checksum mismatch");
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
