import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Cloudflare Pages rejects any single file over 25 MiB. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Packed parts stay a little under the limit. */
export const MAX_PART_BYTES = 24 * 1024 * 1024;

export function oversizedFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .filter((path) => statSync(path).size > MAX_FILE_BYTES);
}

export function assertFileSizes(dir: string): void {
  const big = oversizedFiles(dir);
  if (big.length === 0) return;
  console.error(`Over Cloudflare Pages' 25 MiB per-file limit:\n${big.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
