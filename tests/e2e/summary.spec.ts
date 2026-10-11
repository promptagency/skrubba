import { expect, type Page, test } from "@playwright/test";
import { editor, openReady, rows, scrub } from "./helpers.ts";

// "13 uppgifter" and the kodnyckel are summary strips, not small links: a dot
// per kind found, the count, and "Visa ›", on a raised surface.

const TEXT = "Johan Lindqvist ringde från Umeå.";
const itemsStrip = (page: Page) => page.getByRole("button", { name: /^\d+ uppgift(er)? Visa/ });
const keyStrip = (page: Page) => page.getByRole("button", { name: /^Kodnyckel/ });

async function withText(page: Page) {
  await openReady(page);
  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
}

test("the items strip shows a dot per kind found, the count and Visa, and opens Uppgifter", async ({ page }) => {
  await withText(page);
  const strip = itemsStrip(page);
  await expect(strip).toHaveAccessibleName("2 uppgifter Visa");
  await expect(strip.locator(".summary-dot")).toHaveCount(2); // Namn, and Plats or Organisation
  await expect(strip).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(strip).toHaveAttribute("aria-haspopup", "dialog");
  await strip.click();
  await expect(page.getByRole("dialog", { name: "Uppgifter" })).toBeVisible();
});

test("the kodnyckel strip beside Kopiera shows the placeholders, with dots, and opens the kodnyckel", async ({ page }) => {
  await withText(page);
  await scrub(page);
  const strip = keyStrip(page);
  await expect(strip).toHaveAccessibleName("Kodnyckel · 2 platshållare Visa");
  await expect(strip.locator(".summary-dot")).toHaveCount(2);
  await expect(strip).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await strip.click();
  await expect(page.getByRole("dialog", { name: "Kodnyckel" })).toBeVisible();
});

test("two items of the same kind show one dot", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Anna Berg och Karin Ek.");
  await expect(rows(page)).toHaveCount(2);
  await expect(itemsStrip(page).locator(".summary-dot")).toHaveCount(1);
});

test("at 390 px the strip text stays on one line and Kopiera spans the width above it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await withText(page);
  await scrub(page);
  const strip = (await keyStrip(page).boundingBox())!;
  expect(strip.height).toBeLessThan(44);
  const copy = (await page.getByRole("button", { name: "Kopiera" }).boundingBox())!;
  expect(copy.width).toBeGreaterThan(300);
  expect(copy.y + copy.height).toBeLessThanOrEqual(strip.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
