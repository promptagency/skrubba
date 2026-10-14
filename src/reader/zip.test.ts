import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildZip, errorReason } from "../../tests/fixtures/documents/build.ts";
import { openZip, zipFormat } from "./zip.ts";

describe("openZip", () => {
  it.each([false, true])("reads entries (stored: %s)", async (store) => {
    const zip = openZip(buildZip({ "a.txt": "Åsa", "dir/b.xml": "<b/>" }, { store }));
    expect(await zip.text("a.txt")).toBe("Åsa");
    expect(await zip.text("dir/b.xml")).toBe("<b/>");
    expect(await zip.text("nej.txt")).toBeNull();
    expect(zip.has("a.txt")).toBe(true);
    expect(zip.names()).toEqual(["a.txt", "dir/b.xml"]);
  });

  it("refuses an encrypted entry", async () => {
    const zip = openZip(buildZip({ "a.txt": "Åsa" }, { encrypted: ["a.txt"] }));
    expect(await errorReason(() => zip.bytes("a.txt"))).toBe("encrypted");
  });

  it("refuses an entry over 50 MB", async () => {
    const zip = openZip(buildZip({ "bomb.xml": new Uint8Array(60 * 1024 * 1024) }));
    expect(await errorReason(() => zip.bytes("bomb.xml"))).toBe("failed");
  });

  it("refuses an entry that compresses more than 200 to 1", async () => {
    const zip = openZip(buildZip({ "bomb.xml": new Uint8Array(10 * 1024 * 1024) }));
    expect(await errorReason(() => zip.bytes("bomb.xml"))).toBe("failed");
  });

  it("refuses an entry that inflates past its declared size", async () => {
    const zip = openZip(buildZip({ "a.txt": "Åsa Berg bor i Umeå" }, { declaredSize: { "a.txt": 12 } }));
    expect(await errorReason(() => zip.bytes("a.txt"))).toBe("failed");
  });

  it("refuses more than 100 MB in total", async () => {
    const big = 40 * 1024 * 1024;
    const bytes = buildZip({ a: "x", b: "x", c: "x" }, { store: true, declaredSize: { a: big, b: big, c: big } });
    expect(await errorReason(() => openZip(bytes))).toBe("failed");
  });

  it("counts what is inflated across reads, so reading one entry again and again still hits the 100 MB total", async () => {
    const chunk = new Uint8Array(randomBytes(2 * 1024 * 1024));
    const zip = openZip(buildZip({ "s.xml": chunk }, { store: true }));
    expect(await errorReason(async () => {
      for (let i = 0; i < 60; i++) await zip.bytes("s.xml");
    })).toBe("failed");
  });

  it("refuses more than 2 000 entries", async () => {
    const files = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`f${i}.txt`, "x"]));
    expect(await errorReason(() => openZip(buildZip(files, { store: true })))).toBe("failed");
  });

  it("refuses bytes that are not a zip", async () => {
    expect(await errorReason(() => openZip(new Uint8Array(100)))).toBe("failed");
    expect(await errorReason(() => openZip(new Uint8Array(3)))).toBe("failed");
  });
});

describe("zipFormat", () => {
  it.each([
    [{ "word/document.xml": "<w/>" }, "docx"],
    [{ "ppt/presentation.xml": "<p/>" }, "pptx"],
    [{ "xl/workbook.xml": "<x/>" }, "xlsx"],
    [{ mimetype: "application/vnd.oasis.opendocument.text", "content.xml": "<c/>" }, "odt"],
    [{ mimetype: "application/vnd.oasis.opendocument.spreadsheet", "content.xml": "<c/>" }, null],
    [{ "readme.txt": "hej" }, null],
  ])("tells %j is %s", async (files, format) => {
    expect(await zipFormat(openZip(buildZip(files)))).toBe(format);
  });
});
