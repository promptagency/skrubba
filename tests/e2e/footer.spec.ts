import { expect, test } from "@playwright/test";
import { openReady } from "./helpers.ts";

test("the footer starts with who made Skrubba, linked in new tabs", async ({ page }) => {
  await openReady(page);
  const byline = page.locator(".site-footer p").first();
  await expect(byline).toHaveText("Skrubba av Micke Quick (Prompt Agency).");
  await expect(byline.locator("strong")).toHaveText("Skrubba");
  for (const [name, href] of [
    ["Micke Quick", "https://mickequick.se"],
    ["Prompt Agency", "https://promptagency.se"],
  ]) {
    const link = byline.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    // A new tab, so following it never loses the text and kodnyckel in this one.
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
