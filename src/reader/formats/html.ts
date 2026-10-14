// HTML (saved web pages and the HTML body of emails): the visible text, one
// block per paragraph, table cells by tab. The head, scripts, styles and
// similar are skipped; elements marked hidden are left out and we say so.
import { binaryString, decodeText } from "../decode.ts";
import { TextBuilder } from "../textBuilder.ts";
import type { Extracted } from "../types.ts";

const SKIP = new Set(["script", "style", "head", "template", "noscript", "svg", "object", "iframe", "select"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "caption", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "ul",
]);
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  shy: "",
  auml: "ä",
  Auml: "Ä",
  ouml: "ö",
  Ouml: "Ö",
  aring: "å",
  Aring: "Å",
  eacute: "é",
  Eacute: "É",
  uuml: "ü",
  Uuml: "Ü",
  szlig: "ß",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  euro: "€",
  copy: "©",
  reg: "®",
};
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const HIDDEN_ATTR = /(^|\s)hidden(\s|=|$)/i;

export function htmlEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== "#") return NAMED[body] ?? whole;
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

export function htmlToText(html: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skipName: string | null = null;
  let skipDepth = 0;
  let skipIsHidden = false;
  let hidden = false;
  let pre = 0;
  let inCell = false;
  let inRow = false;
  const endCell = () => {
    if (inCell) out.closeCell();
    inCell = false;
  };
  const endRow = () => {
    endCell();
    if (inRow) out.closeRow();
    inRow = false;
  };
  for (const m of html.matchAll(TOKEN)) {
    const [token, slash, rawName, attrs = ""] = m;
    if (token.startsWith("<!--")) continue;
    if (rawName === undefined) {
      const text = htmlEntities(token);
      if (skipName) {
        if (skipIsHidden && text.trim()) hidden = true;
      } else out.add(pre ? text : text.replace(/\s+/g, " "));
      continue;
    }
    const name = rawName.toLowerCase();
    const closing = slash === "/";
    const selfClosing = /\/\s*$/.test(attrs);
    if (skipName) {
      if (name === skipName && !selfClosing) {
        if (!closing) skipDepth++;
        else if (--skipDepth === 0) skipName = null;
      }
      continue;
    }
    if (!closing && !VOID.has(name) && !selfClosing && (SKIP.has(name) || HIDDEN_ATTR.test(attrs))) {
      skipName = name;
      skipDepth = 1;
      skipIsHidden = !SKIP.has(name);
      continue;
    }
    if (name === "br") out.add("\n");
    else if (name === "pre") pre = Math.max(0, pre + (closing ? -1 : 1));
    else if (name === "td" || name === "th") {
      endCell();
      if (!closing) {
        out.openCell();
        inCell = true;
      }
    } else if (name === "tr") {
      endRow();
      if (!closing) inRow = true;
    } else if (name === "table" && closing) endRow();
    if (BLOCK.has(name)) out.add("\n");
  }
  endRow();
  const text = out
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  return { text, hidden };
}

export function readHtml(bytes: Uint8Array): Extracted {
  const head = binaryString(bytes.subarray(0, 1024));
  const declared = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  return htmlToText(decodeText(bytes, declared));
}
