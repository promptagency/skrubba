import { describe, expect, it } from "vitest";
import { latin1 } from "../../tests/fixtures/documents/build.ts";
import { extract } from "./extract.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("extract", () => {
  it("reads a text file and counts its words", async () => {
    expect(await extract(utf8("Hej Anna\r\n"), "brev.txt")).toEqual({
      kind: "text",
      text: "Hej Anna",
      format: "txt",
      stats: { words: 2 },
      notes: [],
    });
  });

  it("reads a windows-1252 CSV with å, ä and ö", async () => {
    const result = await extract(latin1("Namn;Ort\r\nÅsa Öberg;Umeå\r\n"), "lista.csv");
    expect(result).toMatchObject({ kind: "text", text: "Namn;Ort\nÅsa Öberg;Umeå", format: "csv" });
  });

  it("tidies line ends, trailing spaces and runs of blank lines", async () => {
    const result = await extract(utf8("Rad ett  \n\n\n\nRad två\t\n"), "brev.md");
    expect(result).toMatchObject({ text: "Rad ett\n\nRad två", format: "md" });
  });

  it("says a file with only whitespace is empty", async () => {
    expect(await extract(utf8(" \n\t\n"), "tom.txt")).toEqual({ kind: "error", reason: "empty" });
  });

  it("refuses a text that is too long", async () => {
    expect(await extract(utf8("a ".repeat(1_000_001)), "lang.txt")).toEqual({ kind: "error", reason: "tooLarge" });
  });

  it("refuses a file it does not know", async () => {
    expect(await extract(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "bild.png")).toEqual({ kind: "error", reason: "unsupported" });
  });

  it("refuses a text file named like a Word file", async () => {
    expect(await extract(utf8("hej"), "avtal.docx")).toEqual({ kind: "error", reason: "unsupported" });
  });
});
