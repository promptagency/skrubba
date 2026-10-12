import { expect, test } from "@playwright/test";
import { answerBox, editor, openReady, restoredBox, runButton, scrub, scrubbedBox } from "./helpers.ts";

// "Ny text" under the button between the panes starts over with a new text.
// In Skrubba it also starts a new kodnyckel, after asking; Egna ord stay.
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

test("in Skrubba, Ny text with no kodnyckel yet empties the text without asking", async ({ page }) => {
  await openReady(page);
  let asked = false;
  page.on("dialog", (d) => {
    asked = true;
    void d.dismiss();
  });
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await newText(page).click();
  await expect(editor(page)).toHaveValue("");
  await expect(editor(page)).toBeFocused();
  await expect(newText(page)).toHaveCount(0);
  expect(asked).toBe(false);
});

test("in Skrubba, Ny text asks first, then starts a new kodnyckel and keeps Egna ord", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  const words = await page.locator(".words summary").textContent();
  await scrub(page);
  const asked: string[] = [];
  page.on("dialog", (d) => {
    asked.push(d.message());
    void d.accept();
  });
  await newText(page).click();
  expect(asked).toEqual([
    "Den nya texten får en ny kodnyckel. Svar på den förra texten går då inte att avskrubba, om du inte har laddat ner kodnyckeln. Vill du fortsätta?",
  ]);
  await expect(editor(page)).toHaveValue("");
  await expect(editor(page)).toBeFocused();
  await expect(scrubbedBox(page)).toHaveValue("");
  await expect(page.locator(".words summary")).toHaveText(words!);
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(0);

  // Numbering starts again.
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await scrub(page);
  await expect(scrubbedBox(page)).toHaveValue("Igår ringde [NAMN_1].");
});

test("in Skrubba, saying no to Ny text leaves everything as it was", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Igår ringde Johan Lindqvist.");
  await scrub(page);
  page.on("dialog", (d) => void d.dismiss());
  await newText(page).click();
  await expect(editor(page)).toHaveValue("Igår ringde Johan Lindqvist.");
  await expect(scrubbedBox(page)).toHaveValue("Igår ringde [NAMN_1].");
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toBeVisible();
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
