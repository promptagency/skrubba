import { describe, expect, it } from "vitest";
import { fetchWithRetry } from "./retryFetch.ts";

function scripted(...answers: Array<number | Error | [number, Record<string, string>]>) {
  const calls: string[] = [];
  const fetchFn = async (url: string) => {
    calls.push(url);
    const a = answers.shift();
    if (a instanceof Error) throw a;
    const [status, headers] = Array.isArray(a) ? a : [a ?? 200, {}];
    return new Response(status === 200 ? "model" : null, { status, headers });
  };
  return { calls, fetchFn };
}

const noSleep = () => {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
};

describe("fetchWithRetry", () => {
  it("returns the first good answer without waiting", async () => {
    const { calls, fetchFn } = scripted(200);
    const { waits, sleep } = noSleep();
    const res = await fetchWithRetry("https://hf/x", { fetchFn, sleep });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("waits and tries again on 429, a server error and a network error, with growing pauses", async () => {
    const { calls, fetchFn } = scripted(429, 503, new Error("ECONNRESET"), 200);
    const { waits, sleep } = noSleep();
    const res = await fetchWithRetry("https://hf/x", { fetchFn, sleep, baseDelayMs: 1000 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  it("follows Retry-After in seconds, up to a minute", async () => {
    const { fetchFn } = scripted([429, { "Retry-After": "7" }], [429, { "Retry-After": "600" }], 200);
    const { waits, sleep } = noSleep();
    await fetchWithRetry("https://hf/x", { fetchFn, sleep, baseDelayMs: 1000 });
    expect(waits).toEqual([7000, 60_000]);
  });

  it("does not retry an answer that will not change, such as 404", async () => {
    const { calls, fetchFn } = scripted(404);
    const res = await fetchWithRetry("https://hf/x", { fetchFn, sleep: noSleep().sleep });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("gives up after the last attempt and returns that answer", async () => {
    const { calls, fetchFn } = scripted(429, 429, 429);
    const res = await fetchWithRetry("https://hf/x", { fetchFn, sleep: noSleep().sleep, attempts: 3 });
    expect(res.status).toBe(429);
    expect(calls).toHaveLength(3);
  });

  it("rethrows a network error on the last attempt", async () => {
    const { fetchFn } = scripted(new Error("down"), new Error("down"));
    await expect(fetchWithRetry("https://hf/x", { fetchFn, sleep: noSleep().sleep, attempts: 2 })).rejects.toThrow("down");
  });
});
