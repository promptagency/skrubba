import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOdt, SAMPLE, SAMPLE_TEXT, tp } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readOdt } from "./odt.ts";

const read = (bytes: Uint8Array) => readOdt(openZip(bytes));

describe("readOdt", () => {
  it("reads headings and paragraphs, ignoring the XML's own line breaks", async () => {
    const body = `\n  <text:h text:outline-level="1">${SAMPLE.title}</text:h>\n  ${SAMPLE.lines.map(tp).join("\n  ")}\n`;
    expect(await read(buildOdt(body))).toEqual({ text: SAMPLE_TEXT, hidden: false });
  });

  it("keeps spaces, tabs and line breaks written as elements", async () => {
    const body = '<text:p>Anna<text:s text:c="3"/>Berg<text:tab/>Umeå<text:line-break/>Sverige</text:p>';
    expect((await read(buildOdt(body))).text).toBe("Anna   Berg\tUmeå\nSverige");
  });

  it("reads a table one row per line, cells by tab", async () => {
    const cell = (s: string) => `<table:table-cell>${tp(s)}</table:table-cell>`;
    const body = `<table:table><table:table-row>${cell("Namn")}${cell("Anna Berg")}</table:table-row><table:table-row>${cell("Ort")}${cell("Umeå")}</table:table-row></table:table>`;
    expect((await read(buildOdt(body))).text).toBe("Namn\tAnna Berg\nOrt\tUmeå");
  });

  it("puts footnotes after the body and the page header and footer before them", async () => {
    const body = `<text:p>Avtalet<text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body>${tp("Enligt Erik Holm.")}</text:note-body></text:note> gäller.</text:p>`;
    const odt = buildOdt(body, { header: tp("Konfidentiellt"), footer: tp("Sida 1") });
    expect((await read(odt)).text).toBe("Avtalet gäller.\n\nKonfidentiellt\n\nSida 1\n\nEnligt Erik Holm.");
  });

  it("leaves out comments and tracked deletions and says so", async () => {
    const body =
      '<text:tracked-changes><text:changed-region text:id="c1"><text:deletion><office:change-info><dc:creator>Erik</dc:creator></office:change-info>' +
      `${tp("Raderad Person")}</text:deletion></text:changed-region></text:tracked-changes>` +
      `<text:p>Kontakt Anna<office:annotation><dc:creator>Erik</dc:creator>${tp("Fråga Lisa Ek")}</office:annotation></text:p>`;
    expect(await read(buildOdt(body))).toEqual({ text: "Kontakt Anna", hidden: true });
  });

  it("reads NeoOffice's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testOpenOffice2.odt")));
    expect(text).toContain("This is a sample Open Office document");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildOdt(tp("Anna Berg")), "avtal.odt")).toMatchObject({ kind: "text", format: "odt", text: "Anna Berg" });
  });
});
