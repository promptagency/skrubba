import { expect, type Page, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady, rows, runButton, scrubbedBox } from "./helpers.ts";

const FIRST = ["Anna", "Erik", "Sara", "Johan", "Maria", "Lars", "Karin", "Nils"];
const LAST = ["Berg", "Lindqvist", "Holm", "Ekström", "Sundberg", "Nyberg", "Wallin", "Strand"];

// Long enough that the model takes well over half a second in every engine.
function longText(chars = 40_000): string {
  let text = "";
  for (let i = 0; text.length < chars; i++) text += `och sen sa ${FIRST[i % 8]} ${LAST[(i * 3) % 8]} att vi skulle ta det på mötet `;
  return text;
}

const scanLine = (page: Page) => page.locator(".scan-progress");
const pct = async (page: Page) => Number(/(\d+) %/.exec((await scanLine(page).textContent()) ?? "")?.[1] ?? -1);

test("a long text shows how far the model has read, then the names", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toHaveText(/^Letar efter namn och platser … \d+ %$/, { timeout: 10_000 });
  const first = await pct(page);
  await expect.poll(() => pct(page), { timeout: 60_000 }).toBeGreaterThan(first);
  await expect(scanLine(page)).toHaveCount(0, { timeout: 120_000 });
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Skrubba during the run shows its progress and then the result", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toBeVisible({ timeout: 10_000 });
  await runButton(page).click();
  await expect(runButton(page)).toHaveText(/^Skrubbar … \d+ %/);
  await expect(runButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(scrubbedBox(page)).not.toHaveValue("", { timeout: 120_000 });
  await expect(runButton(page)).toHaveText(/^Skrubba/);
  await expect(scrubbedBox(page)).not.toHaveValue(/Anna Berg/);
});

// The live region next to the line: what screen readers hear about the reading.
const announcement = (page: Page) => page.locator("p.sr-only[role=status]:not(.model-status)");

test("screen readers hear the start and the count once, not on every later edit", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(announcement(page)).toHaveText("Letar efter namn och platser", { timeout: 10_000 });
  await expect(announcement(page)).toHaveText(/^\d+ uppgift(er)?$/, { timeout: 120_000 });
  // A change that reuses the reading (Egna ord) must not announce the count again.
  await page.locator(".words summary").click();
  await page.locator(".words textarea").fill("mötet");
  await expect(rows(page).filter({ hasText: "mötet" })).toHaveCount(1);
  await expect(announcement(page)).toHaveText("");
});

test("Skrubba keeps keyboard focus while it waits", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toBeVisible({ timeout: 10_000 });
  await runButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(runButton(page)).toHaveText(/^Skrubbar … \d+ %/);
  await expect(runButton(page)).toBeFocused();
  await expect(runButton(page)).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter"); // a second press while waiting does nothing
  await expect(scrubbedBox(page)).not.toHaveValue("", { timeout: 120_000 });
});

// The browser lets a page write the clipboard only shortly after a key press.
// After a long wait the copy would fail, so Skrubba asks for one more press.
test("the copy shortcut during a long reading asks for Kopiera once the text is scrubbed", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "reads the clipboard");
  await openReady(page);
  await editor(page).fill(longText(80_000));
  await expect(scanLine(page)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toHaveText(/Texten är skrubbad\. Tryck Kopiera/, { timeout: 120_000 });
  const copyButton = page.getByRole("button", { name: "Kopiera", exact: true });
  await expect(copyButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast")).toHaveText(/^Kopierat\./);
  expect(await clipboard(page)).toBe(await scrubbedBox(page).inputValue());
});

test("a short text shows neither", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Anna Berg ringde om avtalet.");
  await runButton(page).click();
  await expect(scrubbedBox(page)).not.toHaveValue("");
  await page.waitForTimeout(800);
  await expect(scanLine(page)).toHaveCount(0);
  await expect(runButton(page)).toHaveText(/^Skrubba/);
});
