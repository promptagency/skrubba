// Copy the Skrubba symbol from design/logo/ to the favicon files and render the
// PNG sizes the manifest needs. Run once after the symbol changes:
// npx tsx scripts/make-icons.ts. Outputs are committed.
import { copyFileSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const POSITIVE = "design/logo/skrubba-symbol-positiv.svg";
const NEGATIVE = "design/logo/skrubba-symbol-negativ.svg";

// The files are used as they are.
copyFileSync(POSITIVE, "public/icon.svg");
copyFileSync(NEGATIVE, "public/icon-dark.svg");

const ICON = readFileSync(POSITIVE, "utf8").trim();
// Maskable: the symbol's own ground, full bleed, with the symbol inside the 80 % safe zone.
const ground = ICON.match(/<rect [^>]*fill="([^"]+)"/)![1];
const MASKABLE = ICON.replace(/(<svg [^>]*>)/, `$1<rect width="512" height="512" fill="${ground}"/><g transform="translate(256 256) scale(0.78) translate(-256 -256)">`).replace(
  "</svg>",
  "</g></svg>",
);

const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (svg: string, size: number, path: string) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path, omitBackground: true });
};
await render(ICON, 192, "public/icons/icon-192.png");
await render(ICON, 512, "public/icons/icon-512.png");
await render(MASKABLE, 512, "public/icons/icon-maskable-512.png");
await render(MASKABLE, 180, "public/apple-touch-icon.png");
await browser.close();
console.log("icons written");
