import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSP } from "../vite.config.ts";

// Cloudflare Pages reads public/_headers: a path pattern, then indented headers.
function rules(): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const line of readFileSync("public/_headers", "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) out.set(line.trim(), (current = new Map()));
    else if (current) {
      const i = line.indexOf(":");
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
    }
  }
  return out;
}

describe("public/_headers", () => {
  const all = rules().get("/*");

  it("sends the page's CSP as a header too, plus frame-ancestors, which a meta tag cannot set", () => {
    expect(all?.get("content-security-policy")).toBe(`${CSP}; frame-ancestors 'none'`);
  });

  it("keeps cross-origin isolation and the usual hardening headers", () => {
    expect(all?.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(all?.get("cross-origin-embedder-policy")).toBe("require-corp");
    expect(all?.get("x-content-type-options")).toBe("nosniff");
    expect(all?.get("referrer-policy")).toBe("no-referrer");
  });

  it("caches Vite's hashed files for a year and never caches sw.js", () => {
    expect(rules().get("/assets/*")?.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(rules().get("/sw.js")?.get("cache-control")).toBe("no-cache");
  });

  it("leaves the model and runtime to revalidate: a rebuild can repack them under the same name", () => {
    expect(rules().has("/models/*")).toBe(false);
    expect(rules().has("/runtime/*")).toBe(false);
  });
});
