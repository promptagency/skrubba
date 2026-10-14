// RTF: body text, tables, fields' results, Unicode escapes and hex bytes in
// the document's code page. Font, colour and style tables, metadata, pictures
// and field instructions are skipped. Annotations, hidden text (\v) and
// deleted text are left out, and we say so.
import { binaryString, decodeText, labelForCodepage } from "../decode.ts";
import type { Extracted } from "../types.ts";

/** Destinations skipped without a word: nobody reads them as text. */
const SKIP = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "objdata", "themedata", "colorschememapping", "datastore",
  "latentstyles", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "mmathPr", "fldinst",
  "pgdsctbl", "revtbl", "filetbl", "shprslt", "sp", "nonshppict", "bkmkstart", "bkmkend", "fontemb", "fontfile",
  "userprops", "docvar", "xe", "tc", "template", "listtext", "pntext",
]);
/** Destinations the writer hid from the page; text in them sets the note. */
const HIDDEN = new Set(["annotation", "atnid", "atnauthor", "atndate", "atnicn", "atnref", "atrfstart", "atrfend", "atnparent"]);
/** Starred destinations that hold visible text (text boxes). Every other starred one is skipped. */
const KEEP_STARRED = new Set(["shpinst", "shptxt"]);
const SYMBOLS: Record<string, string> = {
  par: "\n",
  line: "\n",
  sect: "\n",
  page: "\n",
  tab: "\t",
  cell: "\t",
  emdash: "—",
  endash: "–",
  bullet: "•",
  lquote: "‘",
  rquote: "’",
  ldblquote: "“",
  rdblquote: "”",
  emspace: " ",
  enspace: " ",
  qmspace: " ",
};
const CONTROL_WORD = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/;

interface Group {
  skip: "no" | "silent" | "hidden";
  hiddenText: boolean;
  uc: number;
}

export function readRtf(bytes: Uint8Array): Extracted {
  const src = binaryString(bytes);
  let out = "";
  let hidden = false;
  let label = "windows-1252";
  let group: Group = { skip: "no", hiddenText: false, uc: 1 };
  const stack: Group[] = [];
  let pending: number[] = [];
  let skipChars = 0;
  let atGroupStart = false;
  let starred = false;

  const emit = (s: string) => {
    if (group.skip !== "no" || group.hiddenText) {
      if (group.skip !== "silent" && s.trim()) hidden = true;
      return;
    }
    out += s;
  };
  const flush = () => {
    if (!pending.length) return;
    emit(decodeText(Uint8Array.from(pending), label));
    pending = [];
  };
  const literal = (s: string) => {
    atGroupStart = false;
    flush();
    if (skipChars > 0) {
      skipChars--;
      return;
    }
    emit(s);
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "{") {
      flush();
      stack.push(group);
      group = { ...group };
      atGroupStart = true;
      starred = false;
      skipChars = 0;
      i++;
      continue;
    }
    if (c === "}") {
      flush();
      group = stack.pop() ?? group;
      atGroupStart = false;
      skipChars = 0;
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (c !== "\\") {
      literal(c);
      i++;
      continue;
    }
    const next = src[i + 1];
    if (next === "'") {
      const byte = Number.parseInt(src.slice(i + 2, i + 4), 16);
      i += 4;
      atGroupStart = false;
      if (skipChars > 0) skipChars--;
      else if (!Number.isNaN(byte)) pending.push(byte);
      continue;
    }
    flush();
    if (next === "*") {
      starred = true;
      i += 2;
      continue;
    }
    const m = next !== undefined && /[a-zA-Z]/.test(next) ? CONTROL_WORD.exec(src.slice(i + 1, i + 50)) : null;
    if (!m) {
      i += 2;
      if (next === "\\" || next === "{" || next === "}") literal(next);
      else if (next === "~") literal(" ");
      else if (next === "_") literal("-");
      else if (next === "\n" || next === "\r") literal("\n");
      continue;
    }
    i += 1 + m[0].length;
    const word = m[1];
    const param = m[2] === undefined ? null : Number(m[2]);
    if (atGroupStart) {
      atGroupStart = false;
      if (HIDDEN.has(word)) {
        if (group.skip === "no") group.skip = "hidden";
        continue;
      }
      if (SKIP.has(word) || (starred && !KEEP_STARRED.has(word))) {
        if (group.skip === "no") group.skip = "silent";
        continue;
      }
    }
    if (word === "bin") {
      i += Math.max(0, param ?? 0);
      continue;
    }
    if (word === "ansicpg" && param !== null) label = labelForCodepage(param);
    else if (word === "uc" && param !== null) group.uc = param;
    else if (word === "u" && param !== null) {
      emit(String.fromCharCode(param < 0 ? param + 65536 : param));
      skipChars = group.uc;
    } else if (word === "v" || word === "deleted") group.hiddenText = param !== 0;
    else if (word === "plain") group.hiddenText = false;
    else if (word === "row") {
      if (group.skip === "no" && !group.hiddenText) out = `${out.replace(/\t$/, "")}\n`;
    } else if (SYMBOLS[word]) emit(SYMBOLS[word]);
  }
  flush();
  return { text: out.replace(/[ \t]+$/gm, "").trim(), hidden };
}
