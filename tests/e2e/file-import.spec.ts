import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  buildDoc,
  buildDocx,
  buildMsg,
  buildOdt,
  buildPdf,
  buildPptx,
  buildXlsx,
  latin1,
  PDF_WRAPPED,
  SAMPLE,
  SAMPLE_TEXT,
  tp,
  wp,
} from "../fixtures/documents/build.ts";
import { answerBox, dropFile, editor, fileWindow, openReady, rows, scrub, scrubbedBox } from "./helpers.ts";

const NEW_KEY_CONFIRM =
  "Den nya texten får en ny kodnyckel. Svar på den förra texten går då inte att avskrubba, om du inte har laddat ner kodnyckeln. Vill du fortsätta?";

// Owner's decision, 2026-10-14: a document read into Din text is a new case, like Ny text.
test.describe("a new kodnyckel for a new document", () => {
  test("with a kodnyckel, Använd texten asks first, then starts a new one and keeps Egna ord", async ({ page }) => {
    await openReady(page);
    await page.getByRole("button", { name: "Visa exempel" }).click();
    const words = await page.locator(".words summary").textContent();
    await scrub(page);
    const asked: string[] = [];
    page.on("dialog", (d) => {
      asked.push(d.message());
      void d.accept();
    });
    await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    expect(asked).toEqual([NEW_KEY_CONFIRM]);
    await expect(fileWindow(page)).toBeHidden();
    await expect(editor(page)).toHaveValue(SAMPLE_TEXT);
    await expect(scrubbedBox(page)).toHaveValue("");
    await expect(page.locator(".words summary")).toHaveText(words!);
    await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(0);
    await scrub(page);
    await expect(scrubbedBox(page)).toHaveValue(/och \[NAMN_1\]/);
  });

  test("saying no leaves the window open and the text as it was", async ({ page }) => {
    await openReady(page);
    await page.getByRole("button", { name: "Visa exempel" }).click();
    await scrub(page);
    const before = await editor(page).inputValue();
    page.on("dialog", (d) => void d.dismiss());
    await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(fileWindow(page)).toBeVisible();
    await expect(editor(page)).toHaveValue(before);
    await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(1);
  });

  test("in Avskrubba the kodnyckel stays, without asking", async ({ page }) => {
    await openReady(page);
    await page.getByRole("button", { name: "Visa exempel" }).click();
    await scrub(page);
    let asked = false;
    page.on("dialog", (d) => {
      asked = true;
      void d.dismiss();
    });
    const box = await answerBox(page);
    await dropFile(page, box, "svar.txt", "text/plain", "Hej [NAMN_1].");
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(box).toHaveValue("Hej [NAMN_1].");
    expect(asked).toBe(false);
    await expect(page.getByRole("button", { name: /^Kodnyckel/ })).toHaveCount(1);
  });
});

test("a dropped text file opens the window, and Använd texten puts it in Din text", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toBeVisible();
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Text · 23 ord");
  await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
  const use = w.getByRole("button", { name: "Använd texten" });
  await expect(use).toBeFocused();
  await use.click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue(SAMPLE_TEXT);
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Välj fil opens the same window", async ({ page }) => {
  await openReady(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Välj fil" }).click();
  await (await chooser).setFiles({ name: "avtal.md", mimeType: "text/markdown", buffer: Buffer.from(SAMPLE_TEXT) });
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(editor(page)).toHaveValue(/Storgatan 12/);
});

test("a dropped file lands in Svar från AI in Avskrubba", async ({ page }) => {
  await openReady(page);
  const box = await answerBox(page);
  await dropFile(page, box, "svar.md", "text/markdown", "# Svar\n\nHej [NAMN_1].");
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(box).toHaveValue("# Svar\n\nHej [NAMN_1].");
});

