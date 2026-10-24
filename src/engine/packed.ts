// Files too big for one static file are served gzipped in parts
// (`<file>.gzpart0`, `.gzpart1`, …). See scripts/pack.ts.

export interface PackedInfo {
  parts: number;
  packedBytes: number;
  rawBytes: number;
  sha256: string; // of the unpacked file
}

/** URL path of the unpacked file → how it is packed. Served as /packed.json. */
export type PackedManifest = Record<string, PackedInfo>;

export const partUrl = (path: string, i: number) => `${path}.gzpart${i}`;

/** SHA-256 of the bytes, as lowercase hex. */
export async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The response with its body intact, and the hash of that body once it has
 * been read: one read serves both, so a checksum needs no second download.
 */
export function hashed(res: Response): { res: Response; hash: Promise<string> } {
  const [body, copy] = (res.body ?? new Response("").body!).tee();
  return { res: new Response(body), hash: new Response(copy).arrayBuffer().then(sha256) };
}

/**
 * Fetch the parts in order, join and gunzip them. `onBytes` gets the running
 * count of compressed bytes, which is what the download costs.
 */
export function unpack(
  fetchPart: (i: number) => Promise<Response>,
  parts: number,
  onBytes: (packedLoaded: number) => void = () => {},
): Response {
  let i = 0;
  let loaded = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | null = null;
  const joined = new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      while (true) {
        if (!reader) {
          if (i === parts) return controller.close();
          const res = await fetchPart(i++);
          if (!res.ok || !res.body) throw new Error(`part ${i - 1}: ${res.status}`);
          reader = res.body.getReader() as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;
        }
        const { done, value } = await reader.read();
        if (done) {
          reader = null;
          continue;
        }
        loaded += value.byteLength;
        onBytes(loaded);
        controller.enqueue(value);
        return;
      }
    },
  });
  return new Response(joined.pipeThrough(new DecompressionStream("gzip")));
}
