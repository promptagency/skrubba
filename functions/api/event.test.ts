import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./event.ts";

const forwarded = vi.fn();
beforeEach(() => {
  forwarded.mockReset();
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    forwarded(url, init);
    return Promise.resolve(new Response("ok", { status: 202 }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const PAGEVIEW = { n: "pageview", u: "https://skrubba.promptagency.se/", d: "skrubba.promptagency.se", r: null };

function post(body: unknown, headers: Record<string, string> = {}) {
  const request = new Request("https://skrubba.promptagency.se/api/event", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.7", "User-Agent": "Firefox/140", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return onRequestPost({ request });
}

describe("/api/event", () => {
  it("passes a page view on to Prompt Agency's Plausible with the visitor's IP and browser", async () => {
    const res = await post(PAGEVIEW);
    expect(res.status).toBe(202);
    expect(forwarded).toHaveBeenCalledTimes(1);
    const [url, init] = forwarded.mock.calls[0];
    expect(url).toBe("https://plausible.app.promptagency.se/api/event");
    const headers = new Headers(init.headers);
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.7");
    expect(headers.get("User-Agent")).toBe("Firefox/140");
    expect(JSON.parse(init.body)).toEqual(PAGEVIEW);
  });

  it("forwards only the four known fields, whatever else is sent", async () => {
    await post({ ...PAGEVIEW, text: "Johan Lindqvist 850412-1234", p: { x: 1 } });
    expect(JSON.parse(forwarded.mock.calls[0][1].body)).toEqual(PAGEVIEW);
  });

  it.each([
    ["another site", { ...PAGEVIEW, d: "example.com" }],
    ["an address on another site", { ...PAGEVIEW, u: "https://example.com/" }],
    ["another event than a page view", { ...PAGEVIEW, n: "signup" }],
    ["a referrer that is not a string", { ...PAGEVIEW, r: { a: 1 } }],
    ["no JSON", "Johan"],
    ["a body that is too long", { ...PAGEVIEW, u: `https://skrubba.promptagency.se/?utm_x=${"a".repeat(3000)}` }],
  ])("refuses %s and forwards nothing", async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(forwarded).not.toHaveBeenCalled();
  });

  it.each([["DNT", "1"], ["Sec-GPC", "1"]])("forwards nothing when the browser sends %s", async (header, value) => {
    expect((await post(PAGEVIEW, { [header]: value })).status).toBe(202);
    expect(forwarded).not.toHaveBeenCalled();
  });

  it("answers 202 even when Plausible is down, so the page never notices", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    expect((await post(PAGEVIEW)).status).toBe(202);
  });
});
