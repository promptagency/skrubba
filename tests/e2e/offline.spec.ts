import { expect, test } from "@playwright/test";
import { buildPdf, SAMPLE } from "../fixtures/documents/build.ts";
import { dropFile, editor, fileWindow, openReady, rows } from "./helpers.ts";

test("after one visit the app works offline, model included", async ({ page, context }) => {
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toContainText("Namn");
});

// Playwright reports service-worker network events only in Chromium.
test("a second visit downloads nothing from the network", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "service worker network events are Chromium-only in Playwright");
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const seen: Array<{ url: string; fromServiceWorker: boolean }> = [];
  context.on("requestfinished", async (r) => {
    const res = await r.response().catch(() => null);
    if (res && /\/(models|runtime)\//.test(r.url())) seen.push({ url: r.url(), fromServiceWorker: res.fromServiceWorker() });
  });
  await page.reload();
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.filter((r) => !r.fromServiceWorker)).toEqual([]);
});

// The checksum used to re-read the weights, so the bar ran 0 to 100 twice and the
// model was unpacked twice. A slow first visit also left transformers.js's own copy.
test("a second visit reads each part of the weights once, never runs the bar backwards, and drops the model library's own copy", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "service worker network events are Chromium-only in Playwright");
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // What a first visit without the service worker in control would have left behind.
  await page.evaluate(() => caches.open("transformers-cache").then((c) => c.put("/stale", new Response("x"))));

  const parts: string[] = [];
  context.on("requestfinished", (r) => {
    if (/onnx\/.*\.gzpart\d+$/.test(r.url())) parts.push(new URL(r.url()).pathname);
  });
  await page.addInitScript(() => {
    const seen: number[] = [];
    (window as unknown as { __pcts: number[] }).__pcts = seen;
    new MutationObserver(() => {
      const m = /Laddar modell (\d+) %/.exec(document.body?.textContent ?? "");
      if (m && seen.at(-1) !== Number(m[1])) seen.push(Number(m[1]));
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  });
  await page.reload();
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });

  expect(parts.length).toBeGreaterThan(0);
  expect(parts.length).toBe(new Set(parts).size);
  const pcts = await page.evaluate(() => (window as unknown as { __pcts: number[] }).__pcts);
  expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
  await expect.poll(() => page.evaluate(() => caches.has("transformers-cache"))).toBe(false);
});

test("a first visit downloads each model and runtime part once", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "service worker network events are Chromium-only in Playwright");
  const fromNetwork: string[] = [];
  context.on("requestfinished", async (r) => {
    const res = await r.response().catch(() => null);
    if (res && !res.fromServiceWorker() && /\.gzpart\d+$/.test(r.url())) fromNetwork.push(new URL(r.url()).pathname);
  });
  await openReady(page);
  expect(fromNetwork.length).toBeGreaterThan(0);
  expect(fromNetwork.length).toBe(new Set(fromNetwork).size);
});

test("after one visit a PDF can be read offline", async ({ page, context }) => {
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await dropFile(page, editor(page), "avtal.pdf", "application/pdf", buildPdf([[SAMPLE.title, ...SAMPLE.lines]]));
  await expect(fileWindow(page)).toContainText("PDF · 1 sida");
});
