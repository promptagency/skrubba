import { expect, test } from "@playwright/test";
import { buildDocx, buildPdf, SAMPLE, wp } from "../fixtures/documents/build.ts";
import { clipboard, dropFile, editor, fileWindow, MOD, openReady } from "./helpers.ts";

// Privacy checks never retry on CI: a request that leaks only sometimes must
// block the release, not pass on a second try as "flaky".
test.describe.configure({ retries: 0 });

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

test("reading a PDF and a Word file makes no request outside our origin", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });

  await openReady(page);
  const files = [
    ["avtal.pdf", "application/pdf", buildPdf([[SAMPLE.title, ...SAMPLE.lines]])],
    ["avtal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buildDocx({ body: SAMPLE.lines.map(wp).join("") })],
  ] as const;
  for (const [name, type, bytes] of files) {
    await dropFile(page, editor(page), name, type, bytes);
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toHaveValue(/Anna Berg/);
  }

  const outside = requests.filter((url) => !url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin);
  expect(outside).toEqual([]);
  expect(cspViolations).toEqual([]);
});
