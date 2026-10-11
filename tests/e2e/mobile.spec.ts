import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { editor, openItems, openKey, openReady, rows, runButton, scrub, scrubbedBox } from "./helpers.ts";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("at 390 px the panes stack, input, button, result, with nothing scrolling sideways", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  const input = await editor(page).boundingBox();
  const button = await runButton(page).boundingBox();
  const result = await scrubbedBox(page).boundingBox();
  expect(button!.y).toBeGreaterThan(input!.y + input!.height);
  expect(result!.y).toBeGreaterThan(button!.y + button!.height);
  expect(await noSideScroll(page)).toBe(true);

  await scrub(page);
  expect(await noSideScroll(page)).toBe(true);
  const dialog = await openKey(page);
  expect(await noSideScroll(page)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vanliga frågor" }).click();
  expect(await noSideScroll(page)).toBe(true);
});

test("the Uppgifter window fits the screen", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  const dialog = await openItems(page);
  expect(await noSideScroll(page)).toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test("loading the model causes no layout shift", async ({ page }) => {
  await page.addInitScript(() => {
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>)
        if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    Object.assign(window, { __cls: () => cls });
  });
  await openReady(page);
  expect(await page.evaluate(() => (window as unknown as { __cls: () => number }).__cls())).toBeLessThan(0.05);
});

test("at 390 px the screen passes axe", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "axe results are the same across engines");
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
