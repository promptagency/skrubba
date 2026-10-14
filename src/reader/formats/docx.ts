// Word (.docx): body, tables, text boxes, headers, footers, footnotes and
// endnotes. Deleted text, hidden text and comments are left out, and we say
// so; field instructions and the fallback copy of drawings are left out
// silently since nobody sees them.
import { relationships } from "../ooxml.ts";
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const SKIP_SILENT = new Set(["w:instrText", "w:delInstrText", "mc:Fallback"]);
const SKIP_HIDDEN = new Set(["w:del", "w:moveFrom"]);
const OFF = new Set(["0", "false", "off"]);

/** The text of one WordprocessingML part, and whether it had hidden content. */
export function wordPartText(xml: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skip = 0;
  let skipIsHidden = false;
  let hidden = false;
  let inRun = false;
  let runHidden = false;
  let inText = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      else if (skipIsHidden && ev.text.trim()) hidden = true;
      continue;
    }
    if (ev.type === "text") {
      if (!inText) continue;
      if (!runHidden) out.add(ev.text);
      else if (ev.text.trim()) hidden = true;
      continue;
    }
    const { name } = ev;
    if (ev.type === "open") {
      const separatorNote = (name === "w:footnote" || name === "w:endnote") && !!ev.attrs["w:type"] && ev.attrs["w:type"] !== "normal";
      if (SKIP_SILENT.has(name) || SKIP_HIDDEN.has(name) || separatorNote) {
        skip = 1;
        skipIsHidden = SKIP_HIDDEN.has(name);
        continue;
      }
      if (name === "w:r") {
        inRun = true;
        runHidden = false;
      } else if (name === "w:vanish") {
        if (inRun && !OFF.has(ev.attrs["w:val"] ?? "")) runHidden = true;
      } else if (name === "w:t") inText = true;
      else if (inRun && !runHidden && name === "w:tab") out.add("\t");
      else if (inRun && !runHidden && (name === "w:br" || name === "w:cr")) out.add("\n");
      else if (inRun && !runHidden && name === "w:noBreakHyphen") out.add("-");
      else if (name === "w:tc") out.openCell();
      continue;
    }
    if (name === "w:t") inText = false;
    else if (name === "w:r") {
      inRun = false;
      runHidden = false;
    } else if (name === "w:p") out.add("\n");
    else if (name === "w:tc") out.closeCell();
    else if (name === "w:tr") out.closeRow();
  }
  return { text: out.toString(), hidden };
}

export async function readDocx(zip: Zip): Promise<Extracted> {
  const body = await zip.text("word/document.xml");
  if (body === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("word/_rels/document.xml.rels")) ?? "", "word/");
  const parts = [wordPartText(body)];
  // Each header and footer part once, however many relationships point at it.
  const pageParts = new Set(rels.filter((r) => r.type === "header" || r.type === "footer").map((r) => r.target));
  for (const target of pageParts) {
    const xml = await zip.text(target);
    if (xml !== null) parts.push(wordPartText(xml));
  }
  for (const notes of ["word/footnotes.xml", "word/endnotes.xml"]) {
    const xml = await zip.text(notes);
    if (xml !== null) parts.push(wordPartText(xml));
  }
  const comments = await zip.text("word/comments.xml");
  const commented = comments !== null && wordPartText(comments).text !== "";
  const texts = [...new Set(parts.map((p) => p.text).filter(Boolean))];
  return { text: texts.join("\n\n"), hidden: commented || parts.some((p) => p.hidden) };
}
