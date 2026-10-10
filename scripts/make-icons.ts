// Render the app icon (an SVG) to the PNG sizes the manifest needs. Run once
// after changing the icon: npx tsx scripts/make-icons.ts. Outputs are committed.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// A placeholder in brackets: [ ▬ ]. Drawn with shapes, no font needed.
const mark = (scale: number) => {
  const s = (n: number) => 256 + (n - 256) * scale;
  return `
  <path d="M${s(184)} ${s(136)} H${s(132)} V${s(376)} H${s(184)}" fill="none" stroke="#fff" stroke-width="${36 * scale}" stroke-linejoin="round"/>
  <path d="M${s(328)} ${s(136)} H${s(380)} V${s(376)} H${s(328)}" fill="none" stroke="#fff" stroke-width="${36 * scale}" stroke-linejoin="round"/>
  <rect x="${s(196)}" y="${s(232)}" width="${120 * scale}" height="${48 * scale}" rx="${10 * scale}" fill="#a8e6c9"/>`;
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#1f5f4a"/>${mark(1)}</svg>`;
// Maskable: full-bleed background, mark inside the 80 % safe zone.
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1f5f4a"/>${mark(0.78)}</svg>`;

writeFileSync("public/icon.svg", `${ICON}\n`);

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
