// OpenDocument text (.odt): body, headings, tables, frames, footnotes and
// the page header and footer. Comments, tracked deletions and hidden text are
// left out, and we say so. As ODF says, whitespace in the XML collapses to
// one space and only <text:s>, <text:tab> and <text:line-break> add more.
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const SKIP_HIDDEN = new Set(["office:annotation", "text:tracked-changes", "text:hidden-text", "text:hidden-paragraph"]);
const SKIP_SILENT = new Set(["text:note-citation", "office:annotation-end", "svg:title", "svg:desc"]);
const PARAGRAPH = new Set(["text:p", "text:h"]);
const CELL = new Set(["table:table-cell", "table:covered-table-cell"]);
const BODY = new Set(["office:body"]);
const HEADER_FOOTER = new Set(["style:header", "style:footer", "style:header-left", "style:footer-left", "style:header-first", "style:footer-first"]);

/** The text inside the `roots` elements of an ODF part; footnotes are collected separately. */
function odfText(xml: string, roots: Set<string>): { text: string; notes: string[]; hidden: boolean } {
  const out = new TextBuilder();
  const notes: string[] = [];
  let note: TextBuilder | null = null;
  const target = () => note ?? out;
  let inside = 0;
  let inParagraph = 0;
  let skip = 0;
  let skipIsHidden = false;
  let hidden = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      else if (skipIsHidden && ev.text.trim()) hidden = true;
      continue;
    }
    if (ev.type !== "text" && roots.has(ev.name)) {
      if (ev.type === "open") inside++;
      else {
        inside--;
        out.add("\n");
      }
      continue;
    }
    if (!inside) continue;
    if (ev.type === "text") {
      if (inParagraph) target().add(ev.text.replace(/\s+/g, " "));
      continue;
    }
    const { name } = ev;
    if (ev.type === "open") {
      if (SKIP_HIDDEN.has(name) || SKIP_SILENT.has(name)) {
        skip = 1;
        skipIsHidden = SKIP_HIDDEN.has(name);
      } else if (PARAGRAPH.has(name)) inParagraph++;
      else if (name === "text:s") target().add(" ".repeat(Math.min(Number(ev.attrs["text:c"] ?? 1) || 1, 100)));
      else if (name === "text:tab") target().add("\t");
      else if (name === "text:line-break") target().add("\n");
      else if (CELL.has(name)) target().openCell();
      else if (name === "text:note") note = new TextBuilder();
      continue;
    }
    if (PARAGRAPH.has(name)) {
      inParagraph = Math.max(0, inParagraph - 1);
      target().add("\n");
    } else if (CELL.has(name)) target().closeCell();
    else if (name === "table:table-row") target().closeRow();
    else if (name === "text:note" && note) {
      const text = note.toString();
      if (text) notes.push(text);
      note = null;
    }
  }
  return { text: out.toString(), notes, hidden };
}

export async function readOdt(zip: Zip): Promise<Extracted> {
  const content = await zip.text("content.xml");
  if (content === null) throw new ReadError("failed");
  const body = odfText(content, BODY);
  const styles = await zip.text("styles.xml");
  const page = styles === null ? null : odfText(styles, HEADER_FOOTER);
  const texts = [...new Set([body.text, page?.text ?? "", ...body.notes].filter(Boolean))];
  return { text: texts.join("\n\n"), hidden: body.hidden || !!page?.hidden };
}
