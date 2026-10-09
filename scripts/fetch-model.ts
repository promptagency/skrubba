// Fetch the pinned NER model and prepare everything the app serves from its
// own origin. Runs before dev and build; skips work that is already done.
//
//   .cache/model-src/<dir>/   raw model files, sha256-checked (Node tests use these)
//   public/models/<dir>/      tokenizer + config as is, ONNX weights gzipped in parts
//   public/runtime/           onnxruntime-web plain build: .mjs as is, .wasm gzipped
//   public/packed.json        how each packed file is split (see src/engine/packed.ts)
//
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

if (MODEL.hubId !== MASKERA_SV_NER_MODEL || MODEL.revision !== MASKERA_SV_NER_REVISION) {
  console.error(
    `src/config.ts pins ${MODEL.hubId}@${MODEL.revision}, installed maskera expects ` +
      `${MASKERA_SV_NER_MODEL}@${MASKERA_SV_NER_REVISION}. Update MODEL (revision, directory, hashes).`,
  );
  process.exit(1);
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const PUBLIC = "public";
const MANIFEST = join(PUBLIC, "packed.json");
const srcDir = join(MODEL_SRC_DIR, MODEL.directory);
const modelDir = join(PUBLIC, MODEL_BASE, MODEL.directory);
const runtimeDir = join(PUBLIC, RUNTIME_BASE);

// 1. Raw model files.
for (const [file, expected] of Object.entries(MODEL.files)) {
  const target = join(srcDir, file);
  if (existsSync(target) && sha256(readFileSync(target)) === expected) continue;
  const url = `https://huggingface.co/${MODEL.hubId}/resolve/${MODEL.revision}/${file}`;
  console.log(`fetching ${file}`);
  const res = await fetch(url);
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
const outputs: Array<{ src: string; url: string; packed: boolean }> = [
  ...Object.keys(MODEL.files).map((file) => ({
    src: join(srcDir, file),
    url: `${MODEL_BASE}${MODEL.directory}/${file}`,
    packed: file === MODEL.onnxFile,
  })),
  { src: join(ortDir, RUNTIME_FILES.mjs), url: `${RUNTIME_BASE}${RUNTIME_FILES.mjs}`, packed: false },
  { src: join(ortDir, RUNTIME_FILES.wasm), url: `${RUNTIME_BASE}${RUNTIME_FILES.wasm}`, packed: true },
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
for (const dir of [modelDir, runtimeDir]) {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    if (!expectedFiles.has(path)) rmSync(path);
  }
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

assertFileSizes(PUBLIC);
console.log(`model and runtime ready in ${PUBLIC}/ (packed: ${Object.keys(manifest).join(", ")})`);
