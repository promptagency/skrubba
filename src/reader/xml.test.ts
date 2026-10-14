import { describe, expect, it } from "vitest";
import { decodeEntities, xmlEvents } from "./xml.ts";

describe("xmlEvents", () => {
  it("yields opens, closes and decoded text, and skips declarations and comments", () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE x><a x="1 &amp; 2"><b/>t&lt;x&#229;&#xE4;<!-- Lisa --><![CDATA[<rå>]]></a>';
    expect([...xmlEvents(xml)]).toEqual([
      { type: "open", name: "a", attrs: { x: "1 & 2" }, selfClosing: false },
      { type: "open", name: "b", attrs: {}, selfClosing: true },
      { type: "close", name: "b" },
      { type: "text", text: "t<xåä" },
      { type: "text", text: "<rå>" },
      { type: "close", name: "a" },
    ]);
  });

  it("reads single-quoted attributes and a > inside quotes", () => {
    expect([...xmlEvents("<w:t a='x>y' b = \"z\">")]).toEqual([{ type: "open", name: "w:t", attrs: { a: "x>y", b: "z" }, selfClosing: false }]);
  });

  it("survives a truncated document", () => {
    expect([...xmlEvents("<a>text<b")].map((e) => e.type)).toEqual(["open", "text", "open"]);
  });
});

describe("decodeEntities", () => {
  it("leaves an unknown or broken entity as it is", () => {
    expect(decodeEntities("&nbsp; &#99999999; &amp")).toBe("&nbsp; &#99999999; &amp");
  });
});
