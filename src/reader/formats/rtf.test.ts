import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { readRtf } from "./rtf.ts";

const read = (rtf: string) => readRtf(latin1(rtf));

describe("readRtf", () => {
  it("reads paragraphs, hex bytes in the code page, and skips metadata and tables of fonts and colours", () => {
    const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}{\info{\author Erik Holm}{\title Avtal}}\pard Anst\'e4llningsavtal\par Mellan Norrstr\'f6m Media AB och Anna Berg.\par}`;
    expect(read(rtf)).toEqual({ text: "Anställningsavtal\nMellan Norrström Media AB och Anna Berg.", hidden: false, images: false });
  });

  it("reads Unicode escapes and skips their fallback characters", () => {
    // Not String.raw: the test transform cooks \u escapes even in raw templates.
    expect(read("{\\rtf1\\ansi Pris \\u8364? 100, \\uc0\\u229 r}").text).toBe("Pris € 100, år");
  });

  it("keeps a field's result, not its instruction", () => {
    expect(read(String.raw`{\rtf1{\field{\*\fldinst HYPERLINK "https://example.se"}{\fldrslt example.se}}}`).text).toBe("example.se");
  });

  it("leaves out pictures and says so", () => {
    const x = read(String.raw`{\rtf1 Logga:{\pict\pngblip 89504e47}\par Avtal\par}`);
    expect(x).toEqual({ text: "Logga:\nAvtal", hidden: false, images: true });
  });

  it("leaves out hidden text and annotations and says so", () => {
    expect(read(String.raw`{\rtf1 Kontakt Anna{\v Dold Uppgift}.{\*\annotation Fr\'e5ga Lisa Ek}\par}`)).toEqual({ text: "Kontakt Anna.", hidden: true, images: false });
  });

  it("reads a table row with cells by tab", () => {
    expect(read(String.raw`{\rtf1\trowd\cellx1000\cellx2000 Namn\cell Anna Berg\cell\row}`).text).toBe("Namn\tAnna Berg");
  });

  it("reads escaped braces and backslashes, and skips unknown starred groups", () => {
    expect(read(String.raw`{\rtf1 a\{b\}c\\d{\*\unknownthing Lisa}}`).text).toBe("a{b}c\\d");
  });

  it("ignores a control word that is a property every object has", () => {
    expect(read(String.raw`{\rtf1 Anna \constructor Berg}`).text).toBe("Anna Berg");
  });

  it("skips binary data", () => {
    // Four bytes of data ("}}}}"), then the picture group's own closing brace.
    expect(read(String.raw`{\rtf1 Anna{\pict\bin4 }}}}} Berg}`).text).toBe("Anna Berg");
  });

  it("is reached through extract, even named .doc", async () => {
    expect(await extract(latin1(String.raw`{\rtf1 Anna Berg}`), "brev.doc")).toMatchObject({ kind: "text", format: "rtf", text: "Anna Berg" });
  });
});
