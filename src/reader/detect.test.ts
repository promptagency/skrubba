import { describe, expect, it } from "vitest";
import { detect } from "./detect.ts";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe("detect", () => {
  it.each([
    ["a zip", bytes(0x50, 0x4b, 0x03, 0x04, 0x14), "x.bin", { family: "zip" }],
    ["an OLE file", bytes(...OLE, 0), "x.bin", { family: "ole" }],
    ["a PDF", ascii("%PDF-1.7\n"), "avtal.pdf", { family: "pdf" }],
    ["a PDF named .docx", ascii("%PDF-1.4\n"), "avtal.docx", { family: "pdf" }],
    ["a PDF after a few junk bytes", ascii("junk\r\n%PDF-1.4\n"), "avtal.pdf", { family: "pdf" }],
    ["RTF", ascii("{\\rtf1\\ansi hej}"), "brev.rtf", { family: "rtf" }],
    ["RTF named .doc", ascii("{\\rtf1 hej}"), "brev.doc", { family: "rtf" }],
    ["text by extension", ascii("hej"), "brev.txt", { family: "text", format: "txt" }],
    ["Markdown", ascii("# hej"), "NOTES.MD", { family: "text", format: "md" }],
    ["CSV", ascii("a;b"), "lista.csv", { family: "text", format: "csv" }],
    ["HTML", ascii("<p>hej</p>"), "sida.htm", { family: "text", format: "html" }],
    ["an email", ascii("From: a"), "mejl.eml", { family: "text", format: "eml" }],
    ["UTF-16 text with a byte order mark", bytes(0xff, 0xfe, 0x68, 0x00), "brev.txt", { family: "text", format: "txt" }],
  ])("finds %s", (_label, data, name, expected) => {
    expect(detect(data, name)).toEqual(expected);
  });

  it.each([
    ["an image", bytes(0x89, 0x50, 0x4e, 0x47), "bild.png"],
    ["text named .docx", ascii("hej"), "avtal.docx"],
    ["a binary file named .txt", bytes(0x68, 0x00, 0x65, 0x00), "brev.txt"],
    ["a file without an extension", ascii("hej"), "README"],
  ])("refuses %s", (_label, data, name) => {
    expect(detect(data, name)).toEqual({ family: "unknown" });
  });
});
