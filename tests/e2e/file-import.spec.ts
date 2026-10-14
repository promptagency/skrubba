import { expect, test } from "@playwright/test";
import { SAMPLE_TEXT } from "../fixtures/documents/build.ts";
import { answerBox, dropFile, editor, fileWindow, openReady, rows } from "./helpers.ts";

test("a dropped text file opens the window, and Använd texten puts it in Din text", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toBeVisible();
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Text · 23 ord");
  await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
  const use = w.getByRole("button", { name: "Använd texten" });
  await expect(use).toBeFocused();
  await use.click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue(SAMPLE_TEXT);
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Välj fil opens the same window", async ({ page }) => {
  await openReady(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Välj fil" }).click();
  await (await chooser).setFiles({ name: "avtal.md", mimeType: "text/markdown", buffer: Buffer.from(SAMPLE_TEXT) });
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(editor(page)).toHaveValue(/Storgatan 12/);
});

test("a dropped file lands in Svar från AI in Avskrubba", async ({ page }) => {
  await openReady(page);
  const box = await answerBox(page);
  await dropFile(page, box, "svar.md", "text/markdown", "# Svar\n\nHej [NAMN_1].");
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(box).toHaveValue("# Svar\n\nHej [NAMN_1].");
});

test("with text in the pane, the window warns, and Avbryt keeps the old text", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toContainText("Texten som står i rutan nu ersätts.");
  await w.getByRole("button", { name: "Avbryt" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue("Min egen text.");
});

test("Esc closes the window and changes nothing", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  await expect(fileWindow(page).getByRole("button", { name: "Använd texten" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(fileWindow(page)).toBeHidden();
  await expect(editor(page)).toHaveValue("Min egen text.");
});

test("an unsupported file gets a plain message and changes nothing", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "bild.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  const w = fileWindow(page);
  await expect(w.getByRole("alert")).toHaveText(/^Den här filtypen går inte att läsa\./);
  await w.getByRole("button", { name: "Stäng" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue("");
});

test("dropping two files reads the first and says so", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT, ["annat.txt"]);
  const w = fileWindow(page);
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Bara en fil i taget. Den första lästes.");
});

test.describe("while reading", () => {
  // Without the offline cache, page.route sees the reader worker's request and can hold it.
  test.use({ serviceWorkers: "block" });

  test("Avbryt stops the read and leaves the pane alone", async ({ page }) => {
    await openReady(page);
    await editor(page).fill("Min egen text.");
    await page.route("**/readerWorker-*.js", () => new Promise(() => {}));
    await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
    const w = fileWindow(page);
    await expect(w.getByRole("status")).toHaveText("Läser dokumentet …");
    await w.getByRole("button", { name: "Avbryt" }).click();
    await expect(w).toBeHidden();
    await expect(editor(page)).toHaveValue("Min egen text.");
  });
});
