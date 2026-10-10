import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { answerBox, editor, modeButton, openReady, restoredBox, rows, runButton, scrub } from "./helpers.ts";

// The kodnyckel is not on screen all the time. It shows up where it is
// needed: beside Kopiera once there is one, and in Avskrubba when this tab
// has none.

const keyLink = (page: Page) => page.getByRole("button", { name: /^Kodnyckel \(\d+\)$/ });
const missing = (page: Page) => page.getByText("Den här fliken har ingen kodnyckel.", { exact: false });
const upload = (page: Page) => page.getByRole("button", { name: "Ladda upp kodnyckel" });

async function scrubJohan(page: Page) {
  await editor(page).fill("Johan Lindqvist ringde från Umeå.");
  await expect(rows(page)).toHaveCount(2);
  await scrub(page);
}

test("there is no kodnyckel at the top; after Skrubba it sits beside Kopiera", async ({ page }) => {
  await openReady(page);
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(0);
  await expect(page.getByText("Visar vilka riktiga uppgifter", { exact: false })).toBeHidden(); // only inside the closed window

  await scrubJohan(page);
  await expect(keyLink(page)).toHaveText("Kodnyckel (2)");
  const link = await keyLink(page).boundingBox();
  const copy = await page.getByRole("button", { name: "Kopiera" }).boundingBox();
  expect(Math.abs(link!.y + link!.height / 2 - (copy!.y + copy!.height / 2))).toBeLessThan(4); // same row

  await keyLink(page).click();
  const dialog = page.getByRole("dialog", { name: "Kodnyckel" });
  await expect(dialog.getByText("Visar vilka riktiga uppgifter platshållarna står för", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("row").filter({ hasText: "Johan Lindqvist" })).toBeVisible();
});

test("the kodnyckel link stays after the result is cleared, so it can still be downloaded", async ({ page }) => {
  await openReady(page);
  await scrubJohan(page);
  await editor(page).fill("Något annat.");
  await expect(page.getByRole("button", { name: "Kopiera" })).toHaveCount(0);
  await expect(keyLink(page)).toHaveText("Kodnyckel (2)");
});

test("Avskrubba in a tab without a kodnyckel offers to upload one, and keeps the answer", async ({ page, context }) => {
  await openReady(page);
  await scrubJohan(page);
  await keyLink(page).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog").getByRole("button", { name: "Ladda ner kodnyckel" }).click(),
  ]);
  const path = await download.path();
  const johan = JSON.parse(readFileSync(path, "utf8")).entries.find((e: { value: string }) => e.value === "Johan Lindqvist").placeholder;

  const fresh = await context.newPage();
  await openReady(fresh);
  const answer = await answerBox(fresh);
  await expect(missing(fresh)).toBeVisible();
  await answer.fill(`Hälsa ${johan}.`);
  await fresh.locator('.key-missing input[type="file"]').setInputFiles(path);

  await expect(missing(fresh)).toHaveCount(0);
  await expect(answer).toHaveValue(`Hälsa ${johan}.`);
  await runButton(fresh).click();
  await expect(restoredBox(fresh)).toHaveValue("Hälsa Johan Lindqvist.");
  await expect(keyLink(fresh)).toHaveText("Kodnyckel (2)");
});

test("a file that is not a kodnyckel is refused with a message", async ({ page }) => {
  await openReady(page);
  await answerBox(page);
  await expect(upload(page)).toBeVisible();
  await page.locator('.key-missing input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByRole("alert")).toHaveText("Filen kunde inte läsas som en kodnyckel. Välj en fil som du har laddat ner från Skrubba.");
  await expect(missing(page)).toBeVisible();
});

test("Avskrubba does not ask for a kodnyckel when the tab has one", async ({ page }) => {
  await openReady(page);
  await scrubJohan(page);
  await modeButton(page, "Avskrubba").click();
  await expect(missing(page)).toHaveCount(0);
  await expect(upload(page)).toHaveCount(0);
});
