import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, oversizedFiles } from "./limits.ts";

describe("oversizedFiles", () => {
  it("lists only files over 25 MiB", () => {
    const dir = mkdtempSync(join(tmpdir(), "limits-"));
    writeFileSync(join(dir, "ok.bin"), Buffer.alloc(MAX_FILE_BYTES));
    writeFileSync(join(dir, "big.bin"), Buffer.alloc(MAX_FILE_BYTES + 1));
    expect(oversizedFiles(dir)).toEqual([join(dir, "big.bin")]);
  });
});
