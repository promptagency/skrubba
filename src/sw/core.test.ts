import { describe, expect, it } from "vitest";
import { cacheKey, inOfflineCache, MANIFEST_KEY, networkPath, precacheList, staleKeys, unredirected } from "./core.ts";

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

describe("inOfflineCache", () => {
  it("leaves the demo video out, so only people who open it download it", () => {
    expect(inOfflineCache("/video/skrubba-demo.mp4")).toBe(false);
    expect(inOfflineCache("/video/skrubba-demo.jpg")).toBe(false);
    expect(inOfflineCache("/index.html")).toBe(true);
    expect(inOfflineCache("/models/m/onnx/model.onnx.gzpart0")).toBe(true);
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

describe("networkPath", () => {
  it("fetches the app shell from /, since hosts like Cloudflare Pages redirect /index.html there", () => {
    expect(networkPath("/index.html")).toBe("/");
  });

  it("fetches every other file from its own path", () => {
    expect(networkPath("/assets/index-abc.js")).toBe("/assets/index-abc.js");
  });
});

describe("unredirected", () => {
  it("returns a redirected response as a plain copy, which browsers accept for a page load", async () => {
    const res = new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
    Object.defineProperty(res, "redirected", { value: true });
    const copy = await unredirected(res);
    expect(copy.redirected).toBe(false);
    expect(copy.headers.get("content-type")).toBe("text/html");
    expect(await copy.text()).toBe("<html>");
  });

  it("returns any other response as it is", async () => {
    const res = new Response("x");
    expect(await unredirected(res)).toBe(res);
  });
});
