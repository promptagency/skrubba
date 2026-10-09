import { describe, expect, it } from "vitest";
import { cacheKey, precacheList, staleKeys } from "./core.ts";

const manifest = {
  "/index.html": "aaa",
  "/assets/index-1.js": "bbb",
  "/packed.json": "ccc",
  "/models/m/onnx/model.onnx.gzpart0": "ddd",
  "/runtime/ort.wasm.gzpart0": "eee",
};

describe("cacheKey", () => {
  it("adds the content revision so a changed file never hits an old entry", () => {
    expect(cacheKey("/runtime/ort.mjs", "abc")).toBe("/runtime/ort.mjs?__rev=abc");
  });
});

describe("precacheList", () => {
  it("precaches the small files and leaves the big packed parts to fetch-time caching", () => {
    expect(precacheList(manifest)).toEqual(["/index.html", "/assets/index-1.js", "/packed.json"]);
  });
});

describe("staleKeys", () => {
  it("lists cached entries that are not in the current manifest", () => {
    const origin = "https://x.test";
    const cached = [
      `${origin}/index.html?__rev=aaa`,
      `${origin}/index.html?__rev=old`,
      `${origin}/runtime/ort.wasm.gzpart0?__rev=eee`,
      `${origin}/gone.js?__rev=fff`,
    ];
    expect(staleKeys(cached, manifest)).toEqual([`${origin}/index.html?__rev=old`, `${origin}/gone.js?__rev=fff`]);
  });
});
