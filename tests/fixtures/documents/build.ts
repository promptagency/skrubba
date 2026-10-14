// Test documents, built by code so they are reproducible and reviewable.
// Every builder makes the same Swedish sample where it can, so tests compare
// against one expected text. Real-application files are in ./tika/.
import { crc32, deflateRawSync } from "node:zlib";

/** The shared sample: a name, an organisation, a personnummer, an address and a phone number. */
export const SAMPLE = {
  title: "Anställningsavtal",
  lines: [
    "Mellan Norrström Media AB och Anna Berg, personnummer 19850312-4471.",
    "Anna bor på Storgatan 12 i Umeå och nås på 070-1740612.",
  ],
};
export const SAMPLE_TEXT = [SAMPLE.title, ...SAMPLE.lines].join("\n");

/** Escape text for XML and HTML. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One byte per character, for text in the latin-1 range (windows-1252 for å, ä, ö, é). */
export function latin1(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => {
    const code = c.charCodeAt(0);
    if (code > 0xff) throw new Error(`not latin-1: ${c}`);
    return code;
  });
}

/** The ReadError reason a call throws or rejects with, or "none". */
export async function errorReason(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return (e as { reason?: string }).reason ?? "not a ReadError";
  }
  return "none";
}

/**
 * A zip file. Entries are deflated except `mimetype` (ODF wants it stored)
 * or when `store` is set. `encrypted` sets the encryption flag on entries;
 * `declaredSize` lies about an entry's size, to test the caps.
 */
export function buildZip(
  files: Record<string, string | Uint8Array>,
  opts: { store?: boolean; encrypted?: string[]; declaredSize?: Record<string, number> } = {},
): Uint8Array {
  const enc = new TextEncoder();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === "string" ? enc.encode(content) : content;
    const nameBytes = Buffer.from(enc.encode(name));
    const method = opts.store || name === "mimetype" ? 0 : 8;
    const comp = method === 8 ? deflateRawSync(data) : Buffer.from(data);
    const flags = 0x0800 | (opts.encrypted?.includes(name) ? 1 : 0);
    const size = opts.declaredSize?.[name] ?? data.length;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, comp);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  const count = Object.keys(files).length;
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
export const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** A Word paragraph with one run. */
export const wp = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

/** A .docx with the given body XML and optional headers, footers, footnotes and comments (inner XML of each part). */
export function buildDocx(parts: { body: string; headers?: string[]; footers?: string[]; footnotes?: string; comments?: string }): Uint8Array {
  const files: Record<string, string> = {};
  const rels: string[] = [];
  parts.headers?.forEach((xml, i) => {
    files[`word/header${i + 1}.xml`] = `<w:hdr ${W_NS}>${xml}</w:hdr>`;
    rels.push(`<Relationship Id="rIdH${i + 1}" Type="${REL}/header" Target="header${i + 1}.xml"/>`);
  });
  parts.footers?.forEach((xml, i) => {
    files[`word/footer${i + 1}.xml`] = `<w:ftr ${W_NS}>${xml}</w:ftr>`;
    rels.push(`<Relationship Id="rIdF${i + 1}" Type="${REL}/footer" Target="footer${i + 1}.xml"/>`);
  });
  if (parts.footnotes) files["word/footnotes.xml"] = `<w:footnotes ${W_NS}>${parts.footnotes}</w:footnotes>`;
  if (parts.comments) files["word/comments.xml"] = `<w:comments ${W_NS}>${parts.comments}</w:comments>`;
  return buildZip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${parts.body}</w:body></w:document>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${rels.join("")}</Relationships>`,
    ...files,
  });
}
