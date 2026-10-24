import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDoc, errorReason } from "../../../tests/fixtures/documents/build.ts";
import { openCfb } from "../cfb.ts";
import { extract } from "../extract.ts";
import { readDoc } from "./doc.ts";

const read = (bytes: Uint8Array) => readDoc(openCfb(bytes));

describe("readDoc", () => {
  it("reads the main text and footnotes, keeps field results, and leaves comments out", () => {
    const doc = buildDoc({
      main: 'Anna Berg \x13 HYPERLINK "https://example.se" \x14example.se\x15 bor i Umeå.\r',
      footnotes: "Enligt Erik Holm.\r",
      comments: "Ring Lisa Ek\r",
    });
    expect(read(doc)).toEqual({ text: "Anna Berg example.se bor i Umeå.\n\nEnligt Erik Holm.", hidden: true });
  });

  it("reads 8-bit text pieces", () => {
    expect(read(buildDoc({ main: "Räksmörgås\r", compressed: true }))).toEqual({ text: "Räksmörgås", hidden: false });
  });

  it("turns cell marks into tabs", () => {
    expect(read(buildDoc({ main: "Namn\x07Anna Berg\x07\x07" })).text).toBe("Namn\tAnna Berg");
  });

  it("gives up on a piece table whose pieces repeat past the text cap, before building the text", async () => {
    // 1 001 pieces of 2 000 characters each: just over the 2 000 000 cap, from a 4 KB file.
    const doc = buildDoc({ main: `${"Anna Berg bor i Umeå. ".repeat(100)}\r`.padEnd(2000, "x"), pieces: 1001 });
    expect(await errorReason(() => read(doc))).toBe("tooLarge");
    expect(read(buildDoc({ main: "Anna Berg\r", pieces: 3 })).text).toBe("Anna Berg"); // the stories' lengths, not the pieces, say what is text
  });

  it("says a password-protected file is protected, and refuses Word 6 and 95", async () => {
    expect(await errorReason(() => read(buildDoc({ main: "x\r", encrypted: true })))).toBe("encrypted");
    expect(await errorReason(() => read(buildDoc({ main: "x\r", nFib: 0x0065 })))).toBe("unsupported");
  });

  it("reads Word's own file without field instructions", () => {
    const { text } = read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testWORD.doc")));
    expect(text).toContain("This is a sample Microsoft Word Document.");
    expect(text).toContain("Nested table");
    expect(text).toContain("http://tika.apache.org/");
    expect(text).not.toContain("HYPERLINK");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildDoc({ main: "Anna Berg\r" }), "avtal.doc")).toMatchObject({ kind: "text", format: "doc", text: "Anna Berg" });
  });
});
