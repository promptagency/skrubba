import { describe, expect, it } from "vitest";
import {
  ampersandName,
  birthColumn,
  birthDate,
  companyName,
  domainName,
  headerName,
  intlPhone,
  labelledNumber,
  momsnummer,
  orgnrInContext,
  placeCompound,
  postbox,
  splitPersonnummer,
  spokenEmail,
  spokenPhone,
} from "./contextRules.ts";

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

describe("birthDate", () => {
  it.each([
    ["Kandidaten är född 1987-03-14 i Täby.", "1987-03-14"],
    ["Född: 14 mars 1987.", "14 mars 1987"],
    ["född den 14 mars 1987", "14 mars 1987"],
    ["Anna Berg, f. 14/3-87, bor här.", "14/3-87"],
    ["Född 14/3 1987", "14/3 1987"],
    ["Födelsedatum: 19870314", "19870314"],
    ["född 870314", "870314"],
    ["fdat 1987-03-14", "1987-03-14"],
    ["Date of birth: 14.3.1987", "14.3.1987"],
    ["Född 3:e maj 1990", "3:e maj 1990"],
  ])("masks the date after a birth label: %s", (text, value) => {
    expect(found(birthDate, text)).toEqual([value]);
  });

  it.each([
    ["a date without a birth label", "Mötet hölls 1987-03-14 och 14 mars 1987."],
    ["a year alone", "Född 1987 i Täby."],
    ["a label inside a word", "Nyfödd 1987-03-14"],
    ["an age", "född för 39 år sedan"],
  ])("leaves %s alone", (_, text) => {
    expect(found(birthDate, text)).toEqual([]);
  });

  it("is labelled FÖDELSEDATUM", () => {
    expect(birthDate.label).toBe("FÖDELSEDATUM");
  });
});

describe("placeCompound", () => {
  it("masks the place at the start of a compound, binding s included", () => {
    expect(found(placeCompound, "Stockholmskontoret och Göteborgsteamet slås ihop. Malmöbor klagar. Skånetrafiken.")).toEqual([
      "Stockholm",
      "Göteborg",
      "Malmö",
      "Skåne",
    ]);
  });

  it("leaves the place alone, surnames and other compounds", () => {
    expect(found(placeCompound, "Vi ses i Malmö. Eva Lundgren och Per Malmberg. Lundaspexet.")).toEqual([]);
  });

  it("is labelled PLATS", () => {
    expect(placeCompound.label).toBe("PLATS");
  });
});

describe("birthColumn", () => {
  it("masks the dates in a tab-separated column headed Född, until a blank line", () => {
    const text = "Namn\tFödd\tRoll\nAnna Berg\t1987-03-14\tChef\nErik Ek\t14/3-87\tSäljare\n\nMötet 2024-05-01\t1990-01-01";
    expect(found(birthColumn, text)).toEqual(["1987-03-14", "14/3-87"]);
    const [first] = birthColumn.detect(text);
    expect(text.slice(first.start, first.end)).toBe("1987-03-14");
  });

  it("leaves other columns and tables without such a heading alone", () => {
    expect(found(birthColumn, "Namn\tAnställd\nAnna Berg\t2020-01-01\nDatum\t2024-05-01")).toEqual([]);
  });

  it("is labelled FÖDELSEDATUM", () => {
    expect(birthColumn.label).toBe("FÖDELSEDATUM");
  });
});

describe("postbox", () => {
  it("masks a post office box", () => {
    expect(found(postbox, "Box 1234, 111 22 Stockholm. Postbox 77.")).toEqual(["Box 1234", "Postbox 77"]);
  });

  it("leaves other boxes alone", () => {
    expect(found(postbox, "Xbox 360, box 1, en Box med 3 saker")).toEqual([]);
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
    ["Passnummer 12345678", "12345678"],
    ["anst.nr 10234", "10234"],
    ["Medarbetar-id 7781", "7781"],
    ["Ärende nr. 2024-00118", "2024-00118"],
    ["Diarienummer HR 2024/118.", "HR 2024/118"],
    ["Löpnummer 42", "42"],
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
    ["a number maskera types itself", "Telefonnummer 070-1234567, personnummer 19870314-1239, pnr 870314-1239, kontonummer 1234567"],
    ["a version number", "Versionsnummer 2.3 och version nr 4"],
    ["a page, a count or an ordinal", "Sidnummer 4 av 12, antal nr 3, barnen nr 1 och nr 2"],
  ])("leaves %s alone", (_, text) => {
    expect(found(labelledNumber, text)).toEqual([]);
  });

  it("is labelled REFERENSNUMMER", () => {
    expect(labelledNumber.label).toBe("REFERENSNUMMER");
  });
});

