// Saved emails (.eml): From, To, Cc, Subject and Date, then the body. The
// plain-text part is preferred; an HTML-only mail goes through html.ts.
// Attachments are left out, and we say so. Works on the raw bytes as a
// binary string, and decodes each part in its own charset.
import { binaryString, decodeText } from "../decode.ts";
import type { Extracted } from "../types.ts";
import { htmlToText } from "./html.ts";
import { mailText } from "./mail.ts";

interface Part {
  headers: Map<string, string>;
  body: string;
}

const bytesOf = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function parsePart(raw: string): Part {
  // Headers end at the first blank line; a part may have no headers at all.
  const blank = /^\r?\n/.exec(raw) ?? /\r?\n\r?\n/.exec(raw);
  const head = blank ? raw.slice(0, blank.index) : raw;
  const body = blank ? raw.slice(blank.index + blank[0].length) : "";
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(key)) headers.set(key, line.slice(colon + 1).trim());
  }
  return { headers, body };
}

function param(value: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i").exec(value);
  return m ? (m[1] ?? m[2]) : undefined;
}

function base64(s: string): Uint8Array {
  let clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  if (clean.length % 4 === 1) clean = clean.slice(0, -1);
  clean += "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    return bytesOf(atob(clean));
  } catch {
    return new Uint8Array(0);
  }
}

const unQuote = (s: string) => s.replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)));

/** A header value: RFC 2047 encoded words decoded, raw 8-bit text decoded as UTF-8 or windows-1252. */
function decodeHeader(raw: string): string {
  const joined = raw.replace(/(=\?[^?]+\?[bq]\?[^?]*\?=)\s+(?==\?)/gi, "$1");
  const decoded = joined.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, charset: string, enc: string, text: string) =>
    decodeText(enc.toLowerCase() === "b" ? base64(text) : bytesOf(unQuote(text.replace(/_/g, " "))), charset),
  );
  return decoded === joined && /[\x80-\xff]/.test(decoded) ? decodeText(bytesOf(decoded)) : decoded;
}

function contentType(part: Part): string {
  return (part.headers.get("content-type") ?? "text/plain").split(";")[0].trim().toLowerCase();
}

function decodeBody(part: Part): string {
  const cte = (part.headers.get("content-transfer-encoding") ?? "").trim().toLowerCase();
  const bytes =
    cte === "base64" ? base64(part.body) : cte === "quoted-printable" ? bytesOf(unQuote(part.body.replace(/=\r?\n/g, ""))) : bytesOf(part.body);
  return decodeText(bytes, param(part.headers.get("content-type") ?? "", "charset"));
}

function splitMultipart(body: string, boundary: string): string[] {
  const parts: string[] = [];
  const delimiter = `--${boundary}`;
  let current: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith(delimiter)) {
      if (current) parts.push(current.join("\r\n"));
      if (line.startsWith(`${delimiter}--`)) return parts;
      current = [];
      continue;
    }
    current?.push(line);
  }
  if (current) parts.push(current.join("\r\n"));
  return parts;
}

interface Found {
  plain: string | null;
  html: string | null;
  attachments: boolean;
}

function walk(part: Part, found: Found): void {
  const type = contentType(part);
  const ct = part.headers.get("content-type") ?? "";
  const disposition = part.headers.get("content-disposition") ?? "";
  const isAttachment = /^\s*attachment/i.test(disposition) || !!param(disposition, "filename") || !!param(ct, "name");
  if (type.startsWith("multipart/")) {
    const boundary = param(ct, "boundary");
    if (!boundary) return;
    const children = splitMultipart(part.body, boundary).map(parsePart);
    if (type === "multipart/alternative") {
      const pick =
        children.find((c) => contentType(c) === "text/plain") ??
        children.find((c) => contentType(c) === "text/html") ??
        children.find((c) => contentType(c).startsWith("multipart/"));
      if (pick) walk(pick, found);
      return;
    }
    for (const child of children) walk(child, found);
    return;
  }
  if (!isAttachment && type === "text/plain") {
    const text = decodeBody(part);
    found.plain = found.plain === null ? text : `${found.plain}\n\n${text}`;
  } else if (!isAttachment && type === "text/html") {
    if (found.html === null) found.html = decodeBody(part);
  } else found.attachments = true;
}

export function readEml(bytes: Uint8Array): Extracted {
  const top = parsePart(binaryString(bytes));
  const found: Found = { plain: null, html: null, attachments: false };
  walk(top, found);
  const body = found.plain ?? (found.html !== null ? htmlToText(found.html).text : "");
  const header = (key: string) => {
    const value = top.headers.get(key);
    return value === undefined ? undefined : decodeHeader(value);
  };
  const headers = { from: header("from"), to: header("to"), cc: header("cc"), subject: header("subject"), date: header("date") };
  return { text: mailText(headers, body), attachments: found.attachments };
}
