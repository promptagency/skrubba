// Fetch the pinned NER model into public/models/ and copy the ONNX WASM
// runtime into public/runtime/, so the app serves both from its own origin.
// Skips files that are already present and verified. Runs before dev and build.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MASKERA_SV_NER_MODEL, MASKERA_SV_NER_REVISION } from "maskera";
import { MODEL } from "../src/config.ts";

if (MODEL.hubId !== MASKERA_SV_NER_MODEL || MODEL.revision !== MASKERA_SV_NER_REVISION) {
  console.error(
    `src/config.ts pins ${MODEL.hubId}@${MODEL.revision}, installed maskera expects ` +
      `${MASKERA_SV_NER_MODEL}@${MASKERA_SV_NER_REVISION}. Update MODEL (revision, directory, hashes).`,
  );
  process.exit(1);
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const dest = join("public/models", MODEL.directory);

for (const [file, expected] of Object.entries(MODEL.files)) {
  const target = join(dest, file);
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
const onnxSize = statSync(join(dest, MODEL.onnxFile)).size;
if (onnxSize !== MODEL.onnxBytes) {
  console.error(`MODEL.onnxBytes is ${MODEL.onnxBytes}, ${MODEL.onnxFile} is ${onnxSize} bytes. Update src/config.ts.`);
  process.exit(1);
}
console.log(`model verified in ${dest}`);

// The runtime version must be the one transformers.js loads, so resolve
// onnxruntime-web through it.
const tfEntry = fileURLToPath(import.meta.resolve("@huggingface/transformers"));
const ortDir = dirname(createRequire(tfEntry).resolve("onnxruntime-web"));
mkdirSync("public/runtime", { recursive: true });
for (const file of readdirSync(ortDir).filter((f) => f.startsWith("ort-wasm-simd-threaded"))) {
  copyFileSync(join(ortDir, file), join("public/runtime", file));
}
console.log("runtime copied to public/runtime");
