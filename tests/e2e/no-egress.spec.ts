import { expect, test } from "@playwright/test";

// Privacy: a full mask → restore session may only touch the app's own origin.
test("mask and restore with the model makes no request outside our origin", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByRole("status")).toHaveAttribute("data-state", "ready", { timeout: 90_000 });

  const text = "Johan Lindqvist (19850312-4471) flyttar till Umeå. Ring 070-1740612.";
  await page.getByLabel("Text").fill(text);
  const masked = page.getByTestId("masked");
  await expect(masked).toContainText("[NAMN_1]");
  await expect(masked).toContainText("[PERSONNUMMER_1]");
  await expect(masked).not.toContainText("Johan");
  await expect(masked).not.toContainText("Umeå");
  await expect(page.getByTestId("restored")).toHaveText(text);

  const outside = requests.filter((url) => !url.startsWith("data:") && new URL(url).origin !== origin);
  expect(outside).toEqual([]);
  expect(requests.some((url) => url.includes("/models/"))).toBe(true);
  expect(cspViolations).toEqual([]);
});
