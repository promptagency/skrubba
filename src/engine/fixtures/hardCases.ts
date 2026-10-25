// Fictional texts that are hard to mask, for the leak count in
// hardCases.model.test.ts. Each lists the values that must not survive
// masking (matched case-insensitively as substrings, so keep them distinctive)
// and the word list the user would have typed, if any.
export interface HardCase {
  text: string;
  secrets: string[];
  wordList?: string[];
  /** Plain words that must stay readable in the masked text. */
  keeps?: string[];
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
  {
    text: "Projekt Havsvind lanseras i maj. Havsvind-teamet och Havsvindsteamet är klara.",
    secrets: ["Havsvind"],
    wordList: ["Projekt Havsvind"],
  },

  // Compound words of names the model finds.
  // The model types Ikea and Lidl as NAMN; the known-organisations list retypes them, so they spread.
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
  // Dates.
  { text: "Kandidaten är född 1987-03-14 och bor i Täby.", secrets: ["1987-03-14", "Täby"] },
  { text: "Född: 14 mars 1987. Ålder: 39 år.", secrets: ["14 mars 1987"] },
  { text: "Personnummer 870314-1234 (kontrollsiffra fel). Även 8703141234.", secrets: ["870314-1234", "8703141234"] },
  { text: "Pnr: 19870314-1239", secrets: ["19870314-1239"] },
  { text: "Deltagare: Anna Berg, 1987-03-14, och Erik Ek (*14/3-87).", secrets: ["Anna Berg", "1987-03-14", "Erik Ek", "14/3-87"] },
  { text: "Namn\tFödd\tRoll\nAnna Berg\t1987-03-14\tChef\nErik Ek\t1990-11-02\tSäljare", secrets: ["Anna Berg", "1987-03-14", "Erik Ek", "1990-11-02"] },

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
  { text: "A n d e r s  E k s t r ö m skrev under.", secrets: ["E k s t r ö m"] },

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
  { text: "Stockholmskontoret och Göteborgsteamet slås ihop. Malmöbor klagar.", secrets: ["Stockholm", "Göteborg", "Malmö"] },

  // Organisations and client secrets.
  { text: "Pitchen för Arla gick bra, men Telia tvekar. Essity vill ha mer.", secrets: ["Arla", "Telia", "Essity"] },
  { text: "kunden (arla) vill flytta lanseringen", secrets: ["arla"] },
  { text: "Vi tappade Grönqvist Fastigheter till Byrå Nord. Fjällbris vill se offerten.", secrets: ["Grönqvist", "Byrå Nord", "Fjällbris"] },
  { text: "Kund: Fjällbris Konsult AB (556123-4567). Kontakt: Åsa Rehn.", secrets: ["Fjällbris", "556123-4567", "Åsa", "Rehn"] },
  { text: "Produkten Zephyr 2 lanseras i Q3. Zephyr-teamet är klart.", secrets: ["Zephyr"] },
  { text: 'Kampanjen "Sommar utan gränser" för Telia startar v.24.', secrets: ["Telia"] },
  { text: "Budgeten för Telia är 4,2 MSEK och marginalen 23 %.", secrets: ["Telia"] },
  { text: "Se mer på fjallbris.se och mejla asa@fjallbris.se", secrets: ["fjallbris.se", "asa@fjallbris.se"] },
  { text: "SKF och ICA Gruppen är kunder. SEB är bank.", secrets: ["SKF", "ICA", "SEB"] },
  { text: "Enligt mejlet från Telias inköpschef Per Holm är avtalet klart.", secrets: ["Telia", "Per", "Holm"] },
  {
    text: "Meeting notes: Anders Ekström from Fjällbris joined. Lisa Berg (CFO) declined.",
    secrets: ["Ekström", "Fjällbris", "Lisa Berg"],
    keeps: ["joined"],
  },
  // The model, trained on Swedish, takes English function words into its spans.
  {
    text: "Please call Per Holm on Monday. Fjällbris joined the call and Zephyr launches in Q3.",
    secrets: ["Per Holm", "Fjällbris", "Zephyr"],
    keeps: ["Please call", "joined the call", "launches"],
  },
  {
    text: "Our contact Johan Nilsson from Fjällbris Konsult will present. Hi team, Karin Öhman at Grönqvist Fastigheter sent it.",
    secrets: ["Johan Nilsson", "Fjällbris", "Karin Öhman", "Grönqvist"],
    keeps: ["Our contact", "will present", "Hi team", "sent it"],
  },

