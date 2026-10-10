import { describe, expect, it } from "vitest";
import { cacheKey, MANIFEST_KEY, precacheList, staleKeys } from "./core.ts";

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
  const origin = "https://x.test";
  const previous = { "/index.html": "old", "/assets/index-0.js": "zzz" };

  it("keeps entries of the current and the previous build, drops the rest", () => {
    const cached = [
      `${origin}/index.html?__rev=aaa`,
      `${origin}/index.html?__rev=old`,
      `${origin}/index.html?__rev=older`,
      `${origin}/assets/index-0.js?__rev=zzz`,
      `${origin}/runtime/ort.wasm.gzpart0?__rev=eee`,
      `${origin}/gone.js?__rev=fff`,
    ];
    expect(staleKeys(cached, manifest, previous)).toEqual([
      `${origin}/index.html?__rev=older`,
      `${origin}/gone.js?__rev=fff`,
    ]);
  });

  it("keeps only the current build when there is no previous one", () => {
    expect(staleKeys([`${origin}/index.html?__rev=old`], manifest, {})).toEqual([`${origin}/index.html?__rev=old`]);
  });

  it("never drops the stored manifest itself", () => {
    expect(staleKeys([`${origin}${MANIFEST_KEY}`], manifest, previous)).toEqual([]);
  });
});
