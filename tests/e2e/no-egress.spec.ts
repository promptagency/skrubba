import { expect, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady } from "./helpers.ts";

// Privacy: a full session may only touch the app's own origin.
test("masking and copying with the model makes no request outside our origin", async ({ page, context, baseURL, browserName }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });

  await openReady(page);
  await editor(page).fill("Johan Lindqvist (19850312-4471) flyttar till Umeå. Ring 070-1740612.");
  await expect(page.locator(".row-main")).not.toHaveCount(0);
  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toBeVisible();
  if (browserName === "chromium") {
    const copied = await clipboard(page);
    expect(copied).toContain("[NAMN_1]");
    expect(copied).not.toContain("Johan");
  }

  const outside = requests.filter((url) => !url.startsWith("data:") && new URL(url).origin !== origin);
  expect(outside).toEqual([]);
  expect(requests.some((url) => url.includes("/models/"))).toBe(true);
  expect(cspViolations).toEqual([]);
});
