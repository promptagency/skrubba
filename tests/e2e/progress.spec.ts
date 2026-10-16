import { expect, type Page, test } from "@playwright/test";
import { editor, openReady, rows, runButton, scrubbedBox } from "./helpers.ts";

const FIRST = ["Anna", "Erik", "Sara", "Johan", "Maria", "Lars", "Karin", "Nils"];
const LAST = ["Berg", "Lindqvist", "Holm", "Ekström", "Sundberg", "Nyberg", "Wallin", "Strand"];

// Long enough that the model takes well over half a second in every engine.
function longText(chars = 40_000): string {
  let text = "";
  for (let i = 0; text.length < chars; i++) text += `och sen sa ${FIRST[i % 8]} ${LAST[(i * 3) % 8]} att vi skulle ta det på mötet `;
  return text;
}

const scanLine = (page: Page) => page.locator(".scan-progress");
const pct = async (page: Page) => Number(/(\d+) %/.exec((await scanLine(page).textContent()) ?? "")?.[1] ?? -1);

test("a long text shows how far the model has read, then the names", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toHaveText(/^Letar efter namn och platser … \d+ %$/, { timeout: 10_000 });
  const first = await pct(page);
  await expect.poll(() => pct(page), { timeout: 60_000 }).toBeGreaterThan(first);
  await expect(scanLine(page)).toHaveCount(0, { timeout: 120_000 });
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Skrubba during the run shows its progress and then the result", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toBeVisible({ timeout: 10_000 });
  await runButton(page).click();
  await expect(runButton(page)).toHaveText(/^Skrubbar … \d+ %/);
  await expect(runButton(page)).toBeDisabled();
  await expect(scrubbedBox(page)).not.toHaveValue("", { timeout: 120_000 });
  await expect(runButton(page)).toHaveText(/^Skrubba/);
  await expect(scrubbedBox(page)).not.toHaveValue(/Anna Berg/);
});

test("a short text shows neither", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Anna Berg ringde om avtalet.");
  await runButton(page).click();
  await expect(scrubbedBox(page)).not.toHaveValue("");
  await page.waitForTimeout(800);
  await expect(scanLine(page)).toHaveCount(0);
  await expect(runButton(page)).toHaveText(/^Skrubba/);
});
