// The summary line and preview in the file window.
import type { Format, ReadResult } from "../reader/index.ts";
import { type CopyKey, t } from "./copy.ts";

type TextResult = Extract<ReadResult, { kind: "text" }>;

const FORMAT_KEY: Record<Format, CopyKey> = {
  pdf: "file.format.pdf",
  docx: "file.format.docx",
  doc: "file.format.doc",
  odt: "file.format.odt",
  rtf: "file.format.rtf",
  msg: "file.format.msg",
  eml: "file.format.eml",
  html: "file.format.html",
  csv: "file.format.csv",
  xlsx: "file.format.xlsx",
  pptx: "file.format.pptx",
  txt: "file.format.txt",
  md: "file.format.md",
};
const PREVIEW_CHARS = 1000;

/** "Word · 1 240 ord", "PDF · 12 sidor · 4 300 ord". */
export function statsLine({ format, stats }: TextResult): string {
  const parts = [t(FORMAT_KEY[format])];
  if (stats.pages !== undefined) parts.push(stats.pages === 1 ? t("file.pages.one") : t("file.pages", { n: stats.pages }));
  if (stats.slides !== undefined) parts.push(stats.slides === 1 ? t("file.slides.one") : t("file.slides", { n: stats.slides }));
  if (stats.sheets !== undefined) parts.push(t("file.sheets", { n: stats.sheets }));
  parts.push(t("file.words", { n: stats.words.toLocaleString("sv-SE") }));
  return parts.join(" · ");
}

/** The start of the text, cut at a word, with " …" when cut. */
export function preview(text: string): string {
  if (text.length <= PREVIEW_CHARS) return text;
  const cut = text.slice(0, PREVIEW_CHARS);
  const lastSpace = cut.search(/\s\S*$/);
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut} …`;
}
