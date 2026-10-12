import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

const QUESTIONS = [
  "Vad händer med min text?",
  "Vilka uppgifter hittar Skrubba?",
  "Hur döljer jag något som Skrubba missade?",
  "Vad händer om AI:n ändrar platshållarna?",
  "Vad är kodnyckeln?",
  "Hur kan jag kontrollera att inget skickas?",
  "Vad gör Skrubba inte?",
  "Vilka AI-tjänster fungerar det med?",
  "Kostar Skrubba något?",
  "Räknar ni besökare?",
];

test("Vanliga frågor opens as a modal over the app, and closing it leaves the text intact", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Hej Anna.");
  await page.getByRole("button", { name: "Vanliga frågor" }).click();
  const faq = page.getByRole("dialog", { name: "Vanliga frågor" });
  await expect(faq).toBeVisible();
  for (const q of QUESTIONS) await expect(faq.getByRole("heading", { name: q })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.keyboard.press("Escape");
  await expect(faq).toBeHidden();
  await expect(editor(page)).toHaveValue("Hej Anna.");
});

test("the trust line in the footer opens Vanliga frågor too", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Allt sker på din dator" }).click();
  const faq = page.getByRole("dialog", { name: "Vanliga frågor" });
  await expect(faq).toBeVisible();
  await faq.getByRole("button", { name: "Stäng" }).click();
  await expect(faq).toBeHidden();
});

test("Vanliga frågor is an accordion: one answer open at a time", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Vanliga frågor" }).click();
  const faq = page.getByRole("dialog", { name: "Vanliga frågor" });
  const answer = (text: string) => faq.getByText(text, { exact: false });
  const key = "Den är ingen krypteringsnyckel och låser inget.";
  const check = "Inga anrop går till någon annan adress än den här sidan.";

  // All closed to start with, so the questions can be scanned.
  await expect(answer(key)).toBeHidden();
  await expect(answer(check)).toBeHidden();

  await faq.getByText(QUESTIONS[4], { exact: true }).click();
  await expect(answer(key)).toBeVisible();

  await faq.getByText(QUESTIONS[5], { exact: true }).click();
  await expect(answer(check)).toBeVisible();
  await expect(answer(key)).toBeHidden();

  // Clicking the open question closes it.
  await faq.getByText(QUESTIONS[5], { exact: true }).click();
  await expect(answer(check)).toBeHidden();

  // The keyboard works too: Enter on a focused question opens it.
  await faq.locator("summary", { hasText: QUESTIONS[4] }).focus();
  await page.keyboard.press("Enter");
  await expect(answer(key)).toBeVisible();
});
