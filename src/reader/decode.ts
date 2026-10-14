// Bytes to text. A byte order mark wins, then a declared charset, then UTF-8
// if the bytes are valid UTF-8, else windows-1252: Swedish files saved from
// Excel or old Windows programs are usually windows-1252, and read as UTF-8
// their å, ä and ö would turn into replacement characters.

const CODEPAGES: Record<number, string> = {
  65001: "utf-8",
  1252: "windows-1252",
  28591: "iso-8859-1",
  28605: "iso-8859-15",
  1200: "utf-16le",
  1201: "utf-16be",
  10000: "macintosh",
};

/** A TextDecoder label for a Windows code page number; windows-1252 when unknown. */
export function labelForCodepage(cp: number): string {
  return CODEPAGES[cp] ?? "windows-1252";
}

function decoderFor(label: string): TextDecoder | null {
  try {
    return new TextDecoder(label.trim().toLowerCase());
  } catch {
    return null;
  }
}

export function decodeText(bytes: Uint8Array, declared?: string): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const named = declared ? decoderFor(declared) : null;
  if (named && named.encoding !== "utf-8") return named.decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** One character per byte (U+0000 to U+00FF), for parsers that work on bytes. */
export function binaryString(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}
