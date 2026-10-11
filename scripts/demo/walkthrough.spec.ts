// The Så här funkar det walkthrough, recorded by scripts/demo/make-video.ts. Captions match HOWTO in src/ui/copy.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";

// A visible pointer for the recording only (video does not show the real one).
const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.popover = "manual";
    c.style.cssText = "position:fixed;inset:auto;padding:0;overflow:visible;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
      "background:rgba(255,212,59,.55);border:2px solid #1E4A35;pointer-events:none;left:-50px;top:-50px;transition:transform .12s";
    document.body.append(c);
    const cap = document.createElement("div");
    cap.id = "demo-caption";
    cap.popover = "manual";
    cap.style.cssText = "position:fixed;inset:auto;margin:0;border:0;z-index:99998;left:50%;bottom:28px;transform:translateX(-50%);max-width:900px;" +
      "padding:14px 24px;border-radius:16px;background:var(--sapa);color:var(--pa-sapa);font:600 20px/28px var(--font-text);" +
      "text-align:center;opacity:0;transition:opacity .35s;pointer-events:none;box-shadow:0 0 0 1px var(--kant)";
    document.body.append(cap);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.7)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
    // Both live in the top layer as popovers; re-show them after a window opens so they stay above it.
    const raise = () => {
      for (const el of [cap, c]) {
        if (el.matches(":popover-open")) el.hidePopover();
        el.showPopover();
      }
    };
    raise();
    window.__caption = async (t) => {
      if (cap.textContent) {
        cap.style.opacity = "0";
        await new Promise((r) => setTimeout(r, 350));
      }
      cap.textContent = t;
      cap.style.opacity = "1";
    };
    new MutationObserver(raise).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  });`;

let pos = { x: 640, y: 450 };
async function moveTo(page: Page, target: Locator) {
  const b = (await target.boundingBox())!;
  const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(to.x, to.y, { steps: 25 });
  pos = to;
}
async function click(page: Page, target: Locator, pause = 900) {
  await moveTo(page, target);
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(pause);
}
async function caption(page: Page, text: string, hold = 600) {
  await page.evaluate((t) => (globalThis as unknown as { __caption(t: string): Promise<void> }).__caption(t), text);
  await page.waitForTimeout(hold);
}
const nth = (text: string, re: RegExp, i: number) => [...text.matchAll(re)].at(i)![0];

test("Skrubba walkthrough", async ({ page }) => {
  const started = Date.now(); // the video starts with the page
  await page.addInitScript(CURSOR);
  await page.goto("/");
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 120_000 });
  mkdirSync(test.info().outputDir, { recursive: true });
  writeFileSync(`${test.info().outputDir}/ready-at.txt`, String((Date.now() - started) / 1000));
  await page.mouse.move(pos.x, pos.y);
  await page.waitForTimeout(1500);

  // 1. Paste a text: here the example.
  await caption(page, "Klistra in din text. Skrubba markerar namn, nummer och företag.", 1400);
  await click(page, page.getByRole("button", { name: "Visa exempel" }), 2500);

  // 2. Keep one: click the highlight on Karin.
  const karin = page.locator(".editor-overlay mark").filter({ hasText: "Karin" });
  await caption(page, "Klicka på en markering för att behålla ordet. Det får en ram i stället för färg.", 1800);
  await click(page, karin, 2200);

  // 3. Look at what was found.
  await caption(page, "Under rutan ser du vad som hittades. Visa öppnar hela listan.", 1600);
  await click(page, page.getByRole("button", { name: /^\d+ uppgifter Visa$/ }), 2500);
  const dialog = page.getByRole("dialog", { name: "Uppgifter" });
  await moveTo(page, dialog.locator(".row").nth(3));
  await page.waitForTimeout(1200);
  await click(page, dialog.getByRole("button", { name: "Stäng" }), 900);

  // 4. Skrubba, then Kopiera.
  await caption(page, "Tryck Skrubba. Uppgifterna byts mot platshållare som [NAMN_1].", 1200);
  await click(page, page.locator(".run"), 2800);
  await caption(page, "Kopiera texten och klistra in den i valfri AI-tjänst.", 1200);
  await click(page, page.getByRole("button", { name: "Kopiera" }), 2500);

  // 5. The kodnyckel.
  await caption(page, "Kodnyckeln visar vilken platshållare som står för vad.", 1200);
  await click(page, page.getByRole("button", { name: /^Kodnyckel/ }), 3000);
  await click(page, page.getByRole("dialog", { name: "Kodnyckel" }).getByRole("button", { name: "Stäng" }), 900);

  // 6. The AI answers with placeholders; Avskrubba puts the real values back.
  const scrubbed = await page.getByRole("textbox", { name: "Skrubbad text", exact: true }).inputValue();
  const johan = nth(scrubbed, /\[NAMN_\d+\]/g, 0);
  const micke = nth(scrubbed, /\[NAMN_\d+\]/g, -1);
  const pnr = nth(scrubbed, /\[PERSONNUMMER_\d+\]/g, 0);
  const fk = nth(scrubbed, /\[ORGANISATION_\d+\]/g, -1);
  const answer =
    `Här är ett förslag till brev:\n\nTill ${fk}\n\n` +
    `Vi vill planera rehabiliteringen för ${johan} (${pnr}), som har varit sjukskriven sedan den 3 mars. ` +
    `Vi föreslår ett första möte under maj.\n\nMed vänliga hälsningar\n${micke}`;
  await caption(page, "Byt till Avskrubba och klistra in svaret från AI.", 1400);
  await click(page, page.getByRole("group", { name: "Vad vill du göra?" }).getByRole("button", { name: "Avskrubba" }), 1200);
  const answerBox = page.getByRole("textbox", { name: "Svar från AI", exact: true });
  await click(page, answerBox, 300);
  await answerBox.fill(answer);
  await page.waitForTimeout(2000);
  await caption(page, "Tryck Avskrubba. De riktiga uppgifterna kommer tillbaka.", 1200);
  await click(page, page.locator(".run"), 3500);
  await moveTo(page, page.getByRole("textbox", { name: "Avskrubbad text", exact: true }));
  await page.waitForTimeout(3000);
});
