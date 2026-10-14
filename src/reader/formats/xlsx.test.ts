import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readXlsx, sharedStrings } from "./xlsx.ts";

const read = (bytes: Uint8Array) => readXlsx(openZip(bytes));

describe("readXlsx", () => {
  it("reads visible sheets under their names, values not formulas, and leaves hidden sheets out", async () => {
    const xlsx = buildXlsx([
      { name: "Personal", rows: [["Namn", "Personnummer"], ["Anna Berg", "19850312-4471"]] },
      { name: "Löner", rows: [["Anna Berg", 42000, { f: "B1*2", v: 84000 }]] },
      { name: "Hemligt", state: "hidden", rows: [["Hemlig Person"]] },
    ]);
    expect(await read(xlsx)).toEqual({
      text: "Blad: Personal\nNamn\tPersonnummer\nAnna Berg\t19850312-4471\n\nBlad: Löner\nAnna Berg\t42000\t84000",
      hidden: true,
      sheets: 2,
    });
  });

  it("keeps empty cells as empty columns, skips empty rows, and reads inline strings", async () => {
    const xlsx = buildXlsx([{ name: "Lista", rows: [["Anna", null, "Umeå"], [], [{ inline: "Lisa Ek" }]] }]);
    expect(await read(xlsx)).toEqual({ text: "Blad: Lista\nAnna\t\tUmeå\nLisa Ek", hidden: false, sheets: 1 });
  });

  it("reads a sheet the workbook lists many times only once", async () => {
    const xlsx = buildXlsx([{ name: "Lista", rows: [["Anna Berg"]] }], { order: Array.from({ length: 300 }, () => 1) });
    expect(await read(xlsx)).toEqual({ text: "Blad: Blad1\nAnna Berg", hidden: false, sheets: 1 });
  });

  it("reads a workbook whose elements carry a namespace prefix", async () => {
    const xlsx = buildXlsx([{ name: "Personal", rows: [["Namn", "Anna Berg"]] }], { prefix: "x" });
    expect((await read(xlsx)).text).toBe("Blad: Personal\nNamn\tAnna Berg");
  });

  it("says a cell comment was left out", async () => {
    expect((await read(buildXlsx([{ name: "Lista", rows: [["Anna"]] }], { comment: "Ring Lisa Ek" }))).hidden).toBe(true);
  });

  it("reads Excel's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testEXCEL.xlsx")));
    expect(text).toContain("Sample Excel Worksheet - Numbers and their Squares");
    expect(text).toMatch(/^Blad: /m);
  });

  it("is reached through extract and counts sheets", async () => {
    expect(await extract(buildXlsx([{ name: "Lista", rows: [["Anna Berg"]] }]), "lista.xlsx")).toMatchObject({
      kind: "text",
      format: "xlsx",
      stats: { sheets: 1 },
    });
  });
});

describe("sharedStrings", () => {
  it("joins rich text runs and skips phonetic readings", () => {
    const xml = '<sst><si><r><t>Anna </t></r><r><t>Berg</t></r></si><si><t>Ek</t><rPh sb="0" eb="1"><t>エク</t></rPh><phoneticPr fontId="1"/></si></sst>';
    expect(sharedStrings(xml)).toEqual(["Anna Berg", "Ek"]);
  });
});
