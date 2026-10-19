import { describe, expect, it } from "vitest";
import { companyName, domainName, headerName, labelledNumber, momsnummer, orgnrInContext } from "./contextRules.ts";

const values = (text: string) => orgnrInContext.detect(text).map((d) => d.value);

describe("orgnrInContext", () => {
  it("masks an org.nr with a failing checksum when labelled", () => {
    expect(values("Stena Recycling AB, org.nr 556147-9036, Göteborg")).toEqual(["556147-9036"]);
  });

  it("accepts orgnr, organisationsnummer, a colon and no dash", () => {
    expect(values("orgnr: 5561479036. Organisationsnummer 556147-9036")).toEqual(["5561479036", "556147-9036"]);
  });

  it("ignores the same number without a label", () => {
    expect(values("Ring 556147-9036")).toEqual([]);
  });

  it("reports offsets of the number only", () => {
    const [d] = orgnrInContext.detect("org.nr 556147-9036");
    expect(d).toEqual({ start: 7, end: 18, value: "556147-9036" });
  });

  it("is labelled ORGANISATIONSNUMMER", () => {
    expect(orgnrInContext.label).toBe("ORGANISATIONSNUMMER");
  });
});

const found = (detector: { detect(t: string): Array<{ value: string }> }, text: string) =>
  detector.detect(text).map((d) => d.value);

describe("momsnummer", () => {
  it("masks a Swedish VAT number, with or without spaces and dash", () => {
    expect(found(momsnummer, "Momsreg.nr SE556147903601, eller SE 556147-9036 01.")).toEqual([
      "SE556147903601",
      "SE 556147-9036 01",
    ]);
  });

  it("ignores SE followed by a number of the wrong length", () => {
    expect(found(momsnummer, "SE1234567890 och SE55614790360199")).toEqual([]);
  });

  it("is labelled ORGANISATIONSNUMMER", () => {
    expect(momsnummer.label).toBe("ORGANISATIONSNUMMER");
  });
});

describe("companyName", () => {
  it("masks capitalised words before a company form, but not the form", () => {
    expect(found(companyName, "Avtal med Norrström Media AB och Fjällvind Kraft Aktiebolag.")).toEqual([
      "Norrström Media",
      "Fjällvind Kraft",
    ]);
  });

  it("knows common foreign company forms and (publ)", () => {
    expect(found(companyName, "Acme Ltd, Beispiel GmbH, Nordvik AS och Telia Company AB (publ).")).toEqual([
      "Acme",
      "Beispiel",
      "Nordvik",
      "Telia Company",
    ]);
  });

  it("also masks the name where it stands without the company form", () => {
    expect(found(companyName, "Norrström Media AB, org.nr x. Norrström Media:s kunder och Norrström Medias.")).toEqual([
      "Norrström Media",
      "Norrström Media:s",
      "Norrström Medias",
    ]);
  });

  it("leaves a sentence opener out of the name", () => {
    expect(found(companyName, "Enligt Norrström Media AB gäller det. Kontakta Norrström Media.")).toEqual([
      "Norrström Media",
      "Norrström Media",
    ]);
  });

  it("prefers the shorter name when an unknown opener is caught in front of it", () => {
    expect(found(companyName, "Norrström Media AB. Tillsammans Norrström Media AB vet.")).toEqual([
      "Norrström Media",
      "Norrström Media",
    ]);
  });

  it("allows & and hyphens inside the name", () => {
    expect(found(companyName, "Ström & Söner AB köpte Berg-Lind HB.")).toEqual(["Ström & Söner", "Berg-Lind"]);
  });

  it("ignores a company form without a capitalised name before it", () => {
    expect(found(companyName, "ett nytt AB bildades, AB står för aktiebolag")).toEqual([]);
  });

  it("is labelled ORGANISATION", () => {
    expect(companyName.label).toBe("ORGANISATION");
  });
});

