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

const ODF_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"';

/** An ODF paragraph. */
export const tp = (text: string) => `<text:p>${esc(text)}</text:p>`;

/** An .odt with the given office:text XML and an optional page header and footer. */
export function buildOdt(body: string, opts: { header?: string; footer?: string } = {}): Uint8Array {
  const header = opts.header ? `<style:header>${opts.header}</style:header>` : "";
  const footer = opts.footer ? `<style:footer>${opts.footer}</style:footer>` : "";
  return buildZip({
    mimetype: "application/vnd.oasis.opendocument.text",
    "content.xml": `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ODF_NS}><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
    "styles.xml": `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${ODF_NS}><office:master-styles><style:master-page style:name="Standard">${header}${footer}</style:master-page></office:master-styles></office:document-styles>`,
    "META-INF/manifest.xml": "<manifest/>",
  });
}

type XlsxCell = string | number | null | { f: string; v: number } | { inline: string };
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Column letters for a 0-based index: 0 → A, 26 → AA. */
function columnName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** An .xlsx. Strings go to the shared string table; `null` leaves a cell out; `comment` adds a cell comment. */
export function buildXlsx(sheets: Array<{ name: string; rows: XlsxCell[][]; state?: "hidden" | "veryHidden" }>, opts: { comment?: string } = {}): Uint8Array {
  const strings: string[] = [];
  const sst = (s: string) => {
    const at = strings.indexOf(s);
    return at >= 0 ? at : strings.push(s) - 1;
  };
  const cellXml = (c: XlsxCell, ref: string) => {
    if (c === null) return "";
    if (typeof c === "string") return `<c r="${ref}" t="s"><v>${sst(c)}</v></c>`;
    if (typeof c === "number") return `<c r="${ref}"><v>${c}</v></c>`;
    if ("f" in c) return `<c r="${ref}"><f>${esc(c.f)}</f><v>${c.v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(c.inline)}</t></is></c>`;
  };
  const files: Record<string, string> = {};
  const rels: string[] = [];
  const entries: string[] = [];
  sheets.forEach((sheet, si) => {
    const rows = sheet.rows.map((cells, ri) => `<row r="${ri + 1}">${cells.map((c, ci) => cellXml(c, `${columnName(ci)}${ri + 1}`)).join("")}</row>`).join("");
    files[`xl/worksheets/sheet${si + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${SHEET_NS}"><sheetData>${rows}</sheetData></worksheet>`;
    rels.push(`<Relationship Id="rId${si + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${si + 1}.xml"/>`);
    entries.push(`<sheet name="${esc(sheet.name)}" sheetId="${si + 1}"${sheet.state ? ` state="${sheet.state}"` : ""} r:id="rId${si + 1}"/>`);
  });
  if (opts.comment) {
    files["xl/comments1.xml"] = `<comments xmlns="${SHEET_NS}"><commentList><comment ref="A1"><text><t>${esc(opts.comment)}</t></text></comment></commentList></comments>`;
  }
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${SHEET_NS}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;
  return buildZip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${SHEET_NS}" xmlns:r="${REL}"><sheets>${entries.join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${rels.join("")}</Relationships>`,
    "xl/sharedStrings.xml": sharedStringsXml,
    ...files,
  });
}

/** A PDF string literal in WinAnsi (latin-1 range), with octal escapes for anything outside ASCII. */
function pdfString(s: string): string {
  let out = "(";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c > 0xff) throw new Error(`not in WinAnsi: ${ch}`);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (c < 0x20 || c > 0x7e) out += `\\${c.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `${out})`;
}

const streamObj = (dict: string, data: string) => `<< ${dict} /Length ${data.length} >>\nstream\n${data}\nendstream`;

/**
 * A PDF with Helvetica text, one line per string, or an image-only page
 * (`{ image: true }`, like a scan). `comment` adds a sticky note and `field`
 * a filled-in text field on the first page. `encrypted` adds a standard
 * security handler whose empty password does not open it.
 */
export function buildPdf(
  pages: Array<string[] | { image: true }>,
  opts: { encrypted?: boolean; comment?: string; field?: string } = {},
): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body);
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  const fields: number[] = [];
  for (const page of pages) {
    let resources = `/Font << /F1 ${font} 0 R >>`;
    let content: string;
    if ("image" in page) {
      const img = add(streamObj("/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8", "\x80".repeat(64)));
      resources += ` /XObject << /Im1 ${img} 0 R >>`;
      content = "q 200 0 0 200 72 500 cm /Im1 Do Q";
    } else {
      content = `BT /F1 12 Tf 14 TL 72 760 Td ${page.map((line) => `${pdfString(line)} Tj T*`).join(" ")} ET`;
    }
    const contents = add(streamObj("", content));
    const pageId = add("");
    const annots: number[] = [];
    if (kids.length === 0 && opts.comment) annots.push(add(`<< /Type /Annot /Subtype /Text /Rect [400 700 420 720] /Contents ${pdfString(opts.comment)} >>`));
    if (kids.length === 0 && opts.field) {
      const f = add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (namn) /V ${pdfString(opts.field)} /Rect [72 600 300 620] /P ${pageId} 0 R >>`);
      annots.push(f);
      fields.push(f);
    }
    const annotList = annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(" ")}]` : "";
    objs[pageId - 1] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << ${resources} >> /Contents ${contents} 0 R${annotList} >>`;
    kids.push(pageId);
  }
  const form = fields.length ? ` /AcroForm << /Fields [${fields.map((f) => `${f} 0 R`).join(" ")}] >>` : "";
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R${form} >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const encrypt = opts.encrypted ? add(`<< /Filter /Standard /V 1 /R 2 /Length 40 /P -3904 /O <${"ab".repeat(32)}> /U <${"cd".repeat(32)}> >>`) : 0;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  const encryptRef = encrypt ? ` /Encrypt ${encrypt} 0 R /ID [<${"01".repeat(16)}> <${"01".repeat(16)}>]` : "";
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${encryptRef} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}

/** Two pages of long lines wrapped mid-sentence, with a word split by a hyphen across lines. */
export const PDF_WRAPPED = [
  [
    "Anna Berg har arbetat på Norrström Media AB sedan 2019 och har under",
    "våren varit sjukskriven på heltid. Hon deltar nu i ett program för rehabili-",
    "tering som Försäkringskassan har godkänt efter ett möte i mars i år.",
  ],
  [
    "Erik Holm på HR ansvarar för uppföljningen och ringer Anna varje vecka",
    "under hösten för att stämma av hur arbetet med återgången går framåt.",
  ],
];
