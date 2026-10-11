import { expect, type Page, test } from "@playwright/test";
import { editor, openReady, rows } from "./helpers.ts";

// The items found are not a long list under the pane: the count under the pane
// opens them in a window, like the kodnyckel. Egna ord stays under the pane.

const TEXT = "Johan Lindqvist ringde från Umeå.";
const countLink = (page: Page) => page.getByRole("button", { name: /^\d+ uppgift(er)? Visa$/ });
const items = (page: Page) => page.getByRole("dialog", { name: "Uppgifter" });

async function withText(page: Page) {
  await openReady(page);
  await editor(page).fill(TEXT);
  await expect(rows(page)).toHaveCount(2);
}

test("the count under the pane opens the items in a window; no list on the page", async ({ page }) => {
  await withText(page);
  await expect(countLink(page)).toHaveAccessibleName("2 uppgifter Visa");
  await expect(countLink(page)).toHaveAttribute("aria-haspopup", "dialog");
  await expect(rows(page).first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Skrubba alla" })).toBeHidden();

  await countLink(page).click();
  await expect(items(page)).toBeVisible();
  await expect(items(page).locator(".row-main")).toHaveCount(2);
  await expect(items(page).getByRole("button", { name: "Skrubba alla" })).toBeVisible();
  await expect(items(page).getByRole("button", { name: "Behåll alla" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(items(page)).toBeHidden();
});

test("clicking an item closes the window and shows it in the text", async ({ page }) => {
  await withText(page);
  await countLink(page).click();
  await items(page).locator(".row-main").filter({ hasText: "Johan Lindqvist" }).click();
  await expect(items(page)).toBeHidden();
  await expect(page.locator(".hl-flash")).not.toHaveCount(0);
});

test("in the window, Space keeps an item and its highlight gets a border", async ({ page }) => {
  await withText(page);
  await countLink(page).click();
  const johan = items(page).locator(".row-main").filter({ hasText: "Johan Lindqvist" });
  await johan.focus();
  await page.keyboard.press("Space");
  await expect(johan).toHaveAccessibleName(/Behåll$/);
  await expect(items(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".hl-kept")).toHaveCount(1);
});

test("Egna ord stays under the pane, folded, also after Visa exempel", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(rows(page).filter({ hasText: "Projekt Havsvind" })).toContainText("Ord");
  const summary = page.locator(".words summary");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveText("Egna ord (1)");
  await expect(page.locator(".modal .words")).toHaveCount(0);
  const words = page.locator(".words textarea"); // folded, so not in the accessibility tree
  await expect(words).toBeHidden();
  await expect(words).toHaveValue("Projekt Havsvind");
});
