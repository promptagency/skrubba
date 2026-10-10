import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { answerBox, editor, modeButton, MOD, openKey, openReady, placeholderOf, restoredBox, rows, scrub } from "./helpers.ts";

const TEXT = "Hej Karin, Johan Lindqvist (850412-1234) flyttar till Umeå.";

async function scrubText(page: Page) {
  await editor(page).fill(TEXT);
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toHaveCount(1);
  await scrub(page);
}


test("Phase 3 round trip: scrub, paste an answer, restore with a suggestion", async ({ page }) => {
  await openReady(page);
  await scrubText(page);

  const johan = await placeholderOf(page, "Johan Lindqvist");
  const umea = await placeholderOf(page, "Umeå");
  expect(johan).toMatch(/^\[NAMN_\d\]$/);

  const mangled = umea.replace("[", "").replace("]", "").replace("_", " "); // "PLATS 1"
  const answer = `Hej! ${johan} bör kontakta HR innan flytten till ${mangled}. ${"[NAMN_9]"} vet inget.`;
  await (await answerBox(page)).fill(answer);
  await page.keyboard.press(`${MOD}+Enter`);

  await expect(restoredBox(page)).toHaveValue(`Hej! Johan Lindqvist bör kontakta HR innan flytten till ${mangled}. [NAMN_9] vet inget.`);
  await expect(page.locator(".editor-result mark.hl-name").filter({ hasText: "Johan Lindqvist" })).toBeAttached();
  await expect(page.getByText(`Hittade ${mangled} i svaret. Menade du ${umea}, alltså Umeå?`)).toBeVisible();
  await expect(page.getByText("[NAMN_9] finns inte i kodnyckeln. Kontrollera svaret själv.")).toBeVisible();

  await page.getByRole("button", { name: "Ja" }).click();
  await expect(restoredBox(page)).toHaveValue("Hej! Johan Lindqvist bör kontakta HR innan flytten till Umeå. [NAMN_9] vet inget.");
  await expect(page.getByRole("textbox", { name: "Svar från AI" })).toHaveValue(answer);
  await expect(page.getByText(/^Hittade /)).toHaveCount(0);
});

test("Nej hides a suggestion and leaves the text", async ({ page }) => {
  await openReady(page);
  await scrubText(page);
  await (await answerBox(page)).fill("Ring NAMN 1 i dag.");
  await page.keyboard.press(`${MOD}+Enter`);
  await page.getByRole("button", { name: "Nej" }).click();
  await expect(page.getByText(/^Hittade /)).toHaveCount(0);
  await expect(restoredBox(page)).toHaveValue("Ring NAMN 1 i dag.");
});

test("the key downloads, uploads into a fresh tab, and restores there", async ({ page, context }) => {
  await openReady(page);
  await scrubText(page);
  const dialog = await openKey(page);
  await expect(dialog.getByText("Filen innehåller riktiga uppgifter.", { exact: false })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Ladda ner kodnyckel" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^skrubba-kodnyckel-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const key = JSON.parse(readFileSync(path, "utf8"));
  expect(key.app).toBe("skrubba");
  const johan = key.entries.find((e: { value: string }) => e.value === "Johan Lindqvist").placeholder;

  // A fresh tab has no key: Avskrubba offers the upload (more in key.spec.ts).
  const fresh = await context.newPage();
  await fresh.goto("/");
  const answer = await answerBox(fresh);
  await fresh.locator('.key-missing input[type="file"]').setInputFiles(path);
  const freshKey = await openKey(fresh);
  await expect(freshKey.getByRole("row").filter({ hasText: "Johan Lindqvist" })).toBeVisible();
  await fresh.keyboard.press("Escape");
  await answer.fill(`Hälsa ${johan}.`);
  await fresh.keyboard.press(`${MOD}+Enter`);
  await expect(restoredBox(fresh)).toHaveValue("Hälsa Johan Lindqvist.");
});

test("Rensa allt clears text, entities, words and key after confirming", async ({ page }) => {
  await openReady(page);
  await scrubText(page);
  const dialog = await openKey(page);
  page.once("dialog", (d) => {
    expect(d.message()).toBe("Text, uppgifter, egna ord och kodnyckel raderas. Vill du fortsätta?");
    void d.accept();
  });
  await dialog.getByRole("button", { name: "Rensa allt" }).click();
  await expect(dialog.getByText("Kodnyckeln skapas när du skrubbar en text.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(0);
  await expect(editor(page)).toHaveValue("");
  await expect(rows(page)).toHaveCount(0);
});

test("closing the tab warns while the key is not downloaded", async ({ page }) => {
  await openReady(page);
  await scrubText(page);
  const dialog = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  expect((await dialog).type()).toBe("beforeunload");
  await (await dialog).dismiss();
});

test("a whole session never touches web storage or cookies", async ({ page, context }) => {
  // Spy on every storage entry point before the app loads. The real getters
  // are kept so the test itself can look afterwards without being counted.
  await page.addInitScript(() => {
    const touched: string[] = [];
    const real: Record<string, () => unknown> = {};
    const find = (obj: object | null, name: string): PropertyDescriptor | undefined => {
      for (let o = obj; o; o = Object.getPrototypeOf(o)) {
        const d = Object.getOwnPropertyDescriptor(o, name);
        if (d) return d;
      }
    };
    for (const name of ["localStorage", "sessionStorage", "indexedDB"]) {
      const getter = find(window, name)?.get;
      if (!getter) continue;
      real[name] = () => getter.call(window);
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          touched.push(name);
          return getter.call(window);
        },
      });
    }
    const cookie = find(document, "cookie")!;
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        touched.push("cookie");
        return cookie.get!.call(document);
      },
      set(v) {
        touched.push("cookie");
        cookie.set!.call(document, v);
      },
    });
    Object.assign(window, { __touched: touched, __real: real });
  });

  await openReady(page);
  await scrubText(page);
  await (await answerBox(page)).fill("Hej [NAMN_1].");
  await page.keyboard.press(`${MOD}+Enter`);
  const dialog = await openKey(page);
  await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Ladda ner kodnyckel" }).click()]);

  type Spy = { __touched: string[]; __real: Record<string, () => unknown> };
  expect(await page.evaluate(() => (window as unknown as Spy).__touched)).toEqual([]);

  // Nothing persisted from any context, workers included.
  expect(await context.cookies()).toEqual([]);
  const persisted = await page.evaluate(async () => {
    const real = (window as unknown as Spy).__real;
    const local = real.localStorage() as Storage;
    const session = real.sessionStorage() as Storage;
    const idb = real.indexedDB() as IDBFactory;
    return { local: local.length, session: session.length, dbs: (await idb.databases()).length };
  });
  expect(persisted).toEqual({ local: 0, session: 0, dbs: 0 });
});

test("a restore made before the key had the value updates once it does", async ({ page }) => {
  await openReady(page);
  await (await answerBox(page)).fill("Hälsa [NAMN_1].");
  await page.keyboard.press(`${MOD}+Enter`);
  await expect(page.getByText("[NAMN_1] finns inte i kodnyckeln.", { exact: false })).toBeVisible();

  await modeButton(page, "Skrubba").click();
  await editor(page).fill("Anna Berg ringde i går.");
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toHaveCount(1);
  await scrub(page);

  await modeButton(page, "Avskrubba").click();
  await expect(restoredBox(page)).toHaveValue("Hälsa Anna Berg.");
  await expect(page.getByText(/finns inte i kodnyckeln/)).toHaveCount(0);
});
