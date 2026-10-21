// Fictional texts that are hard to mask, for the leak count in
// hardCases.model.test.ts. Each lists the values that must not survive
// masking (matched case-insensitively as substrings, so keep them distinctive)
// and the word list the user would have typed, if any.
export interface HardCase {
  text: string;
  secrets: string[];
  wordList?: string[];
  /** Leaks today. The test fails when it starts passing, so the flag is removed on purpose. */
  fails?: true;
}

export const HARD_CASES: HardCase[] = [
  // Compound words and inflections of word-list terms (agencies, consultants).
  {
    text: "Lanseringen av Projekt Fenix skjuts upp. Fenixlanseringen och Fenix-teamet påverkas.",
    secrets: ["Fenix"],
    wordList: ["Fenix"],
  },
  { text: "Kampanjen Sommarglöd går bra. Sommarglödens budget ökar.", secrets: ["Sommarglöd"], wordList: ["Sommarglöd"] },
  {
    text: "Nordljusprojektet är försenat och Nordljuskampanjen likaså.",
    secrets: ["Nordljus"],
    wordList: ["Nordljus"],
  },
  { text: "Offerten till Brandvik ligger i Brandvikmappen.", secrets: ["Brandvik"], wordList: ["Brandvik"] },
  { text: "Vi ses på Polarisworkshopen i morgon.", secrets: ["Polaris"], wordList: ["Polaris"] },
  { text: "hej! fenixlanseringen flyttas, säg inget till kunden om fenix än", secrets: ["fenix"], wordList: ["Fenix"] },
  { text: "Kundens nya produkt Aurora X släpps i maj. Aurora X-lanseringen är hemlig.", secrets: ["Aurora X"], wordList: ["Aurora X"] },

  // Compound words of names the model finds.
  // The model types Ikea and Lidl as NAMN, so they do not spread into compounds; it masks
  // "Ikeaavtalet" on its own instead, with a placeholder of its own (checked 2026-10-21).
  { text: "Vi jobbar med Volvo. Volvoavtalet löper ut i mars och Volvokampanjen startar.", secrets: ["Volvo"] },
  { text: "Möte med Ikea i dag. Ikeakontot måste förnyas.", secrets: ["Ikea"] },
  { text: "Spotify är vår största kund. Spotifyteamet vill ha en ny offert.", secrets: ["Spotify"] },

  // Names in HR and recruiting.
  { text: "Johan Lindqvist har ringt. Lindqvist vill ha svar i dag.", secrets: ["Johan", "Lindqvist"] },
  { text: "Mötet med Johan Lindqvist gick bra. Sen sa johan att han slutar.", secrets: ["Johan", "Lindqvist"] },
  {
    text: "Kandidaten Oskar Wennerholm-Björk har 5 års erfarenhet. Oskar är stark i Python.",
    secrets: ["Oskar", "Wennerholm"],
  },
  { text: "Deltagare: Ola, Mikaela och Sven-Erik.", secrets: ["Ola", "Mikaela", "Sven-Erik"] },
  { text: "Hälsningar\nKarin Öhman\nEkonomiavdelningen", secrets: ["Karin", "Öhman"] },
  { text: "Mvh /Jonas", secrets: ["Jonas"] },
  { text: "Kundens VD heter Li Wei och CFO är Mohammed Al-Rashid.", secrets: ["Li Wei", "Mohammed", "Al-Rashid"] },
  { text: "Ekonomin Anna Svensson har godkänt budgeten.", secrets: ["Anna", "Svensson"] },
  { text: "Rehabmöte med Gunilla Sjöberg och hennes chef Tomas Nyqvist på fredag.", secrets: ["Gunilla", "Sjöberg", "Tomas", "Nyqvist"] },
  { text: "Lönesamtal: Henrik Åberg begär 48 000 kr i månaden.", secrets: ["Henrik", "Åberg"] },
  { text: "Referens: Malin Grahn, tidigare chef på Lindex.", secrets: ["Malin", "Grahn", "Lindex"] },

  // Healthcare admin and customer service.
  {
    text: "Patienten Linnéa Åkesson, född 1990, kom till vårdcentralen i Mölndal.",
    secrets: ["Linnéa", "Åkesson", "Mölndal"],
  },
  { text: "KARL JOHANSSON\nVintergatan 12\n113 45 STOCKHOLM", secrets: ["KARL", "JOHANSSON", "Vintergatan", "113 45"] },
  { text: "hej, det är ingrid från kundtjänst. kunden heter bengt olofsson och bor i sundsvall", secrets: ["ingrid", "bengt", "olofsson", "sundsvall"] },
  { text: "Ärendet gäller Siv Karlsson på Storgatan 4 i Luleå, tel 070-1234567.", secrets: ["Siv Karlsson", "Storgatan 4", "Luleå", "070-1234567"] },

  // Organisations and clients.
  { text: "Vi förlorade Ikea som kund till Accenture.", secrets: ["Ikea", "Accenture"] },
  { text: "Spotify och Klarna är med i piloten.", secrets: ["Spotify", "Klarna"] },
  { text: "Kampanjen för H&M startar i maj, i alla H&M-butiker.", secrets: ["H&M"] },
  { text: "Bokade möte med Birgitta på Fastighetsbolaget Norrkåken.", secrets: ["Birgitta", "Norrkåken"] },
  { text: "Byrån Kvist & Lönn tar över kontot från Ahlström Media.", secrets: ["Kvist", "Lönn", "Ahlström"] },

  // Probe of 2026-10-21: texts shaped like real HR, agency, finance and
  // healthcare material, outside maskera's own corpus.
  // Dates: no rule masks them yet.
  { text: "Kandidaten är född 1987-03-14 och bor i Täby.", secrets: ["1987-03-14", "Täby"], fails: true },
  { text: "Född: 14 mars 1987. Ålder: 39 år.", secrets: ["14 mars 1987"], fails: true },
  { text: "Personnummer 870314-1234 (kontrollsiffra fel). Även 8703141234.", secrets: ["870314-1234", "8703141234"] },
  { text: "Pnr: 19870314-1239", secrets: ["19870314-1239"] },

  // Names in tricky forms.
  { text: "pratade med anders ekström igår, han var sur", secrets: ["anders", "ekström"] },
  { text: "MÖTE MED ANDERS EKSTRÖM OCH LISA BERG", secrets: ["ANDERS", "EKSTRÖM", "LISA", "BERG"] },
  { text: "Ansvarig: A. Ekström. Granskad av L.B.", secrets: ["Ekström"] },
  { text: "Ekströms rapport var dålig. Vi tar Anders Ekströms förslag.", secrets: ["Ekström"] },
  { text: "Namn\tRoll\tLön\nAnders Ekström\tSäljare\t42000\nLisa Berg\tChef\t61000", secrets: ["Ekström", "Lisa Berg", "Anders"] },
  { text: "Med vänlig hälsning\n\nAnders\nKey Account Manager", secrets: ["Anders"] },
  { text: "@anders.ekstrom kan du kolla? /lisa", secrets: ["anders.ekstrom", "lisa"] },
  { text: "Vi anställer Nguyen Thi Lan och Oluwaseun Adeyemi till teamet.", secrets: ["Nguyen", "Thi Lan", "Oluwaseun", "Adeyemi"] },
  { text: "Sökande: Fatima El-Sayed, Youssef Haddad.", secrets: ["Fatima", "El-Sayed", "Youssef", "Haddad"] },
  { text: "Björn Stig och Rune Dal kom till mötet. Björn tar över.", secrets: ["Björn", "Stig", "Rune", "Dal"] },
  { text: "Dr Håkansson bedömde att pat. har diabetes. Ssk Pia noterade.", secrets: ["Håkansson", "Pia"] },
  { text: "Ann-Christin Lövgren-Holm ringde.", secrets: ["Ann-Christin", "Lövgren-Holm"] },
  { text: "Användare: aekstrom, inloggning aek123 misslyckades.", secrets: ["aekstrom"] },
  { text: "A n d e r s  E k s t r ö m skrev under.", secrets: ["E k s t r ö m"], fails: true },

  // Numbers and identifiers.
  { text: "Ring +46 70 123 45 67 eller 0046701234567 eller 08-123 456 78.", secrets: ["123 45 67", "0046701234567", "123 456 78"] },
  { text: "Tel 0701234567, mobil 070 123 45 67", secrets: ["0701234567", "070 123 45 67"] },
  { text: "Clearingnummer 8327-9, kontonummer 123 456 789-0. Swish 123 456 78 90.", secrets: ["123 456 789-0"] },
  { text: "Bankkonto: 9960 1234567890", secrets: ["1234567890"] },
  { text: "Bilen ABC 123 och den nya ABC12A står på parkeringen.", secrets: ["ABC 123", "ABC12A"] },
  { text: "Passnummer 12345678, körkortsnummer 870314-1234.", secrets: ["12345678"] },
  { text: "Diarienummer HR 2024/118. Ärende nr. 2024-00118.", secrets: ["2024/118", "2024-00118"] },
  { text: "Lön 48 500 kr/mån. Personnr 19870314-1239.", secrets: ["19870314-1239"] },
  { text: "Anställningsnummer 10233, anst.nr 10234, medarbetar-id 7781", secrets: ["10233", "10234", "7781"] },

  // Addresses and places.
  { text: "Hon bor på Björkvägen 14B, 2 tr, 123 45 Huddinge.", secrets: ["Björkvägen 14B", "123 45", "Huddinge"] },
  { text: "Hyresgästen på Storgatan har klagat.", secrets: ["Storgatan"] },
  { text: "Box 1234, 111 22 Stockholm", secrets: ["Box 1234", "111 22"] },
  { text: "c/o Ekström, Lillgatan 3, Visby", secrets: ["Ekström", "Lillgatan 3", "Visby"] },
  { text: "Kunden bor i Vittsjö och jobbar i Bjärnum.", secrets: ["Vittsjö", "Bjärnum"] },
  { text: "Stockholmskontoret och Göteborgsteamet slås ihop. Malmöbor klagar.", secrets: ["Stockholm", "Göteborg", "Malmö"], fails: true },

  // Organisations and client secrets.
  { text: "Pitchen för Arla gick bra, men Telia tvekar. Essity vill ha mer.", secrets: ["Arla", "Telia", "Essity"] },
  { text: "kunden (arla) vill flytta lanseringen", secrets: ["arla"] },
  { text: "Vi tappade Grönqvist Fastigheter till Byrå Nord. Fjällbris vill se offerten.", secrets: ["Grönqvist", "Byrå Nord", "Fjällbris"] },
  { text: "Kund: Fjällbris Konsult AB (556123-4567). Kontakt: Åsa Rehn.", secrets: ["Fjällbris", "556123-4567", "Åsa", "Rehn"] },
  // The model finds "Zephyr 2"; the head word alone is not spread to "Zephyr-teamet".
  { text: "Produkten Zephyr 2 lanseras i Q3. Zephyr-teamet är klart.", secrets: ["Zephyr"], fails: true },
  { text: 'Kampanjen "Sommar utan gränser" för Telia startar v.24.', secrets: ["Telia"] },
  { text: "Budgeten för Telia är 4,2 MSEK och marginalen 23 %.", secrets: ["Telia"] },
  { text: "Se mer på fjallbris.se och mejla asa@fjallbris.se", secrets: ["fjallbris.se", "asa@fjallbris.se"] },
  { text: "SKF och ICA Gruppen är kunder. SEB är bank.", secrets: ["SKF", "ICA", "SEB"] },
  { text: "Enligt mejlet från Telias inköpschef Per Holm är avtalet klart.", secrets: ["Telia", "Per", "Holm"] },
  { text: "Meeting notes: Anders Ekström from Fjällbris joined. Lisa Berg (CFO) declined.", secrets: ["Ekström", "Fjällbris", "Lisa Berg"] },

  // Healthcare.
  { text: "Pat. Eva Lind, 54 år, F32.1 depression, Sertralin 50 mg. Ssk Ulla Mo.", secrets: ["Eva Lind", "Ulla Mo"] },
  { text: "Anhörig: dottern Sara (070-111 22 33) hämtar.", secrets: ["Sara", "070-111 22 33"] },

  // Messy text.
  { text: "Namn: Rune\nHolmquist\nAdress: Ekvägen\n7", secrets: ["Rune", "Holmquist", "Ekvägen"] },
  { text: "lisa: har du skickat till ekström?\nanders: nej, väntar på berg", secrets: ["lisa", "ekström", "anders", "berg"] },
  { text: "Anders Ekstrom (utan prickar) och Andres Ekström.", secrets: ["Ekstrom", "Andres"] },
  { text: "Zephyrs lansering, Zephyr:s team, ZEPHYR-mötet, zephyren", secrets: ["Zephyr"], wordList: ["Zephyr"] },
  { text: "Projekt Norra Tornet och norra tornet-gruppen", secrets: ["Norra Tornet"], wordList: ["Norra Tornet"] },
  {
    text: "Anders Ekström är chef. Herr Ekström, eller Anders som han kallas, är 52. Ekströmarna bor i Nacka.",
    secrets: ["Ekström", "Anders", "Nacka"],
  },
];
