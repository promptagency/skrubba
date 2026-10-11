import { expect, test } from "@playwright/test";
import { openReady } from "./helpers.ts";

// "Så här funkar det" sits after Vanliga frågor, behind a vertical line, and
// opens the walkthrough video in a window. The video loads only then.

const howto = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Så här funkar det" });
const window_ = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Så här funkar det" });

test("Så här funkar det follows Vanliga frågor on the same row, after a vertical line", async ({ page }) => {
  await openReady(page);
  const faq = (await page.getByRole("button", { name: "Vanliga frågor" }).boundingBox())!;
  const link = (await howto(page).boundingBox())!;
  const line = (await page.locator(".help-sep").boundingBox())!;
  expect(Math.abs(faq.y + faq.height / 2 - (link.y + link.height / 2))).toBeLessThan(2);
  expect(line.x).toBeGreaterThan(faq.x + faq.width);
  expect(link.x).toBeGreaterThan(line.x + line.width);
  await expect(howto(page)).toHaveAttribute("aria-haspopup", "dialog");
  await expect(howto(page)).toHaveCSS("text-decoration-line", "underline");
});

test("the window shows the video, which is not downloaded until the window opens", async ({ page }) => {
  const videoRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/video/")) videoRequests.push(r.url());
  });
  await openReady(page);
  await page.waitForTimeout(500);
  expect(videoRequests).toEqual([]);

  await howto(page).click();
  await expect(window_(page)).toBeVisible();
  const video = window_(page).locator("video");
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("src", "/video/skrubba-demo.mp4");
  await expect(video).toHaveAccessibleDescription(/Klistra in din text/);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(window_(page)).toBeHidden();
  await expect(page.locator("video")).toHaveCount(0); // closing stops it
});
