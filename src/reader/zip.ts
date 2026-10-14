// A small zip reader for Word, Excel, PowerPoint and OpenDocument files,
// inflating with the browser's own DecompressionStream. Only entries a
// reader asks for are inflated, and every cap in limits.ts is checked
// against what the bytes really do, not only what the zip claims.
import { decodeText } from "./decode.ts";
import { LIMITS } from "./limits.ts";
import { ReadError } from "./types.ts";

interface Entry {
  flags: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

export interface Zip {
  has(name: string): boolean;
  names(): string[];
  bytes(name: string): Promise<Uint8Array | null>;
  text(name: string): Promise<string | null>;
}

const fail = () => new ReadError("failed");

export function openZip(data: Uint8Array): Zip {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (o: number) => {
    if (o < 0 || o + 2 > data.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o < 0 || o + 4 > data.length) throw fail();
    return dv.getUint32(o, true);
  };

  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw fail();
  const count = u16(eocd + 10);
  const cdOffset = u32(eocd + 16);
  // Zip64 is never needed for office files under the 50 MB file cap.
  if (count === 0xffff || cdOffset === 0xffffffff || count > LIMITS.zipEntries) throw fail();

  const entries = new Map<string, Entry>();
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (u32(p) !== 0x02014b50) throw fail();
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    if (p + 46 + nameLen > data.length) throw fail();
    const name = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nameLen));
    const entry: Entry = { flags: u16(p + 8), method: u16(p + 10), compressedSize: u32(p + 20), size: u32(p + 24), offset: u32(p + 42) };
    total += entry.size;
    if (total > LIMITS.zipTotalBytes) throw fail();
    entries.set(name, entry);
    p += 46 + nameLen + extraLen + commentLen;
  }

  // Bytes handed out across every read, so a document that points at one
  // part many times cannot inflate past the total cap either.
  let inflated = 0;

  async function bytes(name: string): Promise<Uint8Array | null> {
    const e = entries.get(name);
    if (!e) return null;
    if (e.flags & 1) throw new ReadError("encrypted");
    if (e.size > LIMITS.zipEntryBytes) throw fail();
    inflated += e.size;
    if (inflated > LIMITS.zipTotalBytes) throw fail();
    if (e.compressedSize > 0 && e.size / e.compressedSize > LIMITS.zipRatio) throw fail();
    if (u32(e.offset) !== 0x04034b50) throw fail();
    const start = e.offset + 30 + u16(e.offset + 26) + u16(e.offset + 28);
    if (start + e.compressedSize > data.length) throw fail();
    const raw = data.subarray(start, start + e.compressedSize);
    if (e.method === 0) {
      if (raw.length !== e.size) throw fail();
      return raw.slice();
    }
    if (e.method === 8) return inflateRaw(raw, e.size);
    throw fail();
  }

  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    bytes,
    text: async (name) => {
      const b = await bytes(name);
      return b === null ? null : decodeText(b);
    },
  };
}

/** Inflates into exactly `size` bytes; more output than that is a lie and fails. */
async function inflateRaw(input: Uint8Array, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let n = 0;
  const reader = new Blob([input.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (n + value.length > size) throw fail();
      out.set(value, n);
      n += value.length;
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e instanceof ReadError ? e : fail();
  }
  if (n !== size) throw fail();
  return out;
}

/** Which office format a zip holds, by its main part. */
export async function zipFormat(zip: Zip): Promise<"docx" | "odt" | "pptx" | "xlsx" | null> {
  if (zip.has("mimetype")) return (await zip.text("mimetype"))?.trim() === "application/vnd.oasis.opendocument.text" ? "odt" : null;
  if (zip.has("word/document.xml")) return "docx";
  if (zip.has("ppt/presentation.xml")) return "pptx";
  if (zip.has("xl/workbook.xml")) return "xlsx";
  return null;
}
