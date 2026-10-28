import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { openReady } from "./helpers.ts";

// Egna ord live only in memory, so a standing list is saved as a text file and fetched next time.

const words = (page: Page) => page.getByRole("textbox", { name: "Egna ord" });
const fileInput = (page: Page) => page.locator('.words input[type="file"]');

async function openWords(page: Page) {
  await openReady(page);
  await page.locator(".words summary").click();
}

test("Spara ord downloads the list; Hämta ord adds the words that are new", async ({ page, context }) => {
  await openWords(page);
  await expect(page.getByRole("button", { name: "Spara ord" })).toBeDisabled();
  await words(page).fill("Projekt Havsvind\nSnabbkassan");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Spara ord" }).click()]);
  expect(download.suggestedFilename()).toBe("skrubba-egna-ord.txt");
  const path = await download.path();
  expect(readFileSync(path, "utf8")).toBe("Projekt Havsvind\nSnabbkassan\n");

  const fresh = await context.newPage();
  await openWords(fresh);
  await words(fresh).fill("snabbkassan\nPolaris");
  await fileInput(fresh).setInputFiles(path);
  await expect(fresh.locator(".toast")).toHaveText("1 ord hämtat.");
  await expect(words(fresh)).toHaveValue("snabbkassan\nPolaris\nProjekt Havsvind");
  await expect(fresh.locator(".words summary")).toHaveText("Egna ord (3)");

  await fileInput(fresh).setInputFiles(path);
  await expect(fresh.locator(".toast")).toHaveText("Inga nya ord i filen.");
});

test("Hämta ord with a file that is not text says so and changes nothing", async ({ page }) => {
  await openWords(page);
  await words(page).fill("Polaris");
  await fileInput(page).setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]) });
  await expect(page.locator(".toast")).toHaveText("Filen gick inte att läsa. Välj en textfil med ett ord per rad.");
  await expect(words(page)).toHaveValue("Polaris");
});
