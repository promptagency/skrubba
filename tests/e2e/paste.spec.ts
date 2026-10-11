import { expect, type Page, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

// Text pasted into Din text is tidied: lines a PDF broke mid-sentence are
// joined, with a notice and Ångra to get the text back as it was pasted.
async function paste(page: Page, text: string) {
  await editor(page).focus();
  await editor(page).evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    // Firefox ignores clipboardData passed to the ClipboardEvent constructor.
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    el.dispatchEvent(event);
  }, text);
}

const PDF = [
  "2. Bakgrund",
  "Anna Berg är anställd i Norrström sedan april 2021 som AI-teknik strateg. Norrström Media",
  "har genomgått en omorganisation på grund av svikande efterfrågan från kunderna och",
  "har tagit bort 7 tjänster från organisationen på grund av arbetsbrist. Rollen som Anna",
  "Berg innehar är en av de berörda tjänsterna.",
].join("\n");
const JOINED = [
  "2. Bakgrund",
  "Anna Berg är anställd i Norrström sedan april 2021 som AI-teknik strateg. Norrström Media har genomgått en omorganisation på grund av svikande efterfrågan från kunderna och har tagit bort 7 tjänster från organisationen på grund av arbetsbrist. Rollen som Anna Berg innehar är en av de berörda tjänsterna.",
].join("\n");
const notice = (page: Page) => page.getByRole("status").filter({ hasText: "Radbrytningar mitt i meningar är borttagna." });

test("pasted PDF text has its broken lines joined, with a notice", async ({ page }) => {
  await openReady(page);
  await paste(page, PDF);
  await expect(editor(page)).toHaveValue(JOINED);
  await expect(notice(page)).toBeVisible();
});

test("Ångra puts the text back as it was pasted", async ({ page }) => {
  await openReady(page);
  await paste(page, PDF);
  await notice(page).getByRole("button", { name: "Ångra" }).click();
  await expect(editor(page)).toHaveValue(PDF);
  await expect(notice(page)).toHaveCount(0);
});

test("the notice goes away when the text is edited", async ({ page }) => {
  await openReady(page);
  await paste(page, PDF);
  await expect(notice(page)).toBeVisible();
  await editor(page).press("End");
  await editor(page).pressSequentially(" Slut.");
  await expect(notice(page)).toHaveCount(0);
});

test("a paste lands where the cursor is, between the text around it", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Före.\nEfter.");
  await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 6));
  await paste(page, "Hej\u00A0Anna\n");
  await expect(editor(page)).toHaveValue("Före.\nHej Anna\nEfter.");
  await expect(notice(page)).toHaveCount(0);
});

test("a typed-looking paste is left as it is, without a notice", async ({ page }) => {
  await openReady(page);
  const letter = "Hej Karin,\n\nJag skriver angående Johan.\nHan har varit sjuk.\n\nHälsningar\nMicke";
  await paste(page, letter);
  await expect(editor(page)).toHaveValue(letter);
  await expect(notice(page)).toHaveCount(0);
});