  // Identifiers after a bare label, and chat handles (probe 2026-10-23).
  {
    text: "[10:02] Kund: Hej, jag heter Mona Sjölin och mitt kundnummer är 48812-7.\n[10:03] Agent: Hej Mona! Jag ser din order 2024-559871.",
    secrets: ["Mona Sjölin", "48812-7", "2024-559871", "Mona"],
  },
  { text: "Ärende #771203: kunden (Sven-Erik Lund) vill byta leveransadress.", secrets: ["771203", "Sven-Erik Lund"] },
  {
    text: "Mål nr T 4455-23, Göteborgs tingsrätt. Kärande: Anna Berg. Svarande: Fjällbris Konsult AB (556123-4567).",
    secrets: ["T 4455-23", "Anna Berg", "Fjällbris", "556123-4567"],
  },
  { text: "Pass nr 87654321 (utfärdat 2019), körkort 19850312-4471, anställnings-ID EMP-00912.", secrets: ["87654321", "19850312-4471", "EMP-00912"] },
  { text: "Kolli 00370724850012345678 till Johan Ek, Hamngatan 2, 972 31 Luleå.", secrets: ["00370724850012345678", "Johan Ek", "Hamngatan 2", "Luleå"] },
  { text: "ping @karin: offerten till Grönqvist ligger i mappen 'Kunder/Grönqvist Fastigheter'. cc @erik", secrets: ["karin", "Grönqvist", "erik"] },

  // Job titles the model takes for companies.
  {
    text: "Lisa Berg (CFO) och Per Holm (VD) deltog. Controller: Anna Ek. Styrelsen: Erik Ek (ordf.), Sara Lind (ledamot).",
    secrets: ["Lisa Berg", "Per Holm", "Anna Ek", "Erik Ek", "Sara Lind"],
    keeps: ["CFO", "VD", "Controller", "ordf", "ledamot"],
  },

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

  // A transcript with repeated speaker labels (user report, 2026-10-23): the
  // model took "Elevens" for a name once, and the spread masked all of them.
  {
    text: "**Elevens lärare (Emma)**\n\nVi ska prata om Liam.\n\n**Elevens mamma (Sara)**\n\nHan har haft det tufft med matten.\n\n**Elevens lärare (Emma)**\n\nVi har satt in stöd.\n\n**Rektorn (Per)**\n\nJag vill tillägga att Elevens lärare har gjort ett fint jobb.\n\n**Elevens pappa (Jonas)**\n\nTack.\n\n**Elevens lärare (Emma)**\n\nEmma här igen, ni når mig på emma.lind@skola.se.",
    secrets: ["Emma", "Liam", "Sara", "Per", "Jonas", "emma.lind"],
    keeps: ["Elevens lärare", "Elevens mamma", "Rektorn"],
  },

