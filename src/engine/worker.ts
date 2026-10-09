// Web Worker: loads the model and runs NER. The only place transformers.js
// runs in the browser; the main thread never blocks on inference.
import { env } from "@huggingface/transformers";
import { MODEL, MODEL_BASE, RUNTIME_BASE } from "../config.ts";
import { createRecognizer, modelSpans } from "./nerModel.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

const post = (msg: FromWorker) => postMessage(msg);

// Serve the ONNX runtime from our origin, never jsDelivr.
const wasm = env.backends.onnx?.wasm;
if (wasm) wasm.wasmPaths = RUNTIME_BASE;

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
  res ??= await fetch(path);
  if (!res.ok) throw new Error(`could not read ${path}: ${res.status}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await res.arrayBuffer()));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== MODEL.files[MODEL.onnxFile]) throw new Error("model checksum mismatch");
}

let ready: Promise<ReturnType<typeof createRecognizer>> | null = null;

function load() {
  ready ??= (async () => {
    // Self-hosted models report coarse start/done events only.
    const recognizer = createRecognizer({
      device: "wasm",
      onProgress: (p) => {
        if (p.status === "initiate") post({ type: "progress", loaded: 0, total: 1 });
      },
    });
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
