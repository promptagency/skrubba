import { expect, test } from "@playwright/test";
import { openReady } from "./helpers.ts";

// Lighthouse dropped its PWA category in v12, so ask Chrome directly. (Its
// installability-errors call reports nothing in headless mode, so it cannot
// fail; the manifest parse below can.)
test("Chrome finds and parses the manifest without errors", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium DevTools protocol");
  await openReady(page);
  const cdp = await page.context().newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  expect(manifest.url).toMatch(/\/manifest\.webmanifest$/);
  expect(manifest.errors).toEqual([]);
});

test("the manifest names the app, is Swedish and standalone, and its icons load", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Skrubba", short_name: "Skrubba", lang: "sv", start_url: "/", display: "standalone" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    expect(icon.src.startsWith("/")).toBe(true);
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});
