// WCAG 2.2 AA checks with axe-core (the engine behind Lighthouse's
// accessibility score) on every view, in light and dark.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { SAMPLE_TEXT } from "../fixtures/documents/build.ts";
import { answerBox, dropFile, editor, fileWindow, MOD, openItems, openKey, openReady, rows, scrub } from "./helpers.ts";

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

      test("Så här funkar det", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Så här funkar det" }).click();
        await expect(page.getByRole("dialog", { name: "Så här funkar det" }).locator("video")).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("Vanliga frågor", async ({ page }) => {
        await openReady(page);
        await page.getByRole("button", { name: "Vanliga frågor" }).click();
        await expect(page.getByRole("dialog", { name: "Vanliga frågor" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("Läs in dokument, with the text read", async ({ page }) => {
        await openReady(page);
        await editor(page).fill("Min egen text.");
        await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
        await expect(fileWindow(page).getByRole("button", { name: "Använd texten" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("while the model reads a long text", async ({ page }) => {
        await openReady(page);
        await editor(page).fill("och sen sa Anna Berg att vi skulle ta det på mötet ".repeat(800));
        await expect(page.locator(".scan-progress")).toBeVisible({ timeout: 10_000 });
        expect(await violations(page)).toEqual([]);
      });

      test("Läs in dokument, with an error", async ({ page }) => {
        await openReady(page);
        await dropFile(page, editor(page), "bild.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
        await expect(fileWindow(page).getByRole("alert")).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    });
  }
});
