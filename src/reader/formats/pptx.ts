// PowerPoint (.pptx): visible slides in deck order, each under "Bild n" (its
// place in the deck), text in shape order and tables by tab. Hidden slides,
// speaker notes and comments are left out, and we say so.
import { t } from "../../ui/copy.ts";
import { diagramText, relationships } from "../ooxml.ts";
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

function slideText(xml: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skip = 0;
  let inText = false;
  let hidden = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "text") {
      if (inText) out.add(ev.text);
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "p:sld") hidden = ev.attrs.show === "0";
      else if (ev.name === "mc:Fallback") skip = 1;
      else if (ev.name === "a:t") inText = true;
      else if (ev.name === "a:br") out.add("\n");
      else if (ev.name === "a:tc") out.openCell();
      continue;
    }
    if (ev.name === "a:t") inText = false;
    else if (ev.name === "a:p") out.add("\n");
    else if (ev.name === "a:tc") out.closeCell();
    else if (ev.name === "a:tr") out.closeRow();
  }
  return { text: out.toString(), hidden };
}

export async function readPptx(zip: Zip): Promise<Extracted> {
  const presentation = await zip.text("ppt/presentation.xml");
  if (presentation === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("ppt/_rels/presentation.xml.rels")) ?? "", "ppt/");
  let hidden = zip.names().some((n) => /^ppt\/comments\//.test(n) || /^ppt\/comments\d*\.xml$/.test(n));
  const parts: string[] = [];
  let slides = 0;
  let position = 0;
  const seen = new Set<string>();
  for (const ev of xmlEvents(presentation)) {
    if (ev.type !== "open" || ev.name !== "p:sldId") continue;
    position++;
    const target = rels.find((r) => r.id === ev.attrs["r:id"])?.target;
    // A slide listed again is read once: a deck could point at one slide thousands of times.
    if (!target || seen.has(target)) continue;
    seen.add(target);
    const xml = await zip.text(target);
    if (xml === null) continue;
    const slide = slideText(xml);
    if (slide.hidden) {
      if (slide.text) hidden = true;
      continue;
    }
    slides++;
    // SmartArt text lives in a diagram data part the slide links to.
    let text = slide.text;
    const slideRels = await zip.text(target.replace(/([^/]+)$/, "_rels/$1.rels"));
    const base = target.slice(0, target.lastIndexOf("/") + 1);
    for (const rel of slideRels ? relationships(slideRels, base).filter((r) => r.type === "diagramData") : []) {
      if (seen.has(rel.target)) continue;
      seen.add(rel.target);
      const data = await zip.text(rel.target);
      const diagram = data ? diagramText(data) : "";
      if (diagram) text = text ? `${text}\n${diagram}` : diagram;
    }
    if (text) parts.push(`${t("read.slide", { n: position })}\n${text}`);
  }
  for (const name of zip.names()) {
    if (hidden) break;
    if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)) continue;
    // A notes page always has the slide number; only words count as notes.
    if (/\p{L}/u.test(slideText((await zip.text(name)) ?? "").text)) hidden = true;
  }
  return { text: parts.join("\n\n"), hidden, slides };
}
