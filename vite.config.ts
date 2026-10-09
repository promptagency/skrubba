/// <reference types="vitest/config" />
import { createReadStream, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin } from "vite";
import { buildSwManifest } from "./scripts/swManifest.ts";

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
        const name = basename((req.url ?? "").split("?")[0]);
        const file = join(dir, name);
        const type = types[extname(name)];
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

// After the app is built, build src/sw/sw.ts into dist/sw.js as a classic
// script, with the content revision of every file in dist/ baked in.
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
          lib: { entry: "src/sw/sw.ts", formats: ["iife"], name: "sw", fileName: () => "sw.js" },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta(), serveRuntimeInDev(), serviceWorker()],
  // transformers.js and onnxruntime-web break under dependency prebundling.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  // The worker dynamic-imports parts of transformers.js; only ES workers can split.
  worker: { format: "es", plugins: () => [dropBundledWasm()] },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
