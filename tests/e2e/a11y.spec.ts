// WCAG 2.2 AA checks with axe-core (the engine behind Lighthouse's
// accessibility score) on every view, in light and dark.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { answerBox, MOD, openItems, openKey, openReady, rows, scrub } from "./helpers.ts";

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
        expect(await violations(page)).toEqual([]);
      });

      test("the Uppgifter window", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await openItems(page);
        expect(await violations(page)).toEqual([]);
      });

      test("Avskrubba with a suggestion", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await scrub(page);
        await (await answerBox(page)).fill("Hej [NAMN_1] och NAMN 2. [NAMN_9].");
        await page.keyboard.press(`${MOD}+Enter`);
        await expect(page.getByRole("button", { name: "Ja" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("Avskrubba without a kodnyckel", async ({ page }) => {
        await openReady(page);
        await (await answerBox(page)).fill("Hej [NAMN_1].");
        await expect(page.getByRole("button", { name: "Ladda upp kodnyckel" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("the key card with a key", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Visa exempel" }).click();
        await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
        await scrub(page);
        await openKey(page);
        expect(await violations(page)).toEqual([]);
      });

      test("Vanliga frågor", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Vanliga frågor" }).click();
        await expect(page.getByRole("dialog", { name: "Vanliga frågor" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    });
  }
});
