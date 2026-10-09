import { expect, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady, rows } from "./helpers.ts";

const TEXT =
  "Hej Karin, Johan Lindqvist (850412-1234) är sjukskriven. Johans chef Sara Holm ringer. " +
  "Kunden Nordström Fastigheter vet inget om Projekt Havsvind.";

// Phase 2 definition of done: paste, review, adjust, add a word and copy
// without the mouse, in under 30 seconds.
test("paste, review, keep one, add a word and copy using only the keyboard", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "reads the clipboard");
  await openReady(page);
  const started = Date.now();

  await expect(editor(page)).toBeFocused();
  await page.keyboard.insertText(TEXT);
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "Nordström Fastigheter" })).toContainText("Organisation");

  // Review: Tab into the panel, walk down to Karin and keep her.
  await page.keyboard.press("Tab");
  await expect(rows(page).first()).toBeFocused();
  const karin = rows(page).filter({ hasText: "Karin" });
  for (let i = 0; i < 10 && !(await karin.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("ArrowDown");
  await expect(karin).toBeFocused();
  await page.keyboard.press("Space");
  await expect(karin).toHaveAccessibleName(/Behåll$/);

  // Add a word: Tab to Egna ord, open it, type.
  const words = page.getByRole("textbox", { name: "Egna ord" });
  for (let i = 0; i < 20 && !(await page.locator(".words summary").evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(words).toBeFocused();
  await page.keyboard.type("Havsvind");
  await expect(rows(page).filter({ hasText: "Havsvind" })).toContainText("Ord");

  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toContainText(/^Kopierat\. \d+ uppgifter skrubbade\.$/);
  const copied = await clipboard(page);
  expect(copied).toContain("Hej Karin");
  for (const secret of ["Johan", "Lindqvist", "850412-1234", "Sara Holm", "Nordström", "Havsvind"])
    expect(copied).not.toContain(secret);
  expect(copied).toMatch(/\[NAMN_\d+\]s chef/);

  expect(Date.now() - started).toBeLessThan(30_000);
});

test("M on a selection scrubs every occurrence as one Ord", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Kampanjen Blå Timmen startar. Blå Timmen pågår i maj.");
  await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(10, 10));
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("button", { name: /Skrubba markering/ })).toBeVisible();
  await page.keyboard.press("m");
  const row = rows(page).filter({ hasText: "Blå Timmen" });
  await expect(row).toContainText("Ord");
  await expect(row).toContainText("×2");
  await expect(editor(page)).toHaveValue("Kampanjen Blå Timmen startar. Blå Timmen pågår i maj.");
});

test("B on a selection inside a highlight sets it to Behåll", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Ring 070-1740612 i dag.");
  const row = rows(page).filter({ hasText: "070-1740612" });
  await expect(row).toHaveAccessibleName(/Skrubba$/);
  await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 9));
  await page.keyboard.press("b");
  await expect(row).toHaveAccessibleName(/Behåll$/);
  await expect(editor(page)).toHaveValue("Ring 070-1740612 i dag.");
});

test("Visa exempel loads the example with Projekt Havsvind under Egna ord", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(editor(page)).toHaveValue(/^Hej Karin,/);
  await expect(page.getByRole("textbox", { name: "Egna ord" })).toHaveValue("Projekt Havsvind");
  await expect(rows(page).filter({ hasText: "Projekt Havsvind" })).toContainText("Ord");
});

test("highlights line up with the text in the textarea", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  const mark = page.locator('.hl[data-ph]').filter({ hasText: "Lerum" });
  await expect(mark).toBeVisible();
  // Put the caret right before "Lerum" and compare positions via a mirror range.
  const offset = await editor(page).evaluate((el: HTMLTextAreaElement) => el.value.indexOf("Lerum"));
  const markBox = await mark.boundingBox();
  const overlayBox = await page.locator(".editor-overlay").boundingBox();
  const inputBox = await editor(page).boundingBox();
  expect(offset).toBeGreaterThan(0);
  expect(overlayBox).toEqual(inputBox);
  expect(markBox!.width).toBeGreaterThan(10);
  await page.screenshot({ path: "test-results/phase2-example.png" });
});
