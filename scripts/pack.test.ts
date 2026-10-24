import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashed, sha256, unpack } from "../src/engine/packed.ts";
import { pack } from "./pack.ts";

const serve = (parts: Buffer[]) => (i: number) => Promise.resolve(new Response(parts[i]));

describe("pack and unpack", () => {
  it("round-trips bytes through gzip parts no larger than the limit", async () => {
    const raw = Buffer.concat([randomBytes(50_000), Buffer.alloc(50_000, 7)]);
    const packed = pack(raw, 10_000);
    expect(packed.parts.length).toBeGreaterThan(1);
    expect(packed.parts.every((p) => p.length <= 10_000)).toBe(true);
    expect(packed.info.parts).toBe(packed.parts.length);
    expect(packed.info.rawBytes).toBe(raw.length);
    expect(packed.info.packedBytes).toBe(packed.parts.reduce((n, p) => n + p.length, 0));

    const res = unpack(serve(packed.parts), packed.info.parts);
    expect(Buffer.from(await res.arrayBuffer()).equals(raw)).toBe(true);
  });

  it("makes one part when the compressed file fits", () => {
    expect(pack(Buffer.alloc(100_000), 10_000).parts).toHaveLength(1);
  });

  it("reports compressed bytes as they arrive", async () => {
    const packed = pack(randomBytes(30_000), 8_000);
    let last = 0;
    const res = unpack(serve(packed.parts), packed.info.parts, (n) => {
      last = n;
    });
    await res.arrayBuffer();
    expect(last).toBe(packed.info.packedBytes);
  });

  it("hashes the unpacked bytes while they are read, so the checksum needs no second read", async () => {
    const raw = randomBytes(30_000);
    const packed = pack(raw, 8_000);
    const { res, hash } = hashed(unpack(serve(packed.parts), packed.info.parts));
    expect(Buffer.from(await res.arrayBuffer()).equals(raw)).toBe(true);
    expect(await hash).toBe(await sha256(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)));
    expect(await hash).toBe(packed.info.sha256);
  });

  it("fails when a part is missing", async () => {
    const packed = pack(randomBytes(30_000), 8_000);
    const missing = (i: number) => Promise.resolve(i === 1 ? new Response(null, { status: 404 }) : new Response(packed.parts[i]));
    await expect(unpack(missing, packed.info.parts).arrayBuffer()).rejects.toThrow();
  });
});
