import { expect, type Page } from "@playwright/test";

export const MOD = process.platform === "darwin" ? "Meta" : "Control";

export async function openReady(page: Page) {
  await page.goto("/");
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
}

export const editor = (page: Page) => page.getByRole("textbox", { name: "Skrubba", exact: true });
export const rows = (page: Page) => page.locator(".row-main");
export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

/** The Avskrubba card's text box. */
export const answerBox = (page: Page) => page.getByRole("textbox", { name: "Avskrubba" });
/** Kopiera under the Skrubba card (the first of the two). */
export const copyScrubbed = (page: Page) => page.getByRole("button", { name: "Kopiera" }).first();
/** The key card, opened from the key button next to "Nyckel". */
export async function openKey(page: Page) {
  await page.getByRole("button", { name: /^Nyckel/ }).click();
  const dialog = page.getByRole("dialog", { name: "Nyckel" });
  await expect(dialog).toBeVisible();
  return dialog;
}
/** The placeholder of a value, read from the key card's table. */
export async function placeholderOf(page: Page, value: string): Promise<string> {
  const dialog = await openKey(page);
  const cell = await dialog.getByRole("row").filter({ hasText: value }).getByRole("cell").first().textContent();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return cell!;
}
