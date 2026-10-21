// PDF with pdf.js, loaded only for the first PDF. It gets the bytes and
// nothing else: no font loading, no fetching (no cMapUrl, standardFontDataUrl
// or wasmUrl, and WebAssembly decoders off; text extraction for Latin
// scripts needs none of them). pdf.js 6 has no eval left to switch off.
// Form field values are text on the page and come along; comments do not.
//
// pdf.js parses in a worker of its own, nested in the reader worker and
// ended with it. Its worker code cannot run in the reader worker itself:
// imported into any worker, pdf.js 6 takes over that worker's messages.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cleanPaste } from "../../ui/pasteCleanup.ts";
import { type Extracted, type Progress, ReadError } from "../types.ts";
import { type PdfItem, pageText } from "./pdfLines.ts";

type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: "module" });
    return pdfjs;
  });
  return loading;
}

export async function readPdf(bytes: Uint8Array, onProgress?: Progress): Promise<Extracted> {
  const pdfjs = await loadPdfJs();
  const { OPS } = pdfjs;
  const PAINT_IMAGE = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat]);
  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    useWasm: false,
    useWorkerFetch: false,
    verbosity: 0,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new ReadError((e as Error | undefined)?.name === "PasswordException" ? "encrypted" : "failed");
  }
  try {
    const pages: string[] = [];
    let hidden = false;
    let images = false;
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.(n, doc.numPages);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: PdfItem[] = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;
        const [, , c, d, x, y] = it.transform as number[];
        items.push({ str: it.str, x, y, width: it.width, height: it.height || Math.hypot(c, d) });
      }
      const lines = [pageText(items)];
      // What is visible on the page comes along: filled-in text and choice
      // fields, and text typed onto the page (FreeText). Comments do not.
      for (const a of await page.getAnnotations({ intent: "display" })) {
        const contents = String(a.contentsObj?.str ?? "").trim();
        if (a.subtype === "Widget") {
          const value = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : a.fieldValue;
          if ((a.fieldType === "Tx" || a.fieldType === "Ch") && typeof value === "string" && value.trim()) lines.push(value.trim());
        } else if (a.subtype === "FreeText") {
          if (contents) lines.push(contents);
        } else if (a.subtype !== "Link" && contents) hidden = true;
      }
      const text = lines.filter(Boolean).join("\n");
      // A page without text but with a picture is a scanned page. Pages with
      // text are not checked: that decodes every logo, and they are rarely scans.
      if (!text.trim() && !images) images = (await page.getOperatorList()).fnArray.some((op) => PAINT_IMAGE.has(op));
      pages.push(text);
      page.cleanup();
    }
    if (!pages.some((p) => p.trim())) throw new ReadError("noText");
    return { text: cleanPaste(pages.join("\n\n")).text, pages: doc.numPages, hidden, images };
  } finally {
    await task.destroy();
  }
}
