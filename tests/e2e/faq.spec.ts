import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

const QUESTIONS = [
  "Vad händer med min text?",
  "Hur kan jag kontrollera att inget skickas?",
  "Vad gör Skrubba inte?",
  "Vad är kodnyckeln?",
];

test("Vanliga frågor opens as a modal over the app, and closing it leaves the text intact", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Hej Anna.");
  await page.getByRole("button", { name: "Vanliga frågor" }).click();
  const faq = page.getByRole("dialog", { name: "Vanliga frågor" });
  await expect(faq).toBeVisible();
  for (const q of QUESTIONS) await expect(faq.getByRole("heading", { name: q })).toBeVisible();
  await expect(faq.getByText("Den är ingen krypteringsnyckel och låser inget.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.keyboard.press("Escape");
  await expect(faq).toBeHidden();
  await expect(editor(page)).toHaveValue("Hej Anna.");
});

test("the trust line in the footer opens Vanliga frågor too", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Inget lämnar din dator" }).click();
  const faq = page.getByRole("dialog", { name: "Vanliga frågor" });
  await expect(faq).toBeVisible();
  await faq.getByRole("button", { name: "Stäng" }).click();
  await expect(faq).toBeHidden();
});
