import { describe, expect, it } from "vitest";
import { countBytes } from "./progress.ts";

describe("countBytes", () => {
  it("reports bytes read against the known total and keeps the body intact", async () => {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    const seen: number[] = [];
    const res = countBytes(new Response(body), 5, (loaded) => seen.push(loaded));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(body);
    expect(seen.at(-1)).toBe(5);
  });

  it("keeps status and headers", () => {
    const res = countBytes(new Response("x", { status: 200, headers: { "content-type": "a/b" } }), 1, () => {});
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("a/b");
  });

  it("passes a response without a body through", () => {
    const res = new Response(null, { status: 404 });
    expect(countBytes(res, 1, () => {})).toBe(res);
  });
});
