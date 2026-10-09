// Gzip a file and cut it into parts no larger than `maxPart`, so every file
// we deploy fits Cloudflare Pages' 25 MiB per-file limit. The worker joins
// and unpacks them (src/engine/packed.ts).
import { createHash } from "node:crypto";
import { constants, gzipSync } from "node:zlib";
import type { PackedInfo } from "../src/engine/packed.ts";

export function pack(raw: Buffer, maxPart: number): { parts: Buffer[]; info: PackedInfo } {
  const gz = gzipSync(raw, { level: constants.Z_BEST_COMPRESSION });
  const parts: Buffer[] = [];
  for (let i = 0; i < gz.length; i += maxPart) parts.push(gz.subarray(i, i + maxPart));
  return {
    parts,
    info: {
      parts: parts.length,
      packedBytes: gz.length,
      rawBytes: raw.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
    },
  };
}