  // Probe round 3 (2026-10-25): recruitment, finance, care, legal, sales,
  // signatures, minutes, Nordic names, SMS, OCR noise and English. Card and
  // giro numbers are masked only with a valid check digit, as issued ones have.
  {
    text: "CV: Samira Hosseini, född 1991-06-14, Fjällgatan 7, 116 28 Stockholm, samira.h@gmail.com. Senast: Key Account Manager på Nordic Retail AB 2019–2024.",
    secrets: ["Samira Hosseini", "1991-06-14", "Fjällgatan 7", "116 28", "samira.h@gmail.com", "Nordic Retail"],
  },
  { text: "Referens: Tomas Lindgren (f.d. chef, Scania), 070-555 12 12. Kandidaten Oskar Nyman begärde 48 000 kr i månadslön.", secrets: ["Tomas Lindgren", "Scania", "070-555 12 12", "Oskar Nyman"] },
  { text: "Intervjuanteckning: K. Bergström är stark på SQL men svag på presentation. Rekommenderas till andra intervju med Petra.", secrets: ["Bergström", "Petra"] },
  {
    text: "Faktura 2024-1187 från Grönlunds Måleri AB, org.nr 559012-3456, bankgiro 5050-1055, belopp 18 750 kr inkl. moms. Referens: Åsa Lind.",
    secrets: ["Grönlunds Måleri", "559012-3456", "5050-1055", "Åsa Lind"],
  },
  { text: "Utbetalning till IBAN SE45 5000 0000 0583 9825 7466 (mottagare Henrik Ödman) stoppades av banken.", secrets: ["SE45 5000 0000 0583 9825 7466", "Henrik Ödman"] },
  { text: "Kortet 4111 1111 1111 1111 (utgång 09/27) tillhör Mikaela Strand och har använts på Systembolaget i Umeå.", secrets: ["4111 1111 1111 1111", "Mikaela Strand", "Umeå"] },
  { text: "Hemtjänst, dagrapport 3/11: Gunnar Ek (f. 1934) i lgh 2 på Ringvägen 9 har ont i höften igen. Dottern Ulla ringde kl 14.", secrets: ["Gunnar Ek", "Ringvägen 9", "Ulla"] },
  { text: "Brukare 55-0412 vill byta kontaktperson från Jonas till Amira. Anhörig: son Peter Ek, 072-111 22 33.", secrets: ["55-0412", "Jonas", "Amira", "Peter Ek", "072-111 22 33"] },
  { text: "Samtal 4 med Linnea R. Pat. beskriver ångest inför möten med exmaken Robert. Nästa besök 14/11 kl 09.", secrets: ["Linnea R", "Robert"] },
  { text: "Hej! Jag heter Fredrik Åström och hyr lägenheten på Kvarngatan 3, lgh 1101. Hyresavin för november saknas. Mitt kundnummer är 884412.", secrets: ["Fredrik Åström", "Kvarngatan 3", "884412"] },
  { text: "Störningsanmälan mot grannen i 1203 (familjen Nilsson). Anmälare: Carina Sjö, 1202.", secrets: ["Nilsson", "Carina Sjö"] },
  { text: "Bil: Volvo XC60, reg.nr WNR 229, mätarställning 84 120 km. Ägare Lisa Brandt, tel 0733-123456. Nästa service bokad hos Bilia Sisjön.", secrets: ["WNR 229", "Lisa Brandt", "0733-123456", "Bilia"] },
  { text: "Bokning QX7T2P: Eva och Mats Holmgren, SK1423 ARN–CPH 12 dec. Passnummer 98765432 (Eva). Specialkost: gluten.", secrets: ["Eva", "Mats Holmgren", "98765432"] },
  { text: "Vittnet, Ahmed Yusuf (född 870315-2391), såg en vit skåpbil (reg. KLM 456) lämna Torggatan 5 ca 23.40.", secrets: ["Ahmed Yusuf", "870315-2391", "KLM 456", "Torggatan 5"] },
  {
    text: "Projekt Nattugglan lanseras i Q2 om Styrelsen godkänner. Term sheet från Bergvik Ventures: 12 MSEK för 15 %. Kontakt: Johanna Ferm.",
    secrets: ["Nattugglan", "Bergvik Ventures", "Johanna Ferm"],
    wordList: ["Projekt Nattugglan"],
  },
  { text: "Kunden Lindex vill inte att kampanjen Vårkänsla nämns utanför byrån. Creative director: Nils Åberg.", secrets: ["Lindex", "Vårkänsla", "Nils Åberg"], wordList: ["Vårkänsla", "Lindex"] },
  { text: "Möte med Ulf på Sandvik: budget ca 2 MSEK, beslut i december. Konkurrent: Hexagon. Nästa steg: demo för Ulf och hans chef Karin.", secrets: ["Ulf", "Sandvik", "Hexagon", "Karin"] },
  {
    text: "PRESSMEDDELANDE (EMBARGO): Fjällbris AB presenterar Fjällbris Pro den 3 mars. Kontakt: presschef Maria Vik, maria.vik@fjallbris.se.",
    secrets: ["Fjällbris", "Maria Vik", "maria.vik@fjallbris.se"],
    wordList: ["Fjällbris Pro"],
  },
  {
    text: "Protokoll MBL §11: Arbetsgivaren (Nordqvist Bygg AB) och Byggnads region Väst. Närvarande: Lars Ek (AG), Siv Holm (Byggnads). Varsel om 14 tjänster.",
    secrets: ["Nordqvist Bygg", "Lars Ek", "Siv Holm"],
  },
  { text: "Patient: hunden Bella (labrador, 6 år), ägare Sofia Lund, 070-888 99 00, Bygatan 12, 523 30 Ulricehamn. Vaccination klar.", secrets: ["Sofia Lund", "070-888 99 00", "Bygatan 12", "523 30", "Ulricehamn"] },
  { text: "Bordsbokning fre 19:30, 6 pers, Daniel Öberg, 0709-12 34 56. Allergi: nötter (en gäst).", secrets: ["Daniel Öberg", "0709-12 34 56"] },
  { text: "Medlem 20231104-07 (Jenny Hägg) sade upp autogirot, bankkonto 1234-5 678 901 23-4.", secrets: ["Jenny Hägg", "1234-5 678 901 23-4"] },
  { text: "Ticket INC-20931: användare jlindqvist (Johan Lindqvist, IT-avd) kan inte logga in. IP 10.4.12.77, laptop LT-0442. Återställde lösenordet.", secrets: ["jlindqvist", "Johan Lindqvist"] },
  // The model misses the company in a signature block and takes "Senior" for the name.
  {
    text: "Hej Anna,\n\nBifogar avtalet.\n\nMed vänliga hälsningar\nErik Sundin\nSenior konsult, Prompt Agency\n070-123 45 67 | erik@promptagency.se\nSveavägen 10, 111 57 Stockholm",
    secrets: ["Anna", "Erik Sundin", "Prompt Agency", "070-123 45 67", "erik@promptagency.se", "Sveavägen 10", "111 57"],
    fails: true,
  },
  { text: "Närvarande: Anna Berg (ordf), Bo Lind, Cecilia Ahl, Dan Öst. Frånvarande: Eva Falk. §3 Beslut: Bo kontaktar Telia om avtalet.", secrets: ["Anna Berg", "Bo Lind", "Cecilia Ahl", "Dan Öst", "Eva Falk", "Telia"] },
  { text: "Anbud dnr KS 2024/118 från Hela Hem Fastigheter AB. Anbudssumma 4 320 000 kr. Kontaktperson: Ingrid Malm, ingrid@helahem.se.", secrets: ["Hela Hem", "Ingrid Malm", "ingrid@helahem.se"] },
  {
    text: "Läkarintyg: Pernilla Hjort, 19780523-1182, sjukskriven 50 % t.o.m. 2024-12-31. Diagnos F43.8. Läkare: Dr Amir Saleh, Vårdcentralen Kronan.",
    secrets: ["Pernilla Hjort", "19780523-1182", "Amir Saleh", "Kronan"],
  },
  { text: "Vår danska kollega Søren Kjærgaard och norska Åshild Bjørnstad kommer till Malmö på måndag. Kontakt: soren@firma.dk.", secrets: ["Søren Kjærgaard", "Åshild Bjørnstad", "Malmö", "soren@firma.dk"] },
  { text: "hej det är kalle pettersson igen ring mig på 0761234567 när du kan vi måste prata om lägenheten på drottninggatan 44", secrets: ["kalle pettersson", "0761234567", "drottninggatan 44"] },
  { text: "Namn : Birg1tta Lundqv1st  Pers.nr : 55O412-1234  Adress : Skolgatan 8 , 44l 30 Alingsås", secrets: ["Lundqv1st", "55O412-1234", "Skolgatan 8", "Alingsås"] },
  {
    text: "Hi team, Fjällbris signed the contract yesterday. Per Holm will lead the onboarding together with our CFO Ingrid Malm. Call Per at +46 70 999 88 77.",
    secrets: ["Fjällbris", "Per Holm", "Ingrid Malm", "+46 70 999 88 77", "Per"],
  },
];
