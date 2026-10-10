import { expect, type Locator, type Page, test } from "@playwright/test";
import { answerBox, copyScrubbed, editor, openReady, rows } from "./helpers.ts";

// Simulate dropping one file on an element.
async function dropFile(page: Page, target: Locator, name: string, type: string, content: string) {
  const data = await page.evaluateHandle(
    ({ name, type, content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([content], name, { type }));
      return dt;
    },
    { name, type, content },
  );
  await target.dispatchEvent("dragover", { dataTransfer: data });
  await target.dispatchEvent("drop", { dataTransfer: data });
}

test("a dropped .txt file lands in the Skrubba card and is scrubbed", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "brev.txt", "text/plain", "Hej, Johan Lindqvist ringer i morgon.");
  await expect(editor(page)).toHaveValue("Hej, Johan Lindqvist ringer i morgon.");
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
});

test("a dropped .md file lands in the Avskrubba card", async ({ page }) => {
  await openReady(page);
  await dropFile(page, answerBox(page), "svar.md", "text/markdown", "# Svar\n\nHej [NAMN_1].");
  await expect(answerBox(page)).toHaveValue("# Svar\n\nHej [NAMN_1].");
});

test("a dropped PDF is refused with a message and nothing changes", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Befintlig text.");
  await dropFile(page, editor(page), "avtal.pdf", "application/pdf", "%PDF-1.7");
  await expect(page.getByRole("alert")).toHaveText(
    "Bara textfiler (.txt och .md) går att släppa här. Kopiera texten ur andra filer och klistra in den.",
  );
  await expect(editor(page)).toHaveValue("Befintlig text.");
});

test("the key button says there is no key, then counts what the key holds", async ({ page }) => {
  await openReady(page);
  const keyButton = page.getByRole("button", { name: /^Nyckel/ });
  await expect(keyButton).toHaveText("Ingen nyckel än");
  await editor(page).fill("Johan Lindqvist ringde från Umeå.");
  await expect(rows(page)).toHaveCount(2);
  await copyScrubbed(page).click();
  await expect(keyButton).toHaveText("2 uppgifter");
});

test("the Avskrubba button swaps values back, then becomes Kopiera", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Johan Lindqvist ringde.");
  await expect(rows(page)).toHaveCount(1);
  await copyScrubbed(page).click();
  await answerBox(page).fill("Hälsa [NAMN_1].");
  const button = page.locator(".card-column").nth(1).locator(".card-actions .primary");
  await expect(button).toHaveText("Avskrubba");
  await button.click();
  await expect(answerBox(page)).toHaveValue("Hälsa Johan Lindqvist.");
  await expect(button).toHaveText("Kopiera");
  await answerBox(page).fill("Ny text [NAMN_1].");
  await expect(button).toHaveText("Avskrubba");
});
