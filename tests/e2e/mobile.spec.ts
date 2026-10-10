import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openReady, rows } from "./helpers.ts";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const noSideScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("at 390 px the entity panel is a bottom sheet behind a count chip", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  const chip = page.getByRole("button", { name: /^\d+ uppgifter$/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await expect(rows(page).first()).toBeHidden();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  const johan = rows(page).filter({ hasText: "Johan Lindqvist" });
  await expect(johan).toBeVisible();
  await johan.locator("xpath=..").getByRole("button", { name: "Skrubba", exact: true }).click();
  await expect(johan).toHaveAccessibleName(/Behåll$/);

  await page.keyboard.press("Escape");
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await expect(rows(page).first()).toBeHidden();

  // On a phone there is no Esc: tapping above the sheet closes it.
  await chip.click();
  await expect(johan).toBeVisible();
  await page.mouse.click(195, 160);
  await expect(chip).toHaveAttribute("aria-expanded", "false");
});

test("at 390 px nothing scrolls sideways and the main controls are on screen", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  for (const name of ["Skrubba", "Byt tillbaka", "Nyckel"]) {
    await page.getByRole("button", { name, exact: true }).first().click();
    expect(await noSideScroll(page)).toBe(true);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Nyckel" })).toBeInViewport();
  }
  await page.getByRole("navigation").getByRole("button", { name: "Skrubba", exact: true }).click();
  await expect(page.locator(".statusbar .primary")).toBeInViewport();
  await page.goto("/sa-funkar-det");
  expect(await noSideScroll(page)).toBe(true);
});

test("at 390 px the screen passes axe, sheet open", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "axe results are the same across engines");
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await page.getByRole("button", { name: /^\d+ uppgifter$/ }).click();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("the status bar keeps its height while the model loads (no layout shift)", async ({ page }) => {
  await page.addInitScript(() => {
    const heights = new Set<number>();
    Object.assign(window, { __heights: heights });
    const tick = () => {
      const footer = document.querySelector("footer");
      if (footer) heights.add(Math.round(footer.getBoundingClientRect().height));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openReady(page);
  expect(await page.evaluate(() => [...(window as unknown as { __heights: Set<number> }).__heights])).toHaveLength(1);
});
