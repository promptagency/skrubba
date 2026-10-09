/// <reference types="vitest/config" />
import { createReadStream, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  plugins: [react(), cspMeta(), serveRuntimeInDev()],
  // transformers.js and onnxruntime-web break under dependency prebundling.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  // The worker dynamic-imports parts of transformers.js; only ES workers can split.
  worker: { format: "es" },
  test: { include: ["src/**/*.test.ts"] },
});