describe("splitPersonnummer", () => {
  const found = (text: string) => splitPersonnummer.detect(text).map((d) => d.value);

  it("finds a personnummer broken by a line break or a space", () => {
    expect(found("Personnr 730928-\n1231\nTelefon")).toEqual(["730928-\n1231"]);
    expect(found("PNR: 580722-437\n2\nAdress")).toEqual(["580722-437\n2"]);
    expect(found("det stod 8506 23-2381 (felradat)")).toEqual(["8506 23-2381"]);
    expect(found("19580722 - 4372")).toEqual(["19580722 - 4372"]);
  });

  it("leaves whole ones to maskera, and phone numbers, dates and two line breaks alone", () => {
    expect(found("Pnr 850623-2381")).toEqual([]);
    expect(found("Ring 070-123 45 67 eller 08-465 00 483")).toEqual([]);
    expect(found("Ring 070123 - 4567 i dag")).toEqual(["070123 - 4567"]); // a date shape, so masked: a miss is worse
    expect(found("850699 -2381")).toEqual([]);
    expect(found("730928-\n12\n31")).toEqual([]);
  });
});

describe("intlPhone", () => {
  it("finds a number with the 00 exit code, spaced or not", () => {
    expect(found(intlPhone, "Ring 0046701234567 eller 0046 70-123 45 67.")).toEqual(["0046701234567", "0046 70-123 45 67"]);
  });

  it("leaves other digit runs alone", () => {
    expect(found(intlPhone, "Konto 0012345, år 2024, pnr 19870314-1239, 070-1234567")).toEqual([]);
  });
});

describe("spokenPhone", () => {
  const found = (text: string) => spokenPhone.detect(text).map((d) => d.value);

  it("finds a number read out digit by digit", () => {
    expect(found("du når mig på noll sju noll två ett fyra sex fem åtta, kan du läsa upp det")).toEqual([
      "noll sju noll två ett fyra sex fem åtta",
    ]);
    expect(found("Noll-sju-tre, fyra fem sex, sju åtta nio.")).toEqual(["Noll-sju-tre, fyra fem sex, sju åtta nio"]);
  });

  it("leaves counting and short runs alone", () => {
    expect(found("ett, två, tre, fyra, fem, sex, sju")).toEqual([]);
    expect(found("noll sju noll, sen tystnad")).toEqual([]);
  });
});

describe("spokenEmail", () => {
  const found = (text: string) => spokenEmail.detect(text).map((d) => d.value);

  it("finds an address read out with punkt and snabel-a", () => {
    expect(found("det är pelle punkt johansson snabel-a outlook punkt com. Agent")).toEqual([
      "pelle punkt johansson snabel-a outlook punkt com",
    ]);
    expect(found("gun punkt britt snabel a bredband punkt net, fast")).toEqual(["gun punkt britt snabel a bredband punkt net"]);
  });

  it("needs a domain with punkt", () => {
    expect(found("skriv snabel-a och sen namnet")).toEqual([]);
  });
});

describe("ampersandName", () => {
  const found = (text: string) => ampersandName.detect(text).map((d) => d.value);

  it("finds a company name of initials joined by &", () => {
    expect(found("Möte med H&M i dag, sen AT&T och H & M igen.")).toEqual(["H&M", "AT&T", "H & M"]);
  });

  it("leaves business shorthand and longer names alone", () => {
    expect(found("Budget för R&D och en Q&A efter M&A-affären. Kvist & Lönn.")).toEqual([]);
  });
});
