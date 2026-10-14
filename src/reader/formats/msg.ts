// Outlook messages (.msg): sender, recipients, subject, date and body from
// the message's property streams; the plain body, else the HTML body.
// Attachments are left out, and we say so. A message whose only body is
// compressed RTF gives the headers alone (see PLAN.md, Open questions).
import type { Cfb } from "../cfb.ts";
import { decodeText, labelForCodepage } from "../decode.ts";
import type { Extracted } from "../types.ts";
import { htmlToText } from "./html.ts";
import { mailText } from "./mail.ts";

const PR = {
  subject: 0x0037,
  sentRepresentingName: 0x0042,
  sentRepresentingEmail: 0x0065,
  senderName: 0x0c1a,
  senderEmail: 0x0c1f,
  displayCc: 0x0e03,
  displayTo: 0x0e04,
  body: 0x1000,
  html: 0x1013,
  senderSmtp: 0x5d01,
};
const TAG_CODEPAGE = 0x3fde0003;
const TAG_SUBMIT_TIME = 0x00390040;
const TAG_DELIVERY_TIME = 0x0e060040;
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const trimNul = (b: Uint8Array) => {
  let end = b.length;
  while (end > 0 && b[end - 1] === 0) end--;
  return b.subarray(0, end);
};

/** The fixed-size properties of the message: tag → the 8-byte value as two 32-bit halves. */
function fixedProperties(stream: Uint8Array | null): Map<number, { lo: number; hi: number }> {
  const out = new Map<number, { lo: number; hi: number }>();
  if (!stream) return out;
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let at = 32; at + 16 <= stream.length; at += 16) out.set(dv.getUint32(at, true), { lo: dv.getUint32(at + 8, true), hi: dv.getUint32(at + 12, true) });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function readMsg(cfb: Cfb): Extracted {
  const fixed = fixedProperties(cfb.stream("__properties_version1.0"));
  const codepage = fixed.get(TAG_CODEPAGE)?.lo;
  const label = codepage ? labelForCodepage(codepage) : undefined;
  const str = (id: number): string | undefined => {
    const unicode = cfb.stream(`__substg1.0_${hex4(id)}001F`);
    if (unicode) return new TextDecoder("utf-16le").decode(unicode).replace(/\0+$/, "");
    const ansi = cfb.stream(`__substg1.0_${hex4(id)}001E`);
    if (ansi) return decodeText(trimNul(ansi), label);
    return undefined;
  };
  const time = fixed.get(TAG_SUBMIT_TIME) ?? fixed.get(TAG_DELIVERY_TIME);
  const date = time ? formatDate(new Date((time.hi * 2 ** 32 + time.lo) / 10000 - 11644473600000)) : undefined;
  const email = [str(PR.senderSmtp), str(PR.senderEmail), str(PR.sentRepresentingEmail)].find((e) => e?.includes("@"));
  const name = str(PR.senderName) ?? str(PR.sentRepresentingName);
  const from = name && email && name !== email ? `${name} <${email}>` : (name ?? email);
  const htmlBytes = cfb.stream(`__substg1.0_${hex4(PR.html)}0102`);
  const html = htmlBytes ? decodeText(trimNul(htmlBytes), label) : str(PR.html);
  const body = str(PR.body) ?? (html ? htmlToText(html).text : "");
  const attachments = cfb.paths().some((p) => p.startsWith("__attach_version1.0_"));
  return { text: mailText({ from, to: str(PR.displayTo), cc: str(PR.displayCc), subject: str(PR.subject), date }, body), attachments };
}
