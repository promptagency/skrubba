/**
 * Wrap a response so reading its body reports bytes read so far. `total` is
 * the known file size: servers may compress and omit content-length.
 */
export function countBytes(res: Response, total: number, onBytes: (loaded: number, total: number) => void): Response {
  if (!res.body) return res;
  let loaded = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      onBytes(Math.min(loaded, total), total);
      controller.enqueue(chunk);
    },
  });
  return new Response(res.body.pipeThrough(counter), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
