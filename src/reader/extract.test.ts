import { describe, expect, it } from "vitest";
import { buildDocx, buildOdt, buildPptx, buildXlsx, buildZip, latin1, SAMPLE, tp, wp } from "../../tests/fixtures/documents/build.ts";
import { extract } from "./extract.ts";
import { openZip } from "./zip.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

/** A zip's files, to build a copy with more in it. */
async function unzipped(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const zip = openZip(data);
  return Object.fromEntries(await Promise.all(zip.names().map(async (n) => [n, (await zip.bytes(n))!] as const)));
}

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

  it("tidies a line with a hundred thousand trailing spaces in one pass", async () => {
    const started = performance.now();
    const result = await extract(utf8(`Rad ett${" ".repeat(100_000)}\nRad två`), "brev.md");
    expect(result).toMatchObject({ text: "Rad ett\nRad två" });
    expect(performance.now() - started).toBeLessThan(1000); // quadratic took over 20 s
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

  it("reads a Word file, even one named .pdf", async () => {
    const docx = buildDocx({ body: [SAMPLE.title, ...SAMPLE.lines].map(wp).join("") });
    expect(await extract(docx, "avtal.docx")).toMatchObject({ kind: "text", format: "docx", notes: [] });
    expect(await extract(docx, "avtal.pdf")).toMatchObject({ kind: "text", format: "docx" });
  });

  it("says when a picture in a Word file's text is left out, but not for a logo in the header", async () => {
    const picture = '<w:p><w:r><w:drawing><a:graphic><a:graphicData><pic:pic><pic:blipFill/></pic:pic></a:graphicData></a:graphic></w:drawing></w:r></w:p>';
    const media = { "word/media/image1.png": new Uint8Array([0x89, 0x50]) };
    const inBody = buildZip({ ...(await unzipped(buildDocx({ body: wp(SAMPLE.title) + picture }))), ...media });
    expect(await extract(inBody, "avtal.docx")).toMatchObject({ kind: "text", format: "docx", notes: ["imagesLeftOut"] });
    const inHeader = buildZip({ ...(await unzipped(buildDocx({ body: wp(SAMPLE.title), headers: [picture] }))), ...media });
    expect(await extract(inHeader, "avtal.docx")).toMatchObject({ kind: "text", format: "docx", notes: [] });
  });

  it("says when a slide has a picture, but not for one in the slide layout", async () => {
    const files = await unzipped(buildPptx([{ texts: ["Anna Berg"] }]));
    const pic = new TextEncoder().encode("<p:pic><p:blipFill/></p:pic>");
    const layout = { "ppt/slideLayouts/slideLayout1.xml": pic };
    expect(await extract(buildZip({ ...files, ...layout }), "bilder.pptx")).toMatchObject({ kind: "text", notes: [] });
    const slide = new TextDecoder().decode(files["ppt/slides/slide1.xml"]).replace("</p:spTree>", "<p:pic><p:blipFill/></p:pic></p:spTree>");
    const withPicture = buildZip({ ...files, "ppt/slides/slide1.xml": slide });
    expect(await extract(withPicture, "bilder.pptx")).toMatchObject({ kind: "text", notes: ["imagesLeftOut"] });
  });

  it("says when a sheet has a picture in its drawing, and when an OpenDocument body has one, but not its header", async () => {
    const sheet = await unzipped(buildXlsx([{ name: "Blad1", rows: [["Anna Berg"]] }]));
    expect(await extract(buildZip(sheet), "lista.xlsx")).toMatchObject({ kind: "text", notes: [] });
    const drawing = { "xl/drawings/drawing1.xml": new TextEncoder().encode("<xdr:wsDr><xdr:pic><xdr:blipFill/></xdr:pic></xdr:wsDr>") };
    expect(await extract(buildZip({ ...sheet, ...drawing }), "lista.xlsx")).toMatchObject({ kind: "text", notes: ["imagesLeftOut"] });
    const image = '<draw:frame><draw:image xlink:href="Pictures/1.png"/></draw:frame>';
    expect(await extract(buildOdt(tp("Anna Berg") + image), "avtal.odt")).toMatchObject({ kind: "text", notes: ["imagesLeftOut"] });
    expect(await extract(buildOdt(tp("Anna Berg"), { header: image }), "avtal.odt")).toMatchObject({ kind: "text", notes: [] });
  });

  it("refuses a zip that is no office file", async () => {
    expect(await extract(buildZip({ "bild.png": "x" }), "arkiv.zip")).toEqual({ kind: "error", reason: "unsupported" });
  });

  it("says a Word file with no text is empty", async () => {
    expect(await extract(buildDocx({ body: "<w:p/>" }), "tom.docx")).toEqual({ kind: "error", reason: "empty" });
  });
});
