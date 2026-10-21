// Fictional texts that are hard to mask, for the leak count in
// hardCases.model.test.ts. Each lists the values that must not survive
// masking (matched case-insensitively as substrings, so keep them distinctive)
// and the word list the user would have typed, if any.
export interface HardCase {
  text: string;
  secrets: string[];
  wordList?: string[];
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
];
