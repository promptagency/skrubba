import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countVisit } from "./analytics.ts";

const sent = vi.fn();

function visit(href: string, nav: Record<string, unknown> = {}, referrer = "") {
  vi.stubGlobal("location", new URL(href));
  vi.stubGlobal("navigator", { webdriver: false, doNotTrack: null, ...nav });
  vi.stubGlobal("document", { referrer });
  countVisit();
}

beforeEach(() => {
  sent.mockReset();
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    sent(url, init);
    return Promise.resolve(new Response(null, { status: 202 }));
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("countVisit", () => {
  it("sends one page view to Skrubba's own address, never to another", () => {
    visit("https://skrubba.promptagency.se/");
    expect(sent).toHaveBeenCalledTimes(1);
    const [url, init] = sent.mock.calls[0];
    expect(url).toBe("/api/event");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      n: "pageview",
      u: "https://skrubba.promptagency.se/",
      d: "skrubba.promptagency.se",
      r: null,
    });
  });

  it("keeps only utm_* from the address, and only origin and path of the referrer", () => {
    visit("https://skrubba.promptagency.se/?utm_source=linkedin&q=secret", {}, "https://www.google.com/search?q=x");
    const body = JSON.parse(sent.mock.calls[0][1].body);
    expect(body.u).toBe("https://skrubba.promptagency.se/?utm_source=linkedin");
    expect(body.r).toBe("https://www.google.com/search");
  });

  it.each([
    ["another host", "https://skrubba.pages.dev/", {}],
    ["localhost", "http://localhost:4173/", {}],
    ["Do Not Track", "https://skrubba.promptagency.se/", { doNotTrack: "1" }],
    ["Global Privacy Control", "https://skrubba.promptagency.se/", { globalPrivacyControl: true }],
    ["an automated browser", "https://skrubba.promptagency.se/", { webdriver: true }],
  ])("counts nothing on %s", (_, href, nav) => {
    visit(href, nav);
    expect(sent).not.toHaveBeenCalled();
  });
});
