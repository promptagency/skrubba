import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSwManifest } from "./swManifest.ts";

describe("buildSwManifest", () => {
  it("maps every file under dist to a content revision, except the service worker and Cloudflare's _headers", () => {
    const dist = mkdtempSync(join(tmpdir(), "dist-"));
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "index.html"), "<html>");
    writeFileSync(join(dist, "assets", "a.js"), "a");
    writeFileSync(join(dist, "assets", "b.js"), "a");
    writeFileSync(join(dist, "sw.js"), "sw");
    writeFileSync(join(dist, "_headers"), "/sw.js");
    const m = buildSwManifest(dist);
    expect(Object.keys(m).sort()).toEqual(["/assets/a.js", "/assets/b.js", "/index.html"]);
    expect(m["/assets/a.js"]).toBe(m["/assets/b.js"]);
    expect(m["/assets/a.js"]).not.toBe(m["/index.html"]);
    expect(m["/index.html"]).toMatch(/^[0-9a-f]{12}$/);
  });
});
