import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocx, buildZip, errorReason, SAMPLE, SAMPLE_TEXT, wp } from "../../../tests/fixtures/documents/build.ts";
import { openZip } from "../zip.ts";
import { readDocx } from "./docx.ts";

const read = (bytes: Uint8Array) => readDocx(openZip(bytes));

describe("readDocx", () => {
  it("reads paragraphs in order and flags nothing in a plain document", async () => {
    const body = [SAMPLE.title, ...SAMPLE.lines].map(wp).join("");
    expect(await read(buildDocx({ body }))).toEqual({ text: SAMPLE_TEXT, hidden: false });
  });

  it("reads a table one row per line, cells by tab", async () => {
    const cell = (...ps: string[]) => `<w:tc>${ps.map(wp).join("")}</w:tc>`;
    const body = `<w:tbl><w:tr>${cell("Namn")}${cell("Anna Berg")}</w:tr><w:tr>${cell("Ort")}${cell("Umeå", "Västerbotten")}</w:tr></w:tbl>`;
    expect((await read(buildDocx({ body }))).text).toBe("Namn\tAnna Berg\nOrt\tUmeå Västerbotten");
  });

  it("keeps tabs and line breaks inside a run", async () => {
    const body = "<w:p><w:r><w:t>Anna</w:t><w:tab/><w:t>Berg</w:t><w:br/><w:t>Umeå</w:t></w:r></w:p>";
    expect((await read(buildDocx({ body }))).text).toBe("Anna\tBerg\nUmeå");
  });

  it("adds headers, footers and footnotes after the body, each text once", async () => {
    const docx = buildDocx({
      body: wp("Avtal"),
      headers: [wp("Norrström Media AB, konfidentiellt"), wp("Norrström Media AB, konfidentiellt")],
      footers: [wp("Sida 1")],
      footnotes: `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="1">${wp("Enligt Erik Holm på HR.")}</w:footnote>`,
    });
    expect((await read(docx)).text).toBe("Avtal\n\nNorrström Media AB, konfidentiellt\n\nSida 1\n\nEnligt Erik Holm på HR.");
  });

  it("leaves out deleted, hidden and commented text and says so", async () => {
    const body =
      '<w:p><w:r><w:t xml:space="preserve">Kontakt </w:t></w:r><w:del w:id="1" w:author="x"><w:r><w:delText>Raderad Person</w:delText></w:r></w:del>' +
      '<w:ins w:id="2" w:author="x"><w:r><w:t>Anna Berg</w:t></w:r></w:ins></w:p>' +
      "<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Dold Uppgift</w:t></w:r></w:p>";
    const comments = `<w:comment w:id="0" w:author="Erik">${wp("Fråga Lisa Ek")}</w:comment>`;
    expect(await read(buildDocx({ body, comments }))).toEqual({ text: "Kontakt Anna Berg", hidden: true });
  });

  it("keeps text whose vanish is switched off", async () => {
    const body = '<w:p><w:r><w:rPr><w:vanish w:val="0"/></w:rPr><w:t>Anna Berg</w:t></w:r></w:p>';
    expect(await read(buildDocx({ body }))).toEqual({ text: "Anna Berg", hidden: false });
  });

  it("keeps a field's result, not its instruction", async () => {
    const body =
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.se" </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>example.se</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    expect((await read(buildDocx({ body }))).text).toBe("example.se");
  });

  it("reads a text box once, not its fallback copy", async () => {
    const box = `<w:txbxContent>${wp("Lisa Ek")}</w:txbxContent>`;
    const body = `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx>${box}</wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox>${box}</v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`;
    const { text } = await read(buildDocx({ body }));
    expect(text.match(/Lisa Ek/g)).toHaveLength(1);
  });

  it("reads Word's own file, header and footer included", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testWORD.docx")));
    expect(text).toContain("This is a sample Microsoft Word Document.");
    expect(text).toContain("This is the header for our document");
    expect(text).toContain("This is the footer for our document");
    expect(text).toContain("Nested table");
  });

  it("fails without a document part", async () => {
    expect(await errorReason(() => read(buildZip({ "word/other.xml": "<x/>" })))).toBe("failed");
  });
});
