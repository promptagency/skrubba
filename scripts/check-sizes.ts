// Run after build: fail if anything in dist/ is too big for Cloudflare Pages.
import { assertFileSizes } from "./limits.ts";

assertFileSizes("dist");
console.log("dist/ fits Cloudflare Pages' per-file limit");
