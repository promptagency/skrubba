import { expect, test } from "@playwright/test";
import { REPO_URL } from "../../src/config.ts";
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

test("the credits end with where the source code is", async ({ page }) => {
  await openReady(page);
  const credits = page.locator(".site-footer p").nth(1);
  await expect(credits).toHaveText(
    "Bygger på maskera (MIT) av Hägvall Labs och KB-BERT (CC0) från Kungliga biblioteket. Öppen källkod finns på GitHub.",
  );
  // GitHub is a link once the repository is public and REPO_URL is set.
  await expect(credits.getByRole("link")).toHaveCount(REPO_URL ? 1 : 0);
  if (REPO_URL) await expect(credits.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", REPO_URL);
});
