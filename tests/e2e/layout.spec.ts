import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

test("the item count stays hidden until there is text; Egna ord is always there", async ({ page }) => {
  await openReady(page);
  const count = page.getByRole("button", { name: /^\d+ uppgift(er)? Visa$/ });
  await expect(count).toHaveCount(0);
  await expect(page.getByText(/^Egna ord/)).toBeVisible();

  await editor(page).fill("Johan Lindqvist ringde.");
  await expect(count).toHaveAccessibleName("1 uppgift Visa");

  await editor(page).fill("");
  await expect(count).toHaveCount(0);
});

test("at 1280 px Vanliga frågor and Så här funkar det sit centred under the switch, the switch centred", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openReady(page);
  const pill = (await page.getByRole("group", { name: "Vad vill du göra?" }).boundingBox())!;
  const links = (await page.locator(".help-links").boundingBox())!;
  expect(links.y).toBeGreaterThanOrEqual(pill.y + pill.height);
  expect(Math.abs(links.x + links.width / 2 - 640)).toBeLessThan(4);
  expect(Math.abs(pill.x + pill.width / 2 - 640)).toBeLessThan(10);
});

test("at 390 px the two links sit centred under the switch, nothing scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openReady(page);
  const pill = (await page.getByRole("group", { name: "Vad vill du göra?" }).boundingBox())!;
  const links = (await page.locator(".help-links").boundingBox())!;
  expect(links.y).toBeGreaterThanOrEqual(pill.y + pill.height);
  expect(Math.abs(links.x + links.width / 2 - 195)).toBeLessThan(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Vanliga frågor looks like a quiet link, not a button", async ({ page }) => {
  await openReady(page);
  const faq = page.getByRole("button", { name: "Vanliga frågor" });
  await expect(faq).toHaveCSS("border-top-style", "none");
  await expect(faq).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(faq).toHaveCSS("text-decoration-line", "underline");
});
