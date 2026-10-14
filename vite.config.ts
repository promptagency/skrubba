/// <reference types="vitest/config" />
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin } from "vite";
import { buildSwManifest } from "./scripts/swManifest.ts";
import { APP_NAME, APP_URL } from "./src/config.ts";
import { COPY } from "./src/ui/copy.ts";

// Privacy: the page may only talk to its own origin. 'wasm-unsafe-eval' lets
// onnxruntime compile its WASM; it does not allow eval() of JavaScript.
// frame-ancestors cannot be set from a meta tag; it goes in public/_headers.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "img-src 'self' data:",
  "style-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Build only: Vite's dev server injects inline scripts the CSP would block.
function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "skrubba-build", content: BUILD_ID }, injectTo: "head" },
    ],
  };
}

// Link previews (Open Graph, X): title and description are the approved
// app.title and app.tagline, the image is public/og-image.png
// (scripts/make-og-image.ts), and the address comes from config.ts.
function shareMeta(): Plugin {
  const url = `${APP_URL}/`;
  const prop = (property: string, content: string) => ({ tag: "meta", attrs: { property, content }, injectTo: "head" as const });
  const name = (name: string, content: string) => ({ tag: "meta", attrs: { name, content }, injectTo: "head" as const });
  return {
    name: "share-meta",
    transformIndexHtml: () => [
      { tag: "link", attrs: { rel: "canonical", href: url }, injectTo: "head" },
      prop("og:type", "website"),
      prop("og:site_name", APP_NAME),
      prop("og:locale", "sv_SE"),
      prop("og:url", url),
      prop("og:title", COPY["app.title"]),
      prop("og:description", COPY["app.tagline"]),
      prop("og:image", `${APP_URL}/og-image.png`),
      prop("og:image:width", "1200"),
      prop("og:image:height", "630"),
      prop("og:image:alt", COPY["app.title"]),
      name("twitter:card", "summary_large_image"),
    ],
  };
}

// onnxruntime imports /runtime/*.mjs at run time, which Vite's dev server
// refuses for files in public/. Serve them as plain files in dev.
function serveRuntimeInDev(): Plugin {
  const types: Record<string, string> = { ".mjs": "text/javascript", ".wasm": "application/wasm" };
  const dir = fileURLToPath(new URL("./public/runtime", import.meta.url));
  return {
    name: "serve-runtime-in-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/runtime", (req, res, next) => {
        const rel = (req.url ?? "").split("?")[0];
        const file = join(dir, rel);
        const type = types[extname(rel)];
        if (!file.startsWith(dir)) return next();
        if (!type || !existsSync(file)) return next();
        res.setHeader("Content-Type", type);
        createReadStream(file).pipe(res);
      });
    },
  };
}

// onnxruntime-web references its own .wasm via new URL(), so Vite emits a
// 27 MB copy. The worker hands onnxruntime the unpacked bytes from /runtime/
// instead (src/engine/worker.ts), so the copy is never loaded. Drop it.
function dropBundledWasm(): Plugin {
  return {
    name: "drop-bundled-wasm",
    apply: "build",
    generateBundle(_, bundle) {
      for (const name of Object.keys(bundle)) if (name.endsWith(".wasm")) delete bundle[name];
    },
  };
}

// SW_KILL=1 builds the kill switch (src/sw/kill.ts) and an app that does not
// register a service worker. See README, "Turning the offline cache off".
const SW_KILL = process.env.SW_KILL === "1";
// Shown as <meta name="skrubba-build"> so a deploy can be identified.
const BUILD_ID = process.env.BUILD_ID ?? process.env.CF_PAGES_COMMIT_SHA ?? "local";

// After the app is built, build the service worker into dist/sw.js as a
// classic script, with the content revision of every file in dist/ baked in.
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: "warn",
        define: { __SW_MANIFEST__: JSON.stringify(buildSwManifest(outDir)) },
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          lib: {
            entry: SW_KILL ? "src/sw/kill.ts" : "src/sw/sw.ts",
            formats: ["iife"],
            name: "sw",
            fileName: () => "sw.js",
          },
        },
      });
    },
  };
}

// Cross-origin isolation gives onnxruntime SharedArrayBuffer and so several
// threads. Skrubba loads nothing from other origins, so require-corp costs
// nothing. The same headers are set for production in public/_headers.
const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// Shown in the footer. Bump it in package.json for each release.
const APP_VERSION = (JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8")) as { version: string }).version;

export default defineConfig({
  plugins: [react(), cspMeta(), shareMeta(), serveRuntimeInDev(), serviceWorker()],
  define: { __SW_KILL__: JSON.stringify(SW_KILL), __APP_VERSION__: JSON.stringify(APP_VERSION) },
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
  // transformers.js and onnxruntime-web break under dependency prebundling.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  // The worker dynamic-imports parts of transformers.js; only ES workers can split.
  worker: { format: "es", plugins: () => [dropBundledWasm()] },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "functions/**/*.test.ts"] },
});
