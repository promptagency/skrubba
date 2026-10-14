// Fetch the pinned NER model and prepare everything the app serves from its
// own origin. Runs before dev and build; skips work that is already done.
//
//   .cache/model-src/<dir>/   raw model files, sha256-checked (Node tests use these)
//   public/models/<dir>/      tokenizer + config as is, ONNX weights gzipped in parts
//   public/runtime/<version>/ onnxruntime-web plain build: .mjs as is, .wasm gzipped
//   src/engine/assets.generated.ts  runtime folder + how each packed file is split,
//                             bundled into the worker (see src/engine/packed.ts)
//
// Every served path except index.html is content-addressed (hashed assets,
// model folder named by revision, runtime folder by version), so the service
// worker can keep the previous build's files for tabs still running it.
// Every file in public/ must stay under Cloudflare Pages' 25 MiB per-file limit.

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MASKERA_SV_NER_MODEL, MASKERA_SV_NER_REVISION } from "maskera";
import { MODEL, MODEL_BASE, MODEL_SRC_DIR, RUNTIME_BASE, RUNTIME_FILES } from "../src/config.ts";
import type { PackedManifest } from "../src/engine/packed.ts";
import { partUrl } from "../src/engine/packed.ts";
import { assertFileSizes, MAX_PART_BYTES } from "./limits.ts";
import { pack } from "./pack.ts";
import { fetchWithRetry } from "./retryFetch.ts";

if (MODEL.hubId !== MASKERA_SV_NER_MODEL || MODEL.revision !== MASKERA_SV_NER_REVISION) {
  console.error(
    `src/config.ts pins ${MODEL.hubId}@${MODEL.revision}, installed maskera expects ` +
      `${MASKERA_SV_NER_MODEL}@${MASKERA_SV_NER_REVISION}. Update MODEL (revision, directory, hashes).`,
  );
  process.exit(1);
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const PUBLIC = "public";
const MANIFEST = ".cache/packed.json";
const GENERATED = "src/engine/assets.generated.ts";
const srcDir = join(MODEL_SRC_DIR, MODEL.directory);
const modelDir = join(PUBLIC, MODEL_BASE, MODEL.directory);
const runtimeRoot = join(PUBLIC, RUNTIME_BASE);

// 1. Raw model files.
for (const [file, expected] of Object.entries(MODEL.files)) {
  const target = join(srcDir, file);
  if (existsSync(target) && sha256(readFileSync(target)) === expected) continue;
  const url = `https://huggingface.co/${MODEL.hubId}/resolve/${MODEL.revision}/${file}`;
  console.log(`fetching ${file}`);
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    console.error(`failed to fetch ${url}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = sha256(buf);
  if (actual !== expected) {
    console.error(`checksum mismatch for ${file}: expected ${expected}, got ${actual}. Refusing to use it.`);
    process.exit(1);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buf);
}
const onnxSize = statSync(join(srcDir, MODEL.onnxFile)).size;
if (onnxSize !== MODEL.onnxBytes) {
  console.error(`MODEL.onnxBytes is ${MODEL.onnxBytes}, ${MODEL.onnxFile} is ${onnxSize} bytes. Update src/config.ts.`);
  process.exit(1);
}

// 2. What public/ should contain: [source file, url path, packed?].
const tfEntry = fileURLToPath(import.meta.resolve("@huggingface/transformers"));
const ortDir = dirname(createRequire(tfEntry).resolve("onnxruntime-web"));
const ortVersion: string = JSON.parse(readFileSync(join(ortDir, "..", "package.json"), "utf8")).version;
const runtimeUrl = `${RUNTIME_BASE}${ortVersion}/`;
const outputs: Array<{ src: string; url: string; packed: boolean }> = [
  ...Object.keys(MODEL.files).map((file) => ({
    src: join(srcDir, file),
    url: `${MODEL_BASE}${MODEL.directory}/${file}`,
    packed: file === MODEL.onnxFile,
  })),
  { src: join(ortDir, RUNTIME_FILES.mjs), url: `${runtimeUrl}${RUNTIME_FILES.mjs}`, packed: false },
  { src: join(ortDir, RUNTIME_FILES.wasm), url: `${runtimeUrl}${RUNTIME_FILES.wasm}`, packed: true },
];

const previous: PackedManifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const manifest: PackedManifest = {};
const expectedFiles = new Set<string>();

for (const out of outputs) {
  const target = join(PUBLIC, out.url);
  mkdirSync(dirname(target), { recursive: true });
  const raw = readFileSync(out.src);
  if (!out.packed) {
    copyFileSync(out.src, target);
    expectedFiles.add(target);
    continue;
  }
  const hash = sha256(raw);
  const old = previous[out.url];
  const upToDate =
    old?.sha256 === hash &&
    Array.from({ length: old.parts }, (_, i) => join(PUBLIC, partUrl(out.url, i))).every((p) => existsSync(p));
  if (upToDate) {
    manifest[out.url] = old;
  } else {
    console.log(`packing ${out.url}`);
    const { parts, info } = pack(raw, MAX_PART_BYTES);
    parts.forEach((part, i) => writeFileSync(join(PUBLIC, partUrl(out.url, i)), part));
    manifest[out.url] = info;
  }
  for (let i = 0; i < manifest[out.url].parts; i++) expectedFiles.add(join(PUBLIC, partUrl(out.url, i)));
}

// 3. Drop anything stale (old raw weights, other runtime variants).
for (const dir of [modelDir, runtimeRoot]) {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    if (!expectedFiles.has(path)) rmSync(path);
  }
}
for (const entry of readdirSync(runtimeRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && readdirSync(join(runtimeRoot, entry.name)).length === 0)
    rmSync(join(runtimeRoot, entry.name), { recursive: true });
}
rmSync(join(PUBLIC, "packed.json"), { force: true });
mkdirSync(dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
const generated = `// Generated by scripts/fetch-model.ts. Do not edit.
import type { PackedManifest } from "./packed.ts";

export const RUNTIME_DIR = ${JSON.stringify(runtimeUrl)};

export const PACKED: PackedManifest = ${JSON.stringify(manifest, null, 2)};
`;
if (!existsSync(GENERATED) || readFileSync(GENERATED, "utf8") !== generated) writeFileSync(GENERATED, generated);

assertFileSizes(PUBLIC);
console.log(`model and runtime ready in ${PUBLIC}/ (packed: ${Object.keys(manifest).join(", ")})`);
