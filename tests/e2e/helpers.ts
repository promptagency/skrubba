import { expect, type Page } from "@playwright/test";

export const MOD = process.platform === "darwin" ? "Meta" : "Control";

export async function openReady(page: Page) {
  await page.goto("/");
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
}

export const editor = (page: Page) => page.getByRole("textbox", { name: "Din text", exact: true });
export const rows = (page: Page) => page.locator(".row-main");
export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

/** The Skrubba / Avskrubba switch above the panes. */
export const modeButton = (page: Page, name: "Skrubba" | "Avskrubba") =>
  page.getByRole("group", { name: "Vad vill du göra?" }).getByRole("button", { name, exact: true });
/** The button between the panes: Skrubba or Avskrubba, by mode. */
export const runButton = (page: Page) => page.locator(".run");
/** The right pane in each mode. */
export const scrubbedBox = (page: Page) => page.getByRole("textbox", { name: "Skrubbad text", exact: true });
export const restoredBox = (page: Page) => page.getByRole("textbox", { name: "Avskrubbad text", exact: true });
/** Avskrubba's left pane, switching to Avskrubba first. */
export async function answerBox(page: Page) {
  await modeButton(page, "Avskrubba").click();
  return page.getByRole("textbox", { name: "Svar från AI", exact: true });
}
/** Press Skrubba and wait for the scrubbed text. */
export async function scrub(page: Page) {
  await runButton(page).click();
  await expect(scrubbedBox(page)).not.toHaveValue("");
}
/** The kodnyckel window, opened from the link beside Kopiera (there once the tab has a key). */
export async function openKey(page: Page) {
  await page.getByRole("button", { name: /^Kodnyckel/ }).click();
  const dialog = page.getByRole("dialog", { name: "Kodnyckel" });
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
