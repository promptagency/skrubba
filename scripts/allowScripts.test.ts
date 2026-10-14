import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// npm 11 runs an install script only if package.json's allowScripts approves
// that exact version. onnxruntime-node's script fetches the native runtime the
// model tests need; if an update bumps it without updating the approval, the
// script is skipped and the model tests silently stop testing anything.
describe("allowScripts", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { allowScripts: Record<string, boolean> };
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as { packages: Record<string, { version: string }> };

  it("approves the onnxruntime-node version that is installed", () => {
    const installed = lock.packages["node_modules/onnxruntime-node"].version;
    expect(Object.keys(pkg.allowScripts)).toContain(`onnxruntime-node@${installed}`);
  });
});
