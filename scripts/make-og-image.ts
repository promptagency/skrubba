// Render the share image (public/og-image.png, 1200 × 630) that link previews
// on LinkedIn, Slack, Teams and others show. Run after the logo, colours or
// line change: npx tsx scripts/make-og-image.ts. The output is committed.
// The negativ logotype is used as it is, on --sapa, with the line in Figtree
// in --pa-sapa: the owner's choice of 2026-10-14.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { COPY } from "../src/ui/copy.ts";

const tokens = readFileSync("design/tokens.css", "utf8");
const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1]; // first = light theme
const dataUrl = (path: string, type: string) => `data:${type};base64,${readFileSync(path).toString("base64")}`;

// "Skrubba. Gör texten säkrare att klistra in i AI." → the part after the name.
const line = COPY["app.title"].replace(/^Skrubba\.\s*/, "");

const html = `<!doctype html><html><head><style>
@font-face { font-family: "Figtree"; src: url("${dataUrl("design/fonts/Figtree-latin-variable.woff2", "font/woff2")}") format("woff2"); font-weight: 300 900; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: ${token("sapa")}; color: ${token("pa-sapa")};
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 56px;
  font-family: "Figtree"; }
img { width: 640px; }
p { margin: 0; font-size: 48px; font-weight: 600; line-height: 1.25; text-align: center; max-width: 900px; }
</style></head><body>
<img src="${dataUrl("design/logo/skrubba-logotyp-negativ.svg", "image/svg+xml")}" alt="">
<p>${line}</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForFunction("document.fonts.status === \"loaded\"");
await page.screenshot({ path: "public/og-image.png" });
await browser.close();
console.log("public/og-image.png written");
