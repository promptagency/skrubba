import { expect, test } from "@playwright/test";
import { answerBox, editor, openReady, restoredBox, runButton, scrub, scrubbedBox } from "./helpers.ts";

// "Ny text" under the button between the panes starts over with a new text.
// Egna ord and the kodnyckel stay for the next text.
const newText = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Ny text", exact: true });

test("Ny text shows under the middle button only once there is text", async ({ page }) => {
  await openReady(page);
  await expect(newText(page)).toHaveCount(0);
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await expect(newText(page)).toBeVisible();
  const run = (await runButton(page).boundingBox())!;
  const link = (await newText(page).boundingBox())!;
  expect(link.y).toBeGreaterThanOrEqual(run.y + run.height);
  expect(Math.abs(link.x + link.width / 2 - (run.x + run.width / 2))).toBeLessThan(2);
  await expect(newText(page)).toHaveCSS("text-decoration-line", "underline");
});

test("in Skrubba, Ny text empties both panes and keeps Egna ord and the kodnyckel", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  const words = await page.locator(".words summary").textContent();
  await scrub(page);
  await newText(page).click();
  await expect(editor(page)).toHaveValue("");
  await expect(editor(page)).toBeFocused();
  await expect(scrubbedBox(page)).toHaveValue("");
  await expect(page.locator(".words summary")).toHaveText(words!);
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toBeVisible();
  await expect(newText(page)).toHaveCount(0);
});

test("in Avskrubba, Ny text empties the answer and its result", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await scrub(page);
  const scrubbed = await scrubbedBox(page).inputValue();
  const answer = await answerBox(page);
  await answer.fill(scrubbed);
  await runButton(page).click();
  await expect(restoredBox(page)).toHaveValue("Igår ringde Johan Lindqvist.");
  await newText(page).click();
  await expect(answer).toHaveValue("");
  await expect(answer).toBeFocused();
  await expect(restoredBox(page)).toHaveValue("");
});
