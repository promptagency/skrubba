// Excel (.xlsx): every visible sheet under its name, one row per line, cells
// by tab, shared strings resolved and the stored value of formulas. Hidden
// sheets and cell comments are left out, and we say so. Dates come out as
// Excel's serial numbers (see PLAN.md, Open questions).
import { t } from "../../ui/copy.ts";
import { relationships } from "../ooxml.ts";
import { type Extracted, ReadError } from "../types.ts";
import { type XmlEvent, xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const MAX_COLUMNS = 16384;

/**
 * Elements by local name: Excel writes <c>, the .NET OpenXML SDK often
 * <x:c>. Attribute names keep their prefix (r:id stays r:id).
 */
function* localEvents(xml: string): Generator<XmlEvent> {
  for (const ev of xmlEvents(xml)) yield ev.type === "text" ? ev : { ...ev, name: ev.name.slice(ev.name.indexOf(":") + 1) };
}

export function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  let current: string | null = null;
  let skip = 0;
  let inText = false;
  for (const ev of localEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "si") current = "";
      else if (ev.name === "rPh" || ev.name === "phoneticPr") skip = 1;
      else if (ev.name === "t") inText = true;
    } else if (ev.type === "close") {
      if (ev.name === "si") {
        out.push(current ?? "");
        current = null;
      } else if (ev.name === "t") inText = false;
    } else if (inText && current !== null) current += ev.text;
  }
  return out;
}

/** 0-based column of a cell reference: "A1" → 0, "AB3" → 27. */
function columnOf(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

interface Cell {
  column: number;
  type: string;
  value: string;
  inline: string;
}

function cellText(cell: Cell, strings: string[]): string {
  if (cell.type === "s") return strings[Number(cell.value)] ?? "";
  if (cell.type === "inlineStr") return cell.inline;
  if (cell.type === "b") return cell.value === "1" ? "TRUE" : "FALSE";
  return cell.value;
}

function sheetText(xml: string, strings: string[]): string {
  const rows: string[] = [];
  let row: string[] | null = null;
  let cell: Cell | null = null;
  let next = 0;
  let inValue = false;
  let inText = false;
  let skip = 0;
  for (const ev of localEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "text") {
      if (cell && inValue) cell.value += ev.text;
      else if (cell && inText) cell.inline += ev.text;
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "row") {
        row = [];
        next = 0;
      } else if (ev.name === "c") cell = { column: ev.attrs.r ? columnOf(ev.attrs.r) : next, type: ev.attrs.t ?? "n", value: "", inline: "" };
      else if (ev.name === "v") inValue = true;
      else if (ev.name === "t") inText = true;
      else if (ev.name === "f" || ev.name === "rPh") skip = 1;
      continue;
    }
    if (ev.name === "v") inValue = false;
    else if (ev.name === "t") inText = false;
    else if (ev.name === "c" && cell) {
      if (row && cell.column >= 0 && cell.column < MAX_COLUMNS) row[cell.column] = cellText(cell, strings);
      next = cell.column + 1;
      cell = null;
    } else if (ev.name === "row" && row) {
      const line = Array.from(row, (v) => v ?? "")
        .join("\t")
        .replace(/\t+$/, "");
      if (line.trim()) rows.push(line);
      row = null;
    }
  }
  return rows.join("\n");
}

export async function readXlsx(zip: Zip): Promise<Extracted> {
  const workbook = await zip.text("xl/workbook.xml");
  if (workbook === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("xl/_rels/workbook.xml.rels")) ?? "", "xl/");
  const strings = sharedStrings((await zip.text("xl/sharedStrings.xml")) ?? "");
  let hidden = zip.names().some((n) => /^xl\/(comments\d*|threadedComments\/[^/]+)\.xml$/.test(n));
  const parts: string[] = [];
  let sheets = 0;
  const seen = new Set<string>();
  for (const ev of localEvents(workbook)) {
    if (ev.type !== "open" || ev.name !== "sheet") continue;
    const target = rels.find((r) => r.id === ev.attrs["r:id"])?.target;
    // A sheet listed again is read once: a workbook could point at one sheet thousands of times.
    if (!target || seen.has(target)) continue;
    seen.add(target);
    const xml = await zip.text(target);
    if (xml === null) continue;
    const text = sheetText(xml, strings);
    if (ev.attrs.state === "hidden" || ev.attrs.state === "veryHidden") {
      if (text) hidden = true;
      continue;
    }
    sheets++;
    if (text) parts.push(`${t("read.sheet", { name: ev.attrs.name ?? String(sheets) })}\n${text}`);
  }
  return { text: parts.join("\n\n"), hidden, sheets };
}
