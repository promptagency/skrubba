// Crafted files for the robustness exam: each must end as text or as one of
// the reader's named errors, within LIMITS.timeoutMs. Built with the same
// helpers as src/reader/**/*.test.ts.
import { buildCfb, buildDoc, buildDocx, buildZip, latin1, wp } from "../fixtures/documents/build.ts";
import type { ErrorReason } from "../../src/reader/types.ts";

export interface HostileFile {
  probe: string;
  name: string;
  bytes: () => Uint8Array;
  /** The documented outcome, when ARCHITECTURE or limits.ts names one. */
  reason?: ErrorReason;
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const docxBody = (xml: string) => buildDocx({ body: xml });

function loopingWordDocument(): Uint8Array {
  const bytes = buildCfb({ WordDocument: new Uint8Array(1500) });
  // Sector 0 is the FAT, 1 the directory, 2 the stream's first: point it at itself.
  new DataView(bytes.buffer).setUint32(512 + 2 * 4, 2, true);
  return bytes;
}

function loopingToEarlierSector(): Uint8Array {
  const bytes = buildCfb({ WordDocument: new Uint8Array(3000) });
  // The stream runs over sectors 2..7: let 7 point back to 3.
  new DataView(bytes.buffer).setUint32(512 + 7 * 4, 3, true);
  return bytes;
}

function outOfRangeSector(): Uint8Array {
  const bytes = buildCfb({ WordDocument: new Uint8Array(1500) });
  new DataView(bytes.buffer).setUint32(512 + 2 * 4, 0x00ffffff, true);
  return bytes;
}

export const HOSTILE: HostileFile[] = [
  // Zip caps (zip.ts, limits.ts).
  { probe: "zip bomb: 10 MB of zeros, ratio far past 200:1", name: "bomb.docx", bytes: () => buildZip({ "word/document.xml": new Uint8Array(10 * 1024 * 1024) }), reason: "failed" },
  { probe: "zip entry over 50 MB", name: "stor.docx", bytes: () => buildZip({ "word/document.xml": new Uint8Array(60 * 1024 * 1024) }), reason: "failed" },
  { probe: "2 001 zip entries", name: "manga.docx", bytes: () => buildZip(Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`f${i}.xml`, "x"])), { store: true }), reason: "failed" },
  {
    probe: "declared sizes over 100 MB in total",
    name: "lögn.docx",
    bytes: () => buildZip({ "word/document.xml": "x", b: "x", c: "x" }, { store: true, declaredSize: { "word/document.xml": 40e6, b: 40e6, c: 40e6 } }),
    reason: "failed",
  },
  {
    probe: "document.xml inflates past its declared size",
    name: "kort.docx",
    bytes: () => buildZip({ "word/document.xml": `<w:document><w:body>${wp("Anna Berg ".repeat(50))}</w:body></w:document>` }, { declaredSize: { "word/document.xml": 20 } }),
    reason: "failed",
  },
  { probe: "encrypted zip entry", name: "låst.docx", bytes: () => buildZip({ "word/document.xml": "<w/>" }, { encrypted: ["word/document.xml"] }), reason: "encrypted" },
  { probe: "truncated docx (first 200 bytes)", name: "trasig.docx", bytes: () => docxBody(wp("Hej")).slice(0, 200) },
  { probe: "zip that is no Office format", name: "arkiv.docx", bytes: () => buildZip({ "readme.txt": "hej" }), reason: "unsupported" },

  // Compound files (cfb.ts, doc.ts).
  { probe: "cfb sector chain points at itself", name: "loop.doc", bytes: loopingWordDocument, reason: "failed" },
  { probe: "cfb sector chain loops back to an earlier sector", name: "loop2.doc", bytes: loopingToEarlierSector, reason: "failed" },
  { probe: "cfb sector out of range", name: "utanfor.doc", bytes: outOfRangeSector, reason: "failed" },
  { probe: "OLE magic followed by zeros", name: "tom.doc", bytes: () => new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Uint8Array(1016)]), reason: "failed" },
  { probe: ".doc pieces repeating past the text cap", name: "bitar.doc", bytes: () => buildDoc({ main: `${"Anna Berg bor i Umeå. ".repeat(100)}\r`.padEnd(2000, "x"), pieces: 1001 }), reason: "tooLarge" },
  { probe: ".doc with 20 000 pieces", name: "bitar2.doc", bytes: () => buildDoc({ main: `${"x".repeat(200)}\r`, pieces: 20_000 }) },

  // Lookups by a name from the file.
  { probe: "RTF control words named like Object.prototype members", name: "proto.rtf", bytes: () => latin1(String.raw`{\rtf1 Anna \constructor\__proto__\toString\hasOwnProperty\valueOf Berg}`) },
  { probe: "HTML entities named like Object.prototype members", name: "proto.html", bytes: () => utf8("<p>a &constructor; &__proto__; &toString; &hasOwnProperty; b</p>") },
  { probe: "XML entity &constructor; inside a docx", name: "proto.docx", bytes: () => docxBody("<w:p><w:r><w:t>a &constructor; &__proto__; b</w:t></w:r></w:p>") },
  { probe: "file extension named like an Object.prototype member", name: "brev.constructor", bytes: () => utf8("hej"), reason: "unsupported" },

  // Long runs of blanks (TRAILING_BLANKS).
  { probe: "100 000 spaces in .txt", name: "blank.txt", bytes: () => utf8(`Rad ett${" ".repeat(100_000)}\nRad två`) },
  { probe: "100 000 spaces with no line end", name: "blank.md", bytes: () => utf8(`a${" ".repeat(100_000)}`) },
  { probe: "100 000 tabs in .csv", name: "blank.csv", bytes: () => utf8(`a${"\t".repeat(100_000)}b\n`) },
  { probe: "100 000 spaces in HTML", name: "blank.html", bytes: () => utf8(`<p>a${" ".repeat(100_000)}</p><p>b</p>`) },
  { probe: "100 000 spaces in RTF", name: "blank.rtf", bytes: () => latin1(`{\\rtf1 a${" ".repeat(100_000)}\\par b}`) },
  { probe: "100 000 spaces in a docx paragraph", name: "blank.docx", bytes: () => docxBody(wp(`a${" ".repeat(100_000)}`) + wp("b")) },
  { probe: "only whitespace", name: "tom.txt", bytes: () => utf8(" \n\t\r\n"), reason: "empty" },
  { probe: "empty file", name: "noll.txt", bytes: () => new Uint8Array(0) },

  // Nesting depth (recursion).
  { probe: "RTF nested 100 000 groups deep", name: "djup.rtf", bytes: () => latin1(`{\\rtf1 ${"{".repeat(100_000)}x${"}".repeat(100_000)}}`) },
  { probe: "HTML nested 100 000 divs deep", name: "djup.html", bytes: () => utf8(`${"<div>".repeat(100_000)}x${"</div>".repeat(100_000)}`) },
  { probe: "docx with 100 000 nested elements", name: "djup.docx", bytes: () => docxBody(`<w:p>${"<w:r>".repeat(100_000)}<w:t>x</w:t>${"</w:r>".repeat(100_000)}</w:p>`) },

  // Odd RTF controls.
  { probe: "RTF \\bin with a huge count", name: "bin.rtf", bytes: () => latin1(String.raw`{\rtf1 Anna{\pict\bin999999999 xx}} Berg}`) },
  { probe: "RTF \\uc with a huge skip count", name: "uc.rtf", bytes: () => latin1("{\\rtf1 \\uc99999999\\u229 Anna Berg}") }, // not String.raw: vitest cooks \u in raw templates
  { probe: "RTF unbalanced closing braces", name: "obalans.rtf", bytes: () => latin1(String.raw`{\rtf1 Anna}}}}}}}} Berg`) },

  // NUL bytes in "text".
  { probe: "NUL bytes at the start of a .txt", name: "nul.txt", bytes: () => utf8("hej\0\0\0då"), reason: "unsupported" },
  { probe: "NUL byte after the first 8 KiB of a .txt", name: "nul2.txt", bytes: () => utf8(`${"a".repeat(9000)}\0b`) },
  { probe: "NUL bytes in an .eml", name: "nul.eml", bytes: () => utf8("From: a\r\n\r\nhej\0då"), reason: "unsupported" },

  // Renamed files: never parsed as the wrong thing.
  { probe: "docx renamed .txt", name: "avtal.txt", bytes: () => docxBody(wp("Hej")) },
  { probe: "docx renamed .pdf", name: "avtal.pdf", bytes: () => docxBody(wp("Hej")) },
  { probe: "RTF renamed .docx", name: "brev.docx", bytes: () => latin1(String.raw`{\rtf1 Hej}`) },
  { probe: "text renamed .docx", name: "brev.docx", bytes: () => utf8("hej"), reason: "unsupported" },
  { probe: "PNG renamed .doc", name: "bild.doc", bytes: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), reason: "unsupported" },
  { probe: "cfb .doc renamed .txt", name: "brev.txt", bytes: () => buildDoc({ main: "Anna Berg\r" }) },

  // Text cap.
  { probe: "text one character past 2 000 000", name: "lang.txt", bytes: () => utf8("a".repeat(2_000_001)), reason: "tooLarge" },
];
