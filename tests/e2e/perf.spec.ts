import { expect, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady } from "./helpers.ts";

const FIRST = ["Anna", "Erik", "Sara", "Johan", "Maria", "Lars", "Karin", "Ahmed", "Fatima", "Nils", "Eva", "Oskar"];
const LAST = ["Berg", "Lindqvist", "Holm", "Ekström", "Hassan", "Sundberg", "Nyberg", "Wallin", "Brandt", "Strand"];

function longText(): string {
  let text = "";
  for (let i = 0; text.length < 10_000; i++) {
    text += `Enligt protokollet ${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]} ringde om avtalet. `;
    if (i % 6 === 5) text += "\n\n";
  }
  return text;
}

// Phase 4 budget: 10 000 characters masked in under 3 s once the model is loaded.
test("10 000 characters are masked and copied in under 3 seconds", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "reads the clipboard");
  await openReady(page);
  const text = longText();
  await editor(page).fill(text);
  // Let the background masking of the pasted text finish first: the model
  // worker takes one request at a time, so Kopiera would otherwise queue.
  const t1 = Date.now();
  let last = -1;
  await expect
    .poll(async () => {
      const n = await page.locator(".row-main").count();
      const stable = n > 0 && n === last;
      last = n;
      return stable;
    }, { intervals: [1000], timeout: 30_000 })
    .toBe(true);
  console.log(`PERF background masking settled after ~${Date.now() - t1 - 1000} ms`);

  const t0 = Date.now();
  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toBeVisible({ timeout: 10_000 });
  const ms = Date.now() - t0;
  info.annotations.push({ type: "ms", description: String(ms) });
  console.log(`PERF ${text.length} chars masked and copied in ${ms} ms`);

  const copied = await clipboard(page);
  for (const last of LAST) expect(copied).not.toContain(last);
  expect(ms).toBeLessThan(3000);
});

test("the page is cross-origin isolated, so the model can use several threads", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
