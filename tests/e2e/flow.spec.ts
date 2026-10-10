import { expect, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady, rows } from "./helpers.ts";

// Two operations, one at a time: the switch picks Skrubba or Avskrubba, the
// button between the panes runs it, the result appears on the right and only
// then can it be copied.

const TEXT = "Johan Lindqvist ringde från Umeå.";

const modeSwitch = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "Vad vill du göra?" });
const run = (page: import("@playwright/test").Page) => page.locator(".run");
const result = (page: import("@playwright/test").Page, name: string) => page.getByRole("textbox", { name, exact: true });
const copy = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Kopiera" });

test("Skrubba shows the scrubbed text on the right, then offers Kopiera", async ({ page }) => {
  await openReady(page);
  await expect(modeSwitch(page).getByRole("button", { name: "Skrubba", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(run(page)).toHaveAccessibleName("Skrubba");
  await expect(result(page, "Skrubbad text")).toHaveValue("");
  await expect(copy(page)).toHaveCount(0);

  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
  await run(page).click();

  await expect(result(page, "Skrubbad text")).toHaveValue(/^\[NAMN_\d+\] ringde från \[(PLATS|ORGANISATION)_\d+\]\.$/);
  await expect(result(page, "Skrubbad text")).toHaveAttribute("readonly", "");
  await expect(copy(page)).toBeVisible();
  await expect(copy(page)).toBeFocused();
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveText("2 uppgifter");
});

test("changing the text or what is scrubbed clears the result", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
  await run(page).click();
  await expect(copy(page)).toBeVisible();

  await editor(page).press("End");
  await page.keyboard.type(" Hej.");
  await expect(result(page, "Skrubbad text")).toHaveValue("");
  await expect(copy(page)).toHaveCount(0);

  await run(page).click();
  await expect(copy(page)).toBeVisible();
  await rows(page).first().click();
  await page.keyboard.press("Space");
  await expect(result(page, "Skrubbad text")).toHaveValue("");
});

test("Kopiera copies the scrubbed text", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "reads the clipboard");
  await openReady(page);
  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
  await run(page).click();
  await expect(result(page, "Skrubbad text")).toHaveValue(/NAMN_/);
  const scrubbed = await result(page, "Skrubbad text").inputValue();
  await copy(page).click();
  expect(await clipboard(page)).toBe(scrubbed);
  await expect(page.locator(".toast")).toHaveText(/^Kopierat\. 2 uppgifter skrubbade\./);
});

test("Avskrubba puts the real values back on the right; each mode keeps its own panes", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
  await page.keyboard.press(`${MOD}+Enter`);
  await expect(result(page, "Skrubbad text")).toHaveValue(/NAMN_/);
  const scrubbed = await result(page, "Skrubbad text").inputValue();
  const johan = scrubbed.match(/\[NAMN_\d+\]/)![0];

  await modeSwitch(page).getByRole("button", { name: "Avskrubba" }).click();
  await expect(modeSwitch(page).getByRole("button", { name: "Avskrubba" })).toHaveAttribute("aria-pressed", "true");
  await expect(run(page)).toHaveAccessibleName("Avskrubba");
  const answer = result(page, "Svar från AI");
  await expect(answer).toHaveValue("");
  await expect(copy(page)).toHaveCount(0);

  await answer.fill(`Hälsa ${johan}.`);
  await run(page).click();
  await expect(result(page, "Avskrubbad text")).toHaveValue("Hälsa Johan Lindqvist.");
  await expect(answer).toHaveValue(`Hälsa ${johan}.`);
  await expect(copy(page)).toBeVisible();

  await modeSwitch(page).getByRole("button", { name: "Skrubba", exact: true }).click();
  await expect(editor(page)).toHaveValue(TEXT);
  await expect(result(page, "Skrubbad text")).toHaveValue(scrubbed);

  await modeSwitch(page).getByRole("button", { name: "Avskrubba" }).click();
  await expect(result(page, "Avskrubbad text")).toHaveValue("Hälsa Johan Lindqvist.");
  await answer.fill("Något annat.");
  await expect(result(page, "Avskrubbad text")).toHaveValue("");
});

test("text with placeholders in Skrubba offers to move it to Avskrubba", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Hej [NAMN_1], tack för senast.");
  const notice = page.getByText("Texten innehåller platshållare som [NAMN_1]. Är det svaret från AI?");
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Flytta till Avskrubba" }).click();

  await expect(modeSwitch(page).getByRole("button", { name: "Avskrubba" })).toHaveAttribute("aria-pressed", "true");
  await expect(result(page, "Svar från AI")).toHaveValue("Hej [NAMN_1], tack för senast.");
  await modeSwitch(page).getByRole("button", { name: "Skrubba", exact: true }).click();
  await expect(editor(page)).toHaveValue("");
  await expect(notice).toHaveCount(0);
});
