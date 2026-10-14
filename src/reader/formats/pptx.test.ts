import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPptx } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readPptx } from "./pptx.ts";

const read = (bytes: Uint8Array) => readPptx(openZip(bytes));

describe("readPptx", () => {
  it("reads visible slides in order with their tables, and leaves out hidden slides and notes", async () => {
    const pptx = buildPptx([
      { texts: ["Anställningsavtal", "Anna Berg"], notes: "Ring Lisa Ek" },
      { texts: ["Lön"], table: [["Namn", "Lön"], ["Anna Berg", "42 000"]] },
      { texts: ["Hemlig Person"], hidden: true },
    ]);
    expect(await read(pptx)).toEqual({
      text: "Bild 1\nAnställningsavtal\nAnna Berg\n\nBild 2\nLön\nNamn\tLön\nAnna Berg\t42 000",
      hidden: true,
      slides: 2,
    });
  });

  it("reads a slide the deck lists many times only once", async () => {
    const pptx = buildPptx([{ texts: ["Anna Berg"] }], { order: Array.from({ length: 300 }, () => 1) });
    expect(await read(pptx)).toEqual({ text: "Bild 1\nAnna Berg", hidden: false, slides: 1 });
  });

  it("flags nothing in a plain deck", async () => {
    expect((await read(buildPptx([{ texts: ["Anna Berg"] }]))).hidden).toBe(false);
  });

  it("reads PowerPoint's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testPPT.pptx")));
    expect(text).toContain("Attachment Test");
    expect(text).toContain("Rajiv");
  });

  it("is reached through extract and counts slides", async () => {
    expect(await extract(buildPptx([{ texts: ["Anna Berg"] }]), "deck.pptx")).toMatchObject({ kind: "text", format: "pptx", stats: { slides: 1 } });
  });
});
