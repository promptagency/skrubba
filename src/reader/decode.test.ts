import { describe, expect, it } from "vitest";
import { latin1 } from "../../tests/fixtures/documents/build.ts";
import { binaryString, decodeText, labelForCodepage } from "./decode.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("decodeText", () => {
  it("reads UTF-8", () => {
    expect(decodeText(utf8("Åsa på Öland"))).toBe("Åsa på Öland");
  });

  it("drops a UTF-8 byte order mark", () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe("A");
  });

  it("reads UTF-16 with a byte order mark", () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0xe5, 0x00, 0x41, 0x00]))).toBe("åA");
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0xe5, 0x00, 0x41]))).toBe("åA");
  });

  it("falls back to windows-1252 when the bytes are not UTF-8", () => {
    expect(decodeText(latin1("Åsa på Öland"))).toBe("Åsa på Öland");
  });

  it("uses a declared charset", () => {
    expect(decodeText(latin1("på"), "ISO-8859-1")).toBe("på");
  });

  it("ignores a declared charset it does not know", () => {
    expect(decodeText(utf8("på"), "x-nonsense")).toBe("på");
  });

  it("still checks bytes declared as UTF-8", () => {
    expect(decodeText(latin1("på"), "utf-8")).toBe("på");
  });
});

describe("labelForCodepage", () => {
  it.each([
    [65001, "utf-8"],
    [1252, "windows-1252"],
    [28591, "iso-8859-1"],
    [1200, "utf-16le"],
    [4711, "windows-1252"],
  ])("maps %i to %s", (cp, label) => {
    expect(labelForCodepage(cp)).toBe(label);
  });
});

describe("binaryString", () => {
  it("maps each byte to one character", () => {
    expect(binaryString(new Uint8Array([0x41, 0xe5, 0x00, 0xff]))).toBe("Aå\u0000ÿ");
  });

  it("handles more bytes than one call can spread", () => {
    expect(binaryString(new Uint8Array(200_000).fill(0x61))).toHaveLength(200_000);
  });
});
