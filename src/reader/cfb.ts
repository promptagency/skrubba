// Microsoft's compound file format (OLE): the container of Word 97–2003
// documents, Outlook messages and password-protected Office files. Every
// sector chain is checked for loops and out-of-range sectors, and no stream
// may claim more bytes than the file has.
import { ReadError } from "./types.ts";

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END = 0xfffffffe;
const NONE = 0xffffffff;
const MAX_REGULAR = 0xfffffffa;

interface DirEntry {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  start: number;
  size: number;
}

export interface Cfb {
  has(path: string): boolean;
  paths(): string[];
  stream(path: string): Uint8Array | null;
}

const fail = () => new ReadError("failed");

export function openCfb(data: Uint8Array): Cfb {
  if (data.length < 512 || !SIGNATURE.every((b, i) => data[i] === b)) throw fail();
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (o: number) => {
    if (o + 2 > data.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o + 4 > data.length) throw fail();
    return dv.getUint32(o, true);
  };
  const shift = u16(0x1e);
  if ((shift !== 9 && shift !== 12) || u16(0x20) !== 6) throw fail();
  const size = 1 << shift;
  const perSector = size / 4;
  const miniSize = 64;
  const cutoff = u32(0x38);
  const sectorAt = (s: number) => {
    const o = (s + 1) * size;
    if (s > MAX_REGULAR || o >= data.length) throw fail();
    return o;
  };
  const readTable = (sectors: number[]) => {
    const table = new Uint32Array(sectors.length * perSector);
    sectors.forEach((s, k) => {
      const o = sectorAt(s);
      for (let i = 0; i < perSector; i++) table[k * perSector + i] = u32(o + i * 4);
    });
    return table;
  };

  const numFat = u32(0x2c);
  if (numFat > data.length / size + 1) throw fail();
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) fatSectors.push(u32(0x4c + i * 4));
  let difat = u32(0x44);
  for (let hops = 0; fatSectors.length < numFat; hops++) {
    if (difat > MAX_REGULAR || hops > u32(0x48)) throw fail();
    const o = sectorAt(difat);
    for (let i = 0; i < perSector - 1 && fatSectors.length < numFat; i++) fatSectors.push(u32(o + i * 4));
    difat = u32(o + size - 4);
  }
  const fat = readTable(fatSectors);

  const chain = (start: number, table: Uint32Array): number[] => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let s = start; s !== END; s = table[s]) {
      if (s >= table.length || seen.has(s)) throw fail();
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  const readRegular = (start: number, length: number): Uint8Array => {
    const out = new Uint8Array(length);
    let n = 0;
    for (const s of chain(start, fat)) {
      if (n >= length) break;
      const o = sectorAt(s);
      const piece = data.subarray(o, o + Math.min(size, length - n));
      out.set(piece, n);
      n += piece.length;
    }
    if (n < length) throw fail();
    return out;
  };

  const entries: DirEntry[] = [];
  for (const s of chain(u32(0x30), fat)) {
    const o = sectorAt(s);
    for (let k = 0; k < size / 128; k++) {
      const at = o + k * 128;
      if (at + 128 > data.length) break;
      const nameLen = Math.min(u16(at + 64), 64);
      entries.push({
        name: new TextDecoder("utf-16le").decode(data.subarray(at, at + Math.max(0, nameLen - 2))),
        type: data[at + 66],
        left: u32(at + 68),
        right: u32(at + 72),
        child: u32(at + 76),
        start: u32(at + 116),
        size: u32(at + 120),
      });
    }
  }
  const root = entries[0];
  if (!root || root.type !== 5) throw fail();
  if (root.size > data.length) throw fail();
  const miniStream = root.size > 0 ? readRegular(root.start, root.size) : new Uint8Array(0);
  const firstMini = u32(0x3c);
  const miniFat = firstMini === END || firstMini === NONE ? new Uint32Array(0) : readTable(chain(firstMini, fat));
  const readMini = (start: number, length: number): Uint8Array => {
    const out = new Uint8Array(length);
    let n = 0;
    for (const s of chain(start, miniFat)) {
      if (n >= length) break;
      const o = s * miniSize;
      if (o >= miniStream.length) throw fail();
      const piece = miniStream.subarray(o, o + Math.min(miniSize, length - n));
      out.set(piece, n);
      n += piece.length;
    }
    if (n < length) throw fail();
    return out;
  };

  const paths = new Map<string, DirEntry>();
  const visited = new Set<number>();
  const stack: Array<[number, string]> = [[root.child, ""]];
  while (stack.length) {
    const [i, prefix] = stack.pop() as [number, string];
    if (i === NONE) continue;
    if (i >= entries.length || visited.has(i)) throw fail();
    visited.add(i);
    const e = entries[i];
    stack.push([e.left, prefix], [e.right, prefix]);
    if (e.type !== 1 && e.type !== 2) continue;
    const path = prefix + e.name;
    paths.set(path, e);
    if (e.type === 1) stack.push([e.child, `${path}/`]);
  }

  return {
    has: (path) => paths.has(path),
    paths: () => [...paths.keys()],
    stream: (path) => {
      const e = paths.get(path);
      if (!e || e.type !== 2) return null;
      if (e.size === 0) return new Uint8Array(0);
      if (e.size > data.length) throw fail();
      return e.size < cutoff ? readMini(e.start, e.size) : readRegular(e.start, e.size);
    },
  };
}

/** Which format a compound file holds. Password-protected Office files are compound files too. */
export function oleFormat(cfb: Cfb): "doc" | "msg" {
  if (cfb.has("EncryptedPackage")) throw new ReadError("encrypted");
  if (cfb.has("WordDocument")) return "doc";
  if (cfb.has("__properties_version1.0")) return "msg";
  throw new ReadError("unsupported");
}
