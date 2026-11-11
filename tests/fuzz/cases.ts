// Text cases for the robustness exam (tests/robustness.test.ts). All people,
// companies, addresses and numbers are invented; personnummer are made up
// with a valid check digit. New coverage, not a copy of
// src/engine/fixtures/hardCases.ts.
import { casingCases, type FuzzCase, nameCases, personnummer } from "./generate.ts";

/**
 * How many cases may be flagged `knownLeak`. The exam fails above it, so
 * the list of tolerated leaks can only shrink. Lower it when a flag goes.
 */
export const KNOWN_LEAK_BASELINE = 0;

const PNR_A = personnummer("850709", "123");
const PNR_B = personnummer("920314", "448");
const SAMORDNING = personnummer("780871", "246"); // day + 60

const HAND_CASES: FuzzCase[] = [
  // Organisations, masked by default.
  {
    probe: "org: compound with hyphen (Volvo-fabriken style)",
    text: "Avtalet med Brännvik Konsult AB är klart. Brännvik-avtalet gäller från juni.",
    secrets: ["Brännvik"],
    keeps: ["Avtalet", "juni"],
  },
  {
    probe: "org: genitive and lower case later",
    text: "Solkustens Bygg AB:s styrelse möts i dag. solkustens bygg vill ha svar.",
    secrets: ["Solkusten"],
    keeps: ["styrelse"],
  },
  {
    probe: "org: in an English sentence",
    text: "We signed the deal with Kvarnholmen Data AB last week. Kvarnholmen Data will invoice us.",
    secrets: ["Kvarnholmen"],
    keeps: ["deal", "invoice"],
  },

  // Word list: agencies' and consultants' confidential terms.
  {
    probe: "word list: multi-word term, first word in a compound",
    text: "Projekt Lodjur startar i maj. Lodjur-teamet och Lodjurlanseringen hålls hemliga.",
    secrets: ["Lodjur"],
    wordList: ["Projekt Lodjur"],
    keeps: ["startar"],
  },
  {
    probe: "word list: term in upper case and in English",
    text: "LODJUR är försenat. The Lodjur launch moves to Q3.",
    secrets: ["Lodjur"],
    wordList: ["Lodjur"],
    keeps: ["launch"],
  },
  {
    probe: "word list: term with digits and a dot",
    text: "Version Nimbus 3.0 släpps i höst. Nimbus 3.0-demon visas på fredag.",
    secrets: ["Nimbus 3.0"],
    wordList: ["Nimbus 3.0"],
    keeps: ["fredag"],
  },
  {
    probe: "word list: client nickname in lower case in a chat line",
    text: "kl 14 möte m blåbärskunden, ta inte upp blåbär i mejlet",
    secrets: ["blåbär"],
    wordList: ["Blåbär"],
    keeps: ["möte"],
  },

  // Numbers and contact details.
  {
    probe: "personnummer: short, long and without dash",
    text: `Personnummer ${PNR_A}, även skrivet 19${PNR_A} eller ${PNR_B.replace("-", "")}.`,
    secrets: [PNR_A, `19${PNR_A}`, PNR_B.replace("-", "")],
  },
  {
    probe: "personnummer: plus sign for a person over 100",
    text: `Den sökandes nummer är ${PNR_A.replace("-", "+")}.`,
    secrets: [PNR_A.replace("-", "+")],
    keeps: ["sökandes"],
  },
  {
    probe: "samordningsnummer: day plus 60",
    text: `Samordningsnummer: ${SAMORDNING}`,
    secrets: [SAMORDNING],
  },
  {
    probe: "phone numbers in three styles",
    text: "Ring 070-123 45 67, +46 70 765 43 21 eller 08-555 123 99.",
    secrets: ["123 45 67", "765 43 21", "555 123 99"],
    keeps: ["Ring"],
  },
  {
    probe: "email in upper case at line end",
    text: "Svara till TILDA.GRANQVIST@EXEMPEL.SE\nTack!",
    secrets: ["GRANQVIST", "TILDA"],
    keeps: ["Svara"],
  },
  {
    probe: "address with letter, floor and postnummer",
    text: "Ny adress: Lingonstigen 14B, 2 tr, 123 45 Hagfors.",
    secrets: ["Lingonstigen", "123 45", "Hagfors"],
  },
  {
    probe: "IBAN with spaces",
    text: "Betala till IBAN SE45 5000 0000 0583 9825 7466 senast fredag.",
    secrets: ["5000 0000 0583 9825 7466"],
    keeps: ["fredag"],
  },

  // Names in harder places.
  {
    probe: "first name alone after the full name",
    text: "Yasmin Haddad är sjukskriven. Yasmin kommer tillbaka i juni.",
    secrets: ["Yasmin", "Haddad"],
    keeps: ["sjukskriven"],
  },
  {
    probe: "surname alone with a title after the full name",
    text: "Oskar Fjällgren har lämnat in. Fjällgren vill ha svar, säger fru Fjällgrens chef.",
    secrets: ["Oskar", "Fjällgren"],
  },
  {
    probe: "double-barrelled first name and surname",
    text: "Anna-Greta Sjöholm-Ekvall har beviljats tjänstledighet.",
    secrets: ["Anna-Greta", "Sjöholm", "Ekvall"],
    keeps: ["tjänstledighet"],
  },
  {
    probe: "lower-case name in a chat message",
    text: "ok, säg till dragan petrović att kontraktet är klart",
    secrets: ["dragan", "petrović"],
    keeps: ["kontraktet"],
  },
  {
    probe: "name that is also an ordinary word",
    text: "Sten Ros ansvarar för stenläggningen vid entrén.",
    secrets: ["Sten Ros"],
    keeps: ["stenläggningen"],
  },
  {
    probe: "full email-style message with header block and signature",
    text: [
      "Från: Mikko Rautakorpi <mikko.rautakorpi@exempel.se>",
      "Skickat: den 3 mars 2026 09:14",
      "Till: Leonora Bexell",
      "Ämne: Löneöversyn",
      "",
      "Hej Leonora,",
      "Bifogar underlaget för löneöversynen.",
      "",
      "/Mikko",
      "Mobil: 073-998 12 34",
    ].join("\n"),
    secrets: ["Rautakorpi", "Bexell", "Leonora", "Mikko", "998 12 34"],
    keeps: ["underlaget"],
  },
  {
    probe: "CSV row with semicolons",
    text: "Namn;Personnummer;Ort\nEbbe Sandlund;" + PNR_B + ";Arvika\nKlara Vinterbo;" + PNR_A + ";Mora",
    secrets: ["Sandlund", "Vinterbo", PNR_A, PNR_B, "Arvika"],
    keeps: ["Personnummer"],
  },

  // Over-masking guard: nothing to mask, so nothing may change.
  {
    probe: "keeps: plain business prose with capitalised words",
    text: "Hej! Tack för mötet i måndags. Budgeten för Q3 ligger kvar i Excel och avtalet skickas på fredag.",
    secrets: [],
    keeps: ["Hej", "Tack", "mötet", "Budgeten", "avtalet", "fredag"],
  },
];

export const CASES: FuzzCase[] = [...nameCases(), ...casingCases(), ...HAND_CASES];
