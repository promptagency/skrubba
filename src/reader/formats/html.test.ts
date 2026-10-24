import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { htmlToText, readHtml } from "./html.ts";

describe("htmlToText", () => {
  it("keeps visible text by block, drops head, scripts, styles, comments and hidden elements, and says so", () => {
    const html =
      '<html><head><title>Avtal</title><style>p{}</style><script>var a="Erik"; if (a<b) {}</script></head><body>' +
      "<h1>Anställningsavtal</h1><p>Mellan Norrström Media AB och <b>Anna Berg</b>,<br>personnummer 19850312-4471.</p>" +
      "<div hidden>Dold Uppgift</div><table><tr><td>Namn<td>Anna Berg</tr></table><!-- Lisa --></body></html>";
    expect(htmlToText(html)).toEqual({
      text: "Anställningsavtal\n\nMellan Norrström Media AB och Anna Berg,\npersonnummer 19850312-4471.\n\nNamn\tAnna Berg",
      hidden: true,
    });
  });

  it("drops the doctype, XML declarations and Word's conditional markup", () => {
    const html = '<?xml version="1.0"?><!DOCTYPE html><html><body><p><![if !supportLists]>1.<![endif]> Anna Berg</p></body></html>';
    expect(htmlToText(html).text).toBe("1. Anna Berg");
  });

  it("collapses source whitespace and decodes entities", () => {
    expect(htmlToText("<p>\n  R&auml;ksm&ouml;rg&aring;s&nbsp;&amp;&#229;&#xE5;\n</p>").text).toBe("Räksmörgås &åå");
  });

  it("keeps whitespace inside pre", () => {
    expect(htmlToText("<pre>Anna\tBerg\nUmeå</pre>").text).toBe("Anna\tBerg\nUmeå");
  });

  it("closes unclosed cells and rows", () => {
    expect(htmlToText("<table><tr><td>Namn<td>Anna<tr><td>Ort<td>Umeå</table>").text).toBe("Namn\tAnna\nOrt\tUmeå");
  });

  it("does not take data-hidden or an input's type for hidden", () => {
    expect(htmlToText('<p data-hidden="1">Anna</p><input type="hidden" value="x"><p>Berg</p>')).toEqual({ text: "Anna\n\nBerg", hidden: false });
  });
});

describe("readHtml", () => {
  it("leaves an entity named like a property every object has", () => {
    expect(htmlToText("<p>a &constructor; &amp; b</p>").text).toBe("a &constructor; & b");
  });

  it("uses the charset in a meta tag", () => {
    expect(readHtml(latin1('<meta charset="iso-8859-1"><p>Räksmörgås</p>')).text).toBe("Räksmörgås");
  });

  it("reads UTF-8 without a meta tag", () => {
    expect(readHtml(new TextEncoder().encode("<p>Räksmörgås</p>")).text).toBe("Räksmörgås");
  });

  it("is reached through extract", async () => {
    expect(await extract(new TextEncoder().encode("<p>Anna Berg</p>"), "sida.html")).toMatchObject({ kind: "text", format: "html", text: "Anna Berg" });
  });
});
