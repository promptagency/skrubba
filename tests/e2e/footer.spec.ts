import { readFileSync } from "node:fs";
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

test("the credits link maskera and KB-BERT and end with where the source code is", async ({ page }) => {
  await openReady(page);
  const credits = page.locator(".site-footer p").nth(1);
  await expect(credits).toHaveText(
    "Bygger på maskera (MIT) av Hägvall Labs och KB-BERT (CC0) från Kungliga biblioteket. Källkod till Skrubba finns på Github.",
  );
  for (const [name, href] of [
    ["maskera", "https://github.com/joelhagvall/maskera"],
    ["KB-BERT", "https://huggingface.co/KBLab"],
  ]) {
    const link = credits.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  // Github is a link once the repository is public and REPO_URL is set.
  await expect(credits.getByRole("link")).toHaveCount(REPO_URL ? 3 : 2);
  if (REPO_URL) await expect(credits.getByRole("link", { name: "Github" })).toHaveAttribute("href", REPO_URL);
});

test("the footer ends with the version from package.json", async ({ page }) => {
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  await openReady(page);
  const last = page.locator(".site-footer p").last();
  await expect(last).toHaveText(`Version ${version}`);
  // The version links to what is new in it, once the repository is public.
  if (!REPO_URL) return;
  const link = last.getByRole("link", { name: `Vad är nytt i version ${version}`, exact: true });
  await expect(link).toHaveAttribute("href", `${REPO_URL}/releases`);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