test("with text in the pane, the window warns, and Avbryt keeps the old text", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toContainText("Texten som står i rutan nu ersätts.");
  await w.getByRole("button", { name: "Avbryt" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue("Min egen text.");
});

test("Esc closes the window and changes nothing", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  await expect(fileWindow(page).getByRole("button", { name: "Använd texten" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(fileWindow(page)).toBeHidden();
  await expect(editor(page)).toHaveValue("Min egen text.");
});

test("an unsupported file gets a plain message and changes nothing", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "bild.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  const w = fileWindow(page);
  await expect(w.getByRole("alert")).toHaveText(/^Den här filtypen går inte att läsa\./);
  await w.getByRole("button", { name: "Stäng" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveValue("");
});

test("dropping two files reads the first and says so", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT, ["annat.txt"]);
  const w = fileWindow(page);
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Bara en fil i taget. Den första lästes.");
});

test("a Word file is read into Din text and its name gets masked", async ({ page }) => {
  await openReady(page);
  const docx = buildDocx({ body: [SAMPLE.title, ...SAMPLE.lines].map(wp).join("") });
  await dropFile(page, editor(page), "avtal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx);
  const w = fileWindow(page);
  await expect(w).toContainText("Word · 23 ord");
  await w.getByRole("button", { name: "Använd texten" }).click();
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test.describe("PDF", () => {
  const PDF = "application/pdf";

  test("a PDF is read page by page into Din text, lines rejoined", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "rehab.pdf", PDF, buildPdf(PDF_WRAPPED));
    const w = fileWindow(page);
    await expect(w).toContainText("PDF · 2 sidor");
    await w.getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toHaveValue(/har under våren/);
    await expect(editor(page)).toHaveValue(/rehabilitering/);
    await expect(editor(page)).toHaveValue(/Erik Holm/);
  });

  test("a PDF from another program is read", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "testPDF.pdf", PDF, new Uint8Array(readFileSync("tests/fixtures/documents/tika/testPDF.pdf")));
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toHaveValue(/Tika/);
  });

  test("a scanned PDF says it has no text", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "skannad.pdf", PDF, buildPdf([{ image: true }]));
    await expect(fileWindow(page).getByRole("alert")).toHaveText(/^PDF:en innehåller bara bilder, ingen text\./);
  });

  test("a password-protected PDF says so", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "last.pdf", PDF, buildPdf([[SAMPLE.title]], { encrypted: true }));
    await expect(fileWindow(page).getByRole("alert")).toHaveText(/^Dokumentet är lösenordsskyddat\./);
  });

  test("text typed onto the page and a chosen value come along, without a note", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "ifylld.pdf", PDF, buildPdf([["Namn"]], { typed: "Anna Berg", choice: "Umeå" }));
    const w = fileWindow(page);
    await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
    await expect(w.getByLabel("Början av texten")).toContainText("Umeå");
    await expect(w).not.toContainText("Kommentarer och dolda delar togs inte med.");
  });

  test("a form's filled-in values come along, its comments do not", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "blankett.pdf", PDF, buildPdf([["Namn"]], { field: "Anna Berg", comment: "Ring Lisa Ek" }));
    const w = fileWindow(page);
    await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
    await expect(w.getByLabel("Början av texten")).not.toContainText("Lisa Ek");
    await expect(w).toContainText("Kommentarer och dolda delar togs inte med.");
  });
});

test.describe("while reading", () => {
  // Without the offline cache, page.route sees the reader worker's request and can hold it.
  test.use({ serviceWorkers: "block" });

  test("Avbryt stops the read and leaves the pane alone", async ({ page }) => {
    await openReady(page);
    await editor(page).fill("Min egen text.");
    await page.route("**/readerWorker-*.js", () => new Promise(() => {}));
    await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
    const w = fileWindow(page);
    await expect(w.getByRole("status")).toHaveText("Läser dokumentet …");
    await w.getByRole("button", { name: "Avbryt" }).click();
    await expect(w).toBeHidden();
    await expect(editor(page)).toHaveValue("Min egen text.");
  });
});

test.describe("every format", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "the readers are the same code in every engine; docx and pdf run in all three above");

  const rtf = (s: string) => `{\\rtf1\\ansi\\ansicpg1252 ${s.replace(/[^\x20-\x7e\n]/g, (c) => `\\'${c.charCodeAt(0).toString(16)}`).replace(/\n/g, "\\par ")}}`;
  const html = `<!doctype html><meta charset="utf-8"><h1>${SAMPLE.title}</h1>${SAMPLE.lines.map((l) => `<p>${l}</p>`).join("")}`;
  const eml = `Subject: ${SAMPLE.title}\r\nContent-Type: text/plain; charset=iso-8859-1\r\n\r\n${SAMPLE.lines.join("\r\n")}`;
  const cases: Array<[string, string, Uint8Array, string]> = [
    ["avtal.odt", "application/vnd.oasis.opendocument.text", buildOdt([SAMPLE.title, ...SAMPLE.lines].map(tp).join("")), "OpenDocument"],
    ["avtal.rtf", "application/rtf", latin1(rtf(SAMPLE_TEXT)), "RTF"],
    ["avtal.html", "text/html", new TextEncoder().encode(html), "Webbsida"],
    ["avtal.csv", "text/csv", latin1(SAMPLE_TEXT.replace(/\n/g, "\r\n")), "CSV"],
    ["avtal.eml", "message/rfc822", latin1(eml), "E-post"],
    ["avtal.msg", "application/vnd.ms-outlook", buildMsg({ subject: SAMPLE.title, body: SAMPLE.lines.join("\n") }), "Outlook-mejl"],
    ["avtal.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buildXlsx([{ name: "Avtal", rows: [[SAMPLE.title], ...SAMPLE.lines.map((l) => [l])] }]), "Excel"],
    ["avtal.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", buildPptx([{ texts: [SAMPLE.title, ...SAMPLE.lines] }]), "PowerPoint"],
    ["avtal.doc", "application/msword", buildDoc({ main: `${SAMPLE_TEXT.replace(/\n/g, "\r")}\r` }), "Word"],
  ];

  for (const [name, type, bytes, label] of cases) {
    test(`${name} is read and the name in it gets masked`, async ({ page }) => {
      await openReady(page);
      await dropFile(page, editor(page), name, type, bytes);
      const w = fileWindow(page);
      await expect(w).toContainText(`${label} · `);
      await w.getByRole("button", { name: "Använd texten" }).click();
      await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
    });
  }
});

test("the keyboard path: Välj fil, Använd texten, and focus back in Din text", async ({ page }) => {
  await openReady(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Välj fil" }).focus();
  await page.keyboard.press("Enter");
  await (await chooser).setFiles({ name: "avtal.txt", mimeType: "text/plain", buffer: Buffer.from(SAMPLE_TEXT) });
  const use = fileWindow(page).getByRole("button", { name: "Använd texten" });
  await expect(use).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(fileWindow(page)).toBeHidden();
  await expect(editor(page)).toBeFocused();
});
