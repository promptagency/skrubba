import { expect, test } from "@playwright/test";
import { editor } from "./helpers.ts";

const LEAD = "Skrubba laddar ner en liten svensk språkmodell till din webbläsare.";

test("the editor stays locked with an explanation until the model is ready", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/models/**/onnx/**", async (route) => {
    await held;
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByText(LEAD)).toBeVisible();
  await expect(page.getByText(/^Laddar modell \d+ %/).first()).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Visa exempel" })).toBeDisabled();

  release();
  await expect(editor(page)).toBeFocused({ timeout: 90_000 });
  await expect(page.getByText(LEAD)).toHaveCount(0);
});

test("the editor unlocks in rules-only mode when the model cannot load", async ({ page }) => {
  await page.route("**/models/**/onnx/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveAttribute("data-state", "rulesOnly", { timeout: 90_000 });
  await expect(editor(page)).toBeFocused();
  await editor(page).fill("Pnr 19850312-4471");
  await expect(page.locator(".row-main").filter({ hasText: "19850312-4471" })).toBeVisible();
});
