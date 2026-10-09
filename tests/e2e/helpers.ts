import { expect, type Page } from "@playwright/test";

export const MOD = process.platform === "darwin" ? "Meta" : "Control";

export async function openReady(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
}

export const editor = (page: Page) => page.getByRole("textbox", { name: "Skrubba" });
export const rows = (page: Page) => page.locator(".row-main");
export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());
