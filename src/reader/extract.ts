// Reads one file's bytes into a ReadResult: detect the format, run its
// reader, then the checks every format shares. Runs in the reader worker
// (readerWorker.ts) and, for tests, in Node.
import { oleFormat, openCfb } from "./cfb.ts";
import { detect } from "./detect.ts";
import { readDoc } from "./formats/doc.ts";
import { readDocx } from "./formats/docx.ts";
import { readEml } from "./formats/eml.ts";
import { readHtml } from "./formats/html.ts";
import { readMsg } from "./formats/msg.ts";
import { readOdt } from "./formats/odt.ts";
import { readPdf } from "./formats/pdf.ts";
import { readPptx } from "./formats/pptx.ts";
import { readRtf } from "./formats/rtf.ts";
import { readText } from "./formats/text.ts";
import { readXlsx } from "./formats/xlsx.ts";
import { LIMITS } from "./limits.ts";
import { type Extracted, type Format, type Note, type Progress, ReadError, type ReadResult, type Stats } from "./types.ts";
import { openZip, type Zip, zipFormat } from "./zip.ts";

const WORD = /[\p{L}\p{N}]+/gu;
// Pictures placed in the text itself: the Word body, a slide, a sheet's drawing, the
// OpenDocument body. Logos in headers, slide masters and layouts do not count, or the
// note would show on nearly every file made from a template.
const BODY_IMAGES: Array<[part: RegExp, picture: RegExp]> = [
  [/^word\/document\.xml$/, /<(?:[\w-]+:)?(?:pic|imagedata)[\s/>]/],
  [/^ppt\/slides\/slide\d+\.xml$/, /<(?:[\w-]+:)?pic[\s/>]/],
  [/^xl\/drawings\/drawing\d+\.xml$/, /<(?:[\w-]+:)?pic[\s/>]/],
  [/^content\.xml$/, /<draw:image[\s/>]/],
];

async function hasBodyImage(zip: Zip): Promise<boolean> {
  for (const name of zip.names())
    for (const [part, picture] of BODY_IMAGES) if (part.test(name) && picture.test((await zip.text(name)) ?? "")) return true;
  return false;
}

export async function extract(bytes: Uint8Array, name: string, onProgress?: Progress): Promise<ReadResult> {
  try {
    const { format, extracted } = await dispatch(bytes, name, onProgress);
    return finish(format, extracted);
  } catch (e) {
    return { kind: "error", reason: e instanceof ReadError ? e.reason : "failed" };
  }
}

async function dispatch(bytes: Uint8Array, name: string, onProgress?: Progress): Promise<{ format: Format; extracted: Extracted }> {
  const found = detect(bytes, name);
  switch (found.family) {
    case "zip": {
      const zip = openZip(bytes);
      const format = await zipFormat(zip);
      const withImages = async (x: Extracted) => ({ ...x, images: await hasBodyImage(zip) });
      if (format === "docx") return { format, extracted: await withImages(await readDocx(zip)) };
      if (format === "odt") return { format, extracted: await withImages(await readOdt(zip)) };
      if (format === "xlsx") return { format, extracted: await withImages(await readXlsx(zip)) };
      if (format === "pptx") return { format, extracted: await withImages(await readPptx(zip)) };
      throw new ReadError("unsupported");
    }
    case "ole": {
      const cfb = openCfb(bytes);
      const format = oleFormat(cfb);
      if (format === "doc") return { format, extracted: readDoc(cfb) };
      return { format, extracted: readMsg(cfb) };
    }
    case "pdf":
      return { format: "pdf", extracted: await readPdf(bytes, onProgress) };
    case "rtf":
      return { format: "rtf", extracted: readRtf(bytes) };
    case "text":
      if (found.format === "html") return { format: "html", extracted: readHtml(bytes) };
      if (found.format === "eml") return { format: "eml", extracted: readEml(bytes) };
      return { format: found.format, extracted: readText(bytes) };
    default:
      throw new ReadError("unsupported");
  }
}

function finish(format: Format, x: Extracted): ReadResult {
  const text = x.text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { kind: "error", reason: "empty" };
  if (text.length > LIMITS.textChars) return { kind: "error", reason: "tooLarge" };
  const notes: Note[] = [];
  if (x.hidden) notes.push("hiddenLeftOut");
  if (x.attachments) notes.push("attachmentsLeftOut");
  if (x.images) notes.push("imagesLeftOut");
  const stats: Stats = { words: text.match(WORD)?.length ?? 0 };
  if (x.pages !== undefined) stats.pages = x.pages;
  if (x.slides !== undefined) stats.slides = x.slides;
  if (x.sheets !== undefined) stats.sheets = x.sheets;
  return { kind: "text", text, format, stats, notes };
}
