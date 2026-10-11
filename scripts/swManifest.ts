import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { inOfflineCache, type SwManifest } from "../src/sw/core.ts";

/** Every file in dist/ (except sw.js, Cloudflare's _headers and the demo video) with a short content hash. */
export function buildSwManifest(dist: string): SwManifest {
  const manifest: SwManifest = {};
  for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const path = `/${relative(dist, file).split(sep).join("/")}`;
    if (path === "/sw.js" || path === "/_headers" || !inOfflineCache(path)) continue;
    manifest[path] = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
  }
  return manifest;
}