describe("headerName", () => {
  const names = (text: string) => headerName.detect(text).map((d) => d.value);

  it("masks the name on a From line, and where it recurs", () => {
    expect(names("From: Jonas Falk\nSubject: reset\n\nHälsningar Jonas Falk")).toEqual(["Jonas Falk", "Jonas Falk"]);
  });

  it("reads Swedish labels, lists, quotes and addresses", () => {
    expect(
      names('Från: "Anna Berg" <anna.berg@norrstrom.se>\nTill: Erik Holm <erik@x.se>; Lisa Ek\nKopia: lisa.ek@norrstrom.se'),
    ).toEqual(["Anna Berg", "Erik Holm", "Lisa Ek"]);
  });

  it("leaves lowercase words, addresses and lines that are not headers", () => {
    expect(names("Till: alla medarbetare\nFrån: anna.berg@norrstrom.se\nVi åkte från Malmö: Anna Berg körde")).toEqual([]);
  });

  it("is labelled NAMN", () => {
    expect(headerName.label).toBe("NAMN");
  });
});

describe("domainName", () => {
  it("masks a bare web address", () => {
    expect(found(domainName, "Läs mer på norrstrommedia.se eller shop.fjallvind.com.")).toEqual([
      "norrstrommedia.se",
      "shop.fjallvind.com",
    ]);
  });

  it("masks the domain of an email address where it stands alone", () => {
    expect(found(domainName, "Mejla anna@fjallvind.energy. Besök fjallvind.energy idag.")).toEqual([
      "fjallvind.energy",
    ]);
  });

  it("does not report the domain inside an email address or a URL", () => {
    expect(found(domainName, "anna@norrstrommedia.se, https://norrstrommedia.se/om")).toEqual([]);
  });

  it("ignores abbreviations and file names", () => {
    expect(found(domainName, "t.ex. bl.a. s.k. rapport.pdf avtal.docx Slut.Nu")).toEqual([]);
  });

  it("is labelled URL", () => {
    expect(domainName.label).toBe("URL");
  });
});

describe("labelledNumber", () => {
  it.each([
    ["Kundnummer: 48213377", "48213377"],
    ["kundnr 48213377.", "48213377"],
    ["Avtalsnummer AB-1234-567 gäller", "AB-1234-567"],
    ["Fakturanr: 2026-00412", "2026-00412"],
    ["Ordernummer #A77B21", "A77B21"],
    ["Ert ärendenummer är 7731.", "7731"],
    ["Referensnummer: KX9-221", "KX9-221"],
    ["Ref: SE/2026/118", "SE/2026/118"],
    ["Anläggnings-ID 735999100000123456", "735999100000123456"],
    ["Mätpunkts-ID: 735999100000654321", "735999100000654321"],
    ["Medlemsnummer 55102", "55102"],
    ["Anställningsnummer 1042", "1042"],
    ["Bokningsnummer XQ7T2P", "XQ7T2P"],
    ["Försäkringsnummer 123-456-789", "123-456-789"],
    ["OCR-nummer 4412 3390 1182", "4412 3390 1182"],
  ])("masks the number after a label: %s", (text, value) => {
    expect(found(labelledNumber, text)).toEqual([value]);
  });

  it("masks every labelled number in a text", () => {
    expect(found(labelledNumber, "Kundnummer 1001, avtalsnummer 2002 och ordernr 3003.")).toEqual(["1001", "2002", "3003"]);
  });

  it.each([
    ["no digit after the label", "Ange ditt kundnummer i fältet."],
    ["a label inside a longer word", "Kundnummerfältet 123 är tomt."],
    ["a number that is not right after the label", "Kundnumret skickas senare, ring 0701234567."],
    ["ref inside another word", "Han refererade till 2025 års avtal."],
  ])("leaves %s alone", (_, text) => {
    expect(found(labelledNumber, text)).toEqual([]);
  });

  it("is labelled REFERENSNUMMER", () => {
    expect(labelledNumber.label).toBe("REFERENSNUMMER");
  });
});
