// WCAG 2.2 AA checks with axe-core (the engine behind Lighthouse's
// accessibility score) on every view, in light and dark.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { answerBox, copyScrubbed, MOD, openKey, openReady, rows } from "./helpers.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.describe("accessibility", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "axe results are the same across engines");

  for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme, serviceWorkers: "block" });

      test("model loading", async ({ page }) => {
        await page.route("**/models/**/onnx/**", () => new Promise(() => {}));
        await page.goto("/");
        await expect(page.locator(".gate")).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("Skrubba with the example", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await page.getByRole("button", { name: "Johan Lindqvist" }).first().click();
        expect(await violations(page)).toEqual([]);
      });

      test("Avskrubba with a suggestion", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await copyScrubbed(page).click();
        await expect(page.locator(".toast")).toBeVisible();
        await answerBox(page).fill("Hej [NAMN_1] och NAMN 2. [NAMN_9].");
        await page.keyboard.press(`${MOD}+Enter`);
        await expect(page.getByRole("button", { name: "Ja" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("the key card with a key", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await copyScrubbed(page).click();
        await expect(page.locator(".toast")).toBeVisible();
        await openKey(page);
        expect(await violations(page)).toEqual([]);
      });

      test("Så funkar Skrubba", async ({ page }) => {
        await page.goto("/sa-funkar-det");
        expect(await violations(page)).toEqual([]);
      });
    });
  }
});
