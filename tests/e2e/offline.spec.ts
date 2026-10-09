import { expect, test } from "@playwright/test";
import { editor, openReady, rows } from "./helpers.ts";

test("after one visit the app works offline, model included", async ({ page, context }) => {
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("status").first()).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
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
  await expect(page.getByRole("status").first()).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.filter((r) => !r.fromServiceWorker)).toEqual([]);
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
