import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMsg } from "../../../tests/fixtures/documents/build.ts";
import { openCfb } from "../cfb.ts";
import { extract } from "../extract.ts";
import { formatDate, readMsg } from "./msg.ts";

const read = (bytes: Uint8Array) => readMsg(openCfb(bytes));

describe("readMsg", () => {
  it("reads sender, recipients, subject, date and body, and says the attachment was left out", () => {
    const date = new Date(2026, 9, 13, 9, 30);
    const msg = buildMsg({
      subject: "Sjukskrivning för Anna",
      fromName: "Anna Berg",
      fromEmail: "anna.berg@norrstrom.se",
      to: "Erik Holm",
      cc: "Lisa Ek",
      body: "Anna Berg är sjukskriven.",
      date,
      attachment: "intyg.pdf",
    });
    expect(read(msg)).toEqual({
      text: `Från: Anna Berg <anna.berg@norrstrom.se>\nTill: Erik Holm\nKopia: Lisa Ek\nÄmne: Sjukskrivning för Anna\nDatum: ${formatDate(date)}\n\nAnna Berg är sjukskriven.`,
      attachments: true,
    });
    expect(formatDate(date)).toBe("2026-10-13 09:30");
  });

  it("reads 8-bit strings in the message's code page", () => {
    expect(read(buildMsg({ subject: "Hej", body: "Hälsningar Erik", ansi: true, codepage: 1252 })).text).toBe("Ämne: Hej\n\nHälsningar Erik");
  });

  it("reads an HTML-only body as text", () => {
    expect(read(buildMsg({ subject: "Hej", html: "<p>Hej <b>Anna</b></p>" }))).toEqual({ text: "Ämne: Hej\n\nHej Anna", attachments: false });
  });

  it("reads Outlook's own file", () => {
    const { text } = read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/test-outlook.msg")));
    expect(text).toContain("Nouvel utilisateur de Outlook Express");
    expect(text).toContain("Messagerie et groupes de discussion");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildMsg({ subject: "Hej", body: "Anna Berg" }), "mejl.msg")).toMatchObject({ kind: "text", format: "msg" });
  });
});
