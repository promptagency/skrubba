import { expect, test } from "@playwright/test";
import { clipboard, editor, MOD, openReady, rows } from "./helpers.ts";

const TEXT =
  "Hej Karin, Johan Lindqvist (850412-1234) är sjukskriven. Johans chef Sara Holm ringer. " +
  "Kunden Nordström Fastigheter vet inget om Projekt Havsvind.";

// Phase 2 definition of done: paste, review, adjust, add a word and copy
// without the mouse, in under 30 seconds.
test("paste, review, keep one, add a word and copy using only the keyboard", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "reads the clipboard");
  await openReady(page);
  const started = Date.now();

  await expect(editor(page)).toBeFocused();
  await page.keyboard.insertText(TEXT);
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "Nordström Fastigheter" })).toContainText("Organisation");

  // Review: Tab to the count, open the Uppgifter window, walk down to Karin and keep her.
  const count = page.getByRole("button", { name: /^\d+ uppgifter Visa$/ });
  for (let i = 0; i < 5 && !(await count.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 5 && !(await rows(page).first().evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(rows(page).first()).toBeFocused();
  const karin = rows(page).filter({ hasText: "Karin" });
  for (let i = 0; i < 10 && !(await karin.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("ArrowDown");
  await expect(karin).toBeFocused();
  await page.keyboard.press("Space");
  await expect(karin).toHaveAccessibleName(/behålls$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Uppgifter" })).toBeHidden();

  // Add a word: Tab to Egna ord, open it, type.
  const words = page.getByRole("textbox", { name: "Egna ord" });
  for (let i = 0; i < 20 && !(await page.locator(".words summary").evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(words).toBeFocused();
  await page.keyboard.type("Havsvind");
  await expect(rows(page).filter({ hasText: "Havsvind" })).toContainText("Ord");

  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toContainText(/^Kopierat\. \d+ uppgifter skrubbade\.$/);
  const copied = await clipboard(page);
  expect(copied).toContain("Hej Karin");
  for (const secret of ["Johan", "Lindqvist", "850412-1234", "Sara Holm", "Nordström", "Havsvind"])
    expect(copied).not.toContain(secret);
  expect(copied).toMatch(/\[FÖRNAMN_\d+\]s chef/);

  expect(Date.now() - started).toBeLessThan(30_000);
});

test("M on a selection scrubs every occurrence as one Ord", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Kampanjen Blå Timmen startar. Blå Timmen pågår i maj.");
  await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(10, 10));
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("button", { name: /Skrubba markering/ })).toBeVisible();
  await page.keyboard.press("m");
  const row = rows(page).filter({ hasText: "Blå Timmen" });
  await expect(row).toContainText("Ord");
  await expect(row).toContainText("×2");
  await expect(editor(page)).toHaveValue("Kampanjen Blå Timmen startar. Blå Timmen pågår i maj.");
});

test("B on a selection inside a highlight sets it to Behåll", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Ring 070-1740612 i dag.");
  const row = rows(page).filter({ hasText: "070-1740612" });
  await expect(row).toHaveAttribute("aria-label", /skrubbas$/);
  await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 9));
  await page.keyboard.press("b");
  await expect(row).toHaveAttribute("aria-label", /behålls$/);
  await expect(editor(page)).toHaveValue("Ring 070-1740612 i dag.");
});

test("Visa exempel loads the example with Projekt Havsvind under Egna ord", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  await expect(editor(page)).toHaveValue(/^Hej Karin,/);
  await expect(page.locator(".words textarea")).toHaveValue("Projekt Havsvind");
  await expect(rows(page).filter({ hasText: "Projekt Havsvind" })).toContainText("Ord");
});

test("highlights line up with the text in the textarea", async ({ page }) => {
  await openReady(page);
  await page.getByRole("button", { name: "Visa exempel" }).click();
  const mark = page.locator('.hl[data-ph]').filter({ hasText: "Lerum" });
  await expect(mark).toBeVisible();
  // Put the caret right before "Lerum" and compare positions via a mirror range.
  const offset = await editor(page).evaluate((el: HTMLTextAreaElement) => el.value.indexOf("Lerum"));
  const markBox = await mark.boundingBox();
  const overlayBox = await page.locator(".editor-overlay").first().boundingBox();
  const inputBox = await editor(page).boundingBox();
  expect(offset).toBeGreaterThan(0);
  expect(overlayBox).toEqual(inputBox);
  expect(markBox!.width).toBeGreaterThan(10);
  await page.screenshot({ path: "test-results/phase2-example.png" });
});

