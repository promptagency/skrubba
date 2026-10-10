import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

test("the trust line opens Så funkar Skrubba, and the app comes back with the text intact", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Hej Anna.");
  await page.getByRole("link", { name: "Inget lämnar din dator" }).click();
  await expect(page).toHaveURL(/\/sa-funkar-det$/);
  await expect(page.getByRole("heading", { level: 1, name: "Så funkar Skrubba" })).toBeVisible();
  await expect(page.getByText("Vad som händer.")).toBeVisible();
  await expect(page.getByText("Så kontrollerar du det själv.")).toBeVisible();
  await expect(page.getByText("Det Skrubba inte gör.")).toBeVisible();
  await expect(page.getByText(/Skrubba bygger på maskera \(MIT\) av Hägvall Labs/)).toBeVisible();

  await page.goBack();
  await expect(editor(page)).toHaveValue("Hej Anna.");
});

test("? in the top bar opens the page, and the brand leads back", async ({ page }) => {
  await openReady(page);
  await page.getByRole("link", { name: "Så funkar Skrubba" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Så funkar Skrubba" })).toBeVisible();
  await page.getByRole("link", { name: "Skrubba", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(editor(page)).toBeVisible();
});

test("the page loads directly by URL", async ({ page }) => {
  await page.goto("/sa-funkar-det");
  await expect(page.getByRole("heading", { level: 1, name: "Så funkar Skrubba" })).toBeVisible();
});
