import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { readEml } from "./eml.ts";
import { mailText } from "./mail.ts";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const read = (lines: string[]) => readEml(latin1(lines.join("\r\n")));

const MIXED = [
  "From: =?UTF-8?Q?Anna_Berg?= <anna.berg@norrstrom.se>",
  "To: Erik Holm <erik.holm@norrstrom.se>",
  "Cc: lisa.ek@norrstrom.se",
  `Subject: =?UTF-8?B?${b64("Sjukskrivning för")}?=`,
  " =?UTF-8?Q?_Anna?=",
  "Date: Tue, 13 Oct 2026 09:30:00 +0200",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="yttre"',
  "",
  "--yttre",
  'Content-Type: multipart/alternative; boundary="inre"',
  "",
  "--inre",
  "Content-Type: text/plain; charset=iso-8859-1",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hej Erik,",
  "",
  "Anna Berg =E4r sjukskriven till och med fredag. Ring 070-1740612 =",
  "om du har fr=E5gor.",
  "--inre",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>HTML-versionen</p>",
  "--inre--",
  "--yttre",
  'Content-Type: application/pdf; name="intyg.pdf"',
  'Content-Disposition: attachment; filename="intyg.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--yttre--",
  "",
];

describe("readEml", () => {
  it("reads the headers and the plain part, and says the attachment was left out", () => {
    expect(read(MIXED)).toEqual({
      text:
        "Från: Anna Berg <anna.berg@norrstrom.se>\nTill: Erik Holm <erik.holm@norrstrom.se>\nKopia: lisa.ek@norrstrom.se\n" +
        "Ämne: Sjukskrivning för Anna\nDatum: Tue, 13 Oct 2026 09:30:00 +0200\n\n" +
        "Hej Erik,\n\nAnna Berg är sjukskriven till och med fredag. Ring 070-1740612 om du har frågor.",
      attachments: true,
    });
  });

  it("reads an HTML-only mail as text", () => {
    const eml = ["From: anna.berg@norrstrom.se", "Subject: Hej", "Content-Type: text/html; charset=utf-8", "", "<p>Hej <b>Anna</b></p>"];
    expect(read(eml)).toEqual({ text: "Från: anna.berg@norrstrom.se\nÄmne: Hej\n\nHej Anna", attachments: false });
  });

  it("decodes a base64 body in its charset", () => {
    const eml = ["Subject: Hej", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64("Hälsningar Erik")];
    expect(read(eml).text).toBe("Ämne: Hej\n\nHälsningar Erik");
  });

  it("reads 8-bit headers and bodies without a declared charset", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("Subject: Möte\r\n\r\nHej Åsa")]);
    expect(readEml(bytes).text).toBe("Ämne: Möte\n\nHej Åsa");
  });

  it("is reached through extract", async () => {
    expect(await extract(latin1(MIXED.join("\r\n")), "mejl.eml")).toMatchObject({ kind: "text", format: "eml", notes: ["attachmentsLeftOut"] });
  });
});

describe("mailText", () => {
  it("leaves out headers that are missing", () => {
    expect(mailText({ subject: "Hej" }, "Text\r\n")).toBe("Ämne: Hej\n\nText");
  });
});