test.describe("clicking a highlighted word in the text", () => {
  const SHORT = "Johan Lindqvist ringde från Umeå.";

  async function clickMark(page: import("@playwright/test").Page, placeholder: string, clickCount = 1) {
    const box = await page.locator(`mark[data-ph="${placeholder}"]`).first().boundingBox();
    if (!box) throw new Error(`no mark for ${placeholder}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount });
  }

  test("switches it between Skrubba and Behåll", async ({ page }) => {
    await openReady(page);
    await editor(page).fill(SHORT);
    const johan = rows(page).filter({ hasText: "Johan Lindqvist" });
    await expect(johan).toHaveAttribute("aria-label", /skrubbas$/);
    const ph = await page.locator("mark.hl-name").getAttribute("data-ph");

    await clickMark(page, ph!);
    await expect(johan).toHaveAttribute("aria-label", /behålls$/);
    await expect(page.locator(`mark[data-ph="${ph}"]`)).toHaveClass(/hl-kept/);

    await clickMark(page, ph!);
    await expect(johan).toHaveAttribute("aria-label", /skrubbas$/);
    await expect(page.locator(`mark[data-ph="${ph}"]`)).not.toHaveClass(/hl-kept/);
  });

  test("hovering a highlight says what it becomes and what a click does", async ({ page }) => {
    await openReady(page);
    await editor(page).fill(SHORT);
    const mark = page.locator("mark.hl-name");
    const ph = (await mark.getAttribute("data-ph"))!;
    const box = (await mark.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("tooltip")).toHaveText(`Namn blir ${ph}. Klicka för att behålla.`);
    await clickMark(page, ph);
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await expect(page.getByRole("tooltip")).toHaveText("Namn behålls. Klicka för att skrubba.");
  });

  test("hovering a linked surname names it Efternamn and its own placeholder", async ({ page }) => {
    await openReady(page);
    await editor(page).fill("Johan Lindqvist ringde. Lindqvist vill ha svar.");
    const mark = page.locator("mark[data-last]");
    await expect(mark).toHaveText("Lindqvist");
    const ph = (await mark.getAttribute("data-ph"))!.replace("[NAMN_", "[EFTERNAMN_");
    const box = (await mark.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("tooltip")).toHaveText(`Efternamn blir ${ph}. Klicka för att behålla.`);
  });

  test("a kept word gets a border in its type's darker shade, set off from the text", async ({ page }) => {
    await openReady(page);
    await editor(page).fill(SHORT);
    const mark = page.locator("mark.hl-name");
    const fill = await mark.evaluate((el) => getComputedStyle(el).backgroundColor);
    // The darker shade is the one the list uses for the type's dot.
    const edge = await page.locator(".dot-name").first().evaluate((el) => getComputedStyle(el).color);
    expect(edge).not.toBe(fill);
    const box = await mark.boundingBox();
    await clickMark(page, (await mark.getAttribute("data-ph"))!);
    await expect(mark).toHaveClass(/hl-kept/);
    const kept = await mark.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.outlineColor, style: s.outlineStyle, offset: s.outlineOffset };
    });
    expect(kept).toEqual({ bg: "rgba(0, 0, 0, 0)", color: edge, style: "solid", offset: "1px" });
    expect(await mark.boundingBox()).toEqual(box); // no layout shift against the textarea
  });

  test("a double-click selects the word and leaves it as it was", async ({ page }) => {
    await openReady(page);
    await editor(page).fill(SHORT);
    const umea = rows(page).filter({ hasText: "Umeå" });
    const ph = await page.locator("mark.hl-place").getAttribute("data-ph");
    await clickMark(page, ph!, 2);
    await expect(umea).toHaveAttribute("aria-label", /skrubbas$/);
    await expect(page.getByRole("button", { name: /Skrubba markering/ })).toBeVisible();
  });

  test("clicking plain text does nothing to the items", async ({ page }) => {
    await openReady(page);
    await editor(page).fill(SHORT);
    const box = await page.locator(".editor-overlay span", { hasText: "ringde" }).boundingBox();
    await page.mouse.click(box!.x + 4, box!.y + box!.height / 2);
    for (const row of await rows(page).all()) await expect(row).toHaveAttribute("aria-label", /skrubbas$/);
  });
});

test("when the clipboard is blocked, Kopiera says so and how to copy by hand", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) } });
    document.execCommand = () => false;
  });
  await openReady(page);
  await editor(page).fill("Johan Lindqvist ringde.");
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press(`${MOD}+Shift+KeyC`);
  await expect(page.locator(".toast")).toHaveText(
    "Texten kunde inte kopieras. Markera den i rutan till höger och kopiera den själv.",
  );
});
