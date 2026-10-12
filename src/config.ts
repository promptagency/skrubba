export const APP_NAME = "Skrubba";
export const APP_SLUG = "skrubba";
export const APP_URL = "https://skrubba.promptagency.se";
/** Public repository, linked from "GitHub" in the footer credits. Empty until the repo is public. */
export const REPO_URL = "";
/** Linked from the footer byline. */
export const AUTHOR_URL = "https://mickequick.se";
export const AGENCY_URL = "https://promptagency.se";

// Self-hosted NER model (scripts/fetch-model.ts packs it into public/models/).
// The directory carries the revision so a new model gets a new URL: the
// browser caches model files by URL and never revalidates them.
export const MODEL = {
  hubId: "joelhagvall/maskera-sv-ner",
  revision: "7a0063375d1baabf66cf9a357dad5f46aea7008e",
  directory: "maskera-sv-ner-7a00633",
  dtype: "q8",
  onnxFile: "onnx/model_quantized.onnx",
  // Size of onnxFile, for the loading percentage (servers may omit content-length).
  onnxBytes: 58_903_657,
  // sha256 per file at `revision`, from maskera's own pinned map.
  files: {
    "config.json": "9a4345c97bba5b637fbb07779d56d45b0bac707bc413b623c99caa51bde125cc",
    "tokenizer.json": "a600e32448f4ebb0bffcd4cfd69ead75b2f982058ea65b15d9e3e535c1e83ae1",
    "tokenizer_config.json": "3cf57fee187ab68479948ee43ecdb9054869fa9c232783f4f32d00a01669db4a",
    "special_tokens_map.json": "5d5b662e421ea9fac075174bb0688ee0d9431699900b90662acd44b2a350503a",
    "vocab.txt": "8bf12559050ca14571d3108164a6a6a6100b1342bf39142d68079b21288202f2",
    "onnx/model_quantized.onnx": "08a9b82124721492b212a0832f3ffd731ff50ea26bdbb1152672f1f36717aaa7",
  } as Record<string, string>,
} as const;

export const MODEL_BASE = "/models/";
export const RUNTIME_BASE = "/runtime/";
/** Raw model files for Node (tests, spike). Not served. */
export const MODEL_SRC_DIR = ".cache/model-src/";

// onnxruntime-web's plain build. It loads and runs the model in Chromium,
// Firefox and WebKit (tests/e2e/model.spec.ts) and is the smallest variant.
export const RUNTIME_FILES = {
  mjs: "ort-wasm-simd-threaded.mjs",
  wasm: "ort-wasm-simd-threaded.wasm",
} as const;
