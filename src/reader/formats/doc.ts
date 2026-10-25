// Word 97–2003 (.doc): the main text, footnotes, headers, endnotes and text
// boxes, from the piece table. Comments are left out and we say so; field
// instructions are dropped and their results kept. Not handled (see PLAN.md,
// Open questions): deleted revisions, which need the formatting tables, and
// table rows, which come out on one line with cells by tab.
import type { Cfb } from "../cfb.ts";
import { LIMITS } from "../limits.ts";
import { tidy } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";

const fail = () => new ReadError("failed");

/** Word's special characters: paragraph, cell and page marks, fields, hyphens. */
function cleanWordText(s: string): string {
  let out = "";
  const fields: Array<"code" | "result"> = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 0x13) {
      fields.push("code");
      continue;
    }
    if (c === 0x14) {
      if (fields.length) fields[fields.length - 1] = "result";
      continue;
    }
    if (c === 0x15) {
      fields.pop();
      continue;
    }
    if (fields.includes("code")) continue;
    if (c === 0x0d || c === 0x0b || c === 0x0c) out += "\n";
    else if (c === 0x07) out += "\t";
    else if (c === 0x1e) out += "-";
    else if (c === 0x09 || c >= 0x20) out += ch;
  }
  return tidy(out);
}

function pieceText(word: Uint8Array, clx: Uint8Array): string {
  const dv = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);
  let p = 0;
  while (p < clx.length && clx[p] === 0x01) {
    if (p + 3 > clx.length) throw fail();
    p += 3 + dv.getUint16(p + 1, true);
  }
  if (clx[p] !== 0x02 || p + 5 > clx.length) throw fail();
  const lcb = dv.getUint32(p + 1, true);
  const plc = p + 5;
  if (plc + lcb > clx.length || lcb < 4 || (lcb - 4) % 12 !== 0) throw fail();
  const n = (lcb - 4) / 12;
  const cp1252 = new TextDecoder("windows-1252");
  const utf16 = new TextDecoder("utf-16le");
  let text = "";
  for (let i = 0; i < n; i++) {
    const start = dv.getUint32(plc + i * 4, true);
    const end = dv.getUint32(plc + (i + 1) * 4, true);
    if (end < start) throw fail();
    const length = end - start;
    // Pieces may overlap and repeat: a crafted file could build gigabytes before the cap at the end.
    if (text.length + length > LIMITS.textChars) throw new ReadError("tooLarge");
    const fcValue = dv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true);
    const fc = fcValue & 0x3fffffff;
    if (fcValue & 0x40000000) {
      const at = Math.floor(fc / 2);
      if (at + length > word.length) throw fail();
      text += cp1252.decode(word.subarray(at, at + length));
    } else {
      if (fc + length * 2 > word.length) throw fail();
      text += utf16.decode(word.subarray(fc, fc + length * 2));
    }
  }
  return text;
}

export function readDoc(cfb: Cfb): Extracted {
  const word = cfb.stream("WordDocument");
  if (!word || word.length < 0x200) throw fail();
  const dv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const u16 = (o: number) => {
    if (o + 2 > word.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o + 4 > word.length) throw fail();
    return dv.getUint32(o, true);
  };
  if (u16(0) !== 0xa5ec) throw fail();
  if (u16(2) < 0x00c1) throw new ReadError("unsupported"); // Word 6 and 95
  const flags = u16(0x0a);
  if (flags & 0x0100) throw new ReadError("encrypted");
  const table = cfb.stream(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw fail();
  const csw = u16(32);
  const lw = 36 + csw * 2; // FibRgLw97
  const cslw = u16(lw - 2);
  const fcLcb = lw + cslw * 4 + 2; // FibRgFcLcbBlob
  const ccp = (i: number) => u32(lw + i * 4);
  const fcClx = u32(fcLcb + 33 * 8);
  const lcbClx = u32(fcLcb + 33 * 8 + 4);
  if (fcClx + lcbClx > table.length) throw fail();
  const all = pieceText(word, table.subarray(fcClx, fcClx + lcbClx));
  let at = 0;
  const take = (count: number) => {
    const s = all.slice(at, at + count);
    at += count;
    return s;
  };
  // Stories in CP order: main, footnotes, headers, macro (unused), comments, endnotes, text boxes, header text boxes.
  const [main, footnotes, headers, , comments, endnotes, boxes, headerBoxes] = [3, 4, 5, 6, 7, 8, 9, 10].map((i) => take(ccp(i)));
  const parts = [main, footnotes, headers, endnotes, boxes, headerBoxes].map(cleanWordText).filter(Boolean);
  return { text: [...new Set(parts)].join("\n\n"), hidden: cleanWordText(comments) !== "" };
}
