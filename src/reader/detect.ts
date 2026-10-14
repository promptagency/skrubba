// Which reader a file goes to, by its first bytes. The name only decides
// between plain-text formats, so a renamed file is never parsed as the
// wrong thing.

export type Detected =
  | { family: "zip" }
  | { family: "ole" }
  | { family: "pdf" }
  | { family: "rtf" }
  | { family: "text"; format: "txt" | "md" | "csv" | "html" | "eml" }
  | { family: "unknown" };

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const TEXT_EXTENSIONS: Record<string, "txt" | "md" | "csv" | "html" | "eml"> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  csv: "csv",
  html: "html",
  htm: "html",
  eml: "eml",
};

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

function asciiHead(b: Uint8Array, n: number): string {
  let s = "";
  for (let i = 0; i < Math.min(n, b.length); i++) s += String.fromCharCode(b[i]);
  return s;
}

const hasBom = (b: Uint8Array) => startsWith(b, [0xef, 0xbb, 0xbf]) || startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff]);

export function detect(bytes: Uint8Array, name: string): Detected {
  if (startsWith(bytes, ZIP)) return { family: "zip" };
  if (startsWith(bytes, OLE)) return { family: "ole" };
  // pdf.js accepts a header anywhere in the first kilobyte, as Acrobat does.
  if (asciiHead(bytes, 1024).includes("%PDF-")) return { family: "pdf" };
  const head = asciiHead(startsWith(bytes, [0xef, 0xbb, 0xbf]) ? bytes.subarray(3) : bytes, 5);
  if (head === "{\\rtf") return { family: "rtf" };
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  const format = TEXT_EXTENSIONS[ext];
  if (!format) return { family: "unknown" };
  if (!hasBom(bytes) && bytes.subarray(0, 8192).includes(0)) return { family: "unknown" };
  return { family: "text", format };
}
