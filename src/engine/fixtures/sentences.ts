// Fictional sentences for the round-trip test. Each lists the values that must
// not survive masking.
export const SENTENCES: Array<{ text: string; secrets: string[] }> = [
  { text: "Johan Lindqvist har varit sjukskriven sedan augusti.", secrets: ["Johan Lindqvist"] },
  { text: "Ring Maria Ekström på 070-1740612 innan lunch.", secrets: ["Maria Ekström", "070-1740612"] },
  { text: "Personnummer 19850312-4471 ska stå på intyget.", secrets: ["19850312-4471"] },
  { text: "Hon bor på Vintergatan 12, 113 45 Stockholm.", secrets: ["Vintergatan 12", "113 45", "Stockholm"] },
  { text: "Skicka kopian till johan.lindqvist@exempelmail.se i dag.", secrets: ["johan.lindqvist@exempelmail.se"] },
  { text: "Kunden Fjällgren Outdoor AB har org.nr 556677-8899.", secrets: ["Fjällgren Outdoor AB", "556677-8899"] },
  { text: "Leverantören har org.nr 556147-9036 enligt fakturan.", secrets: ["556147-9036"] },
  { text: "Mötet med Anders Bergqvist hålls i Göteborg.", secrets: ["Anders Bergqvist", "Göteborg"] },
  { text: "Eva Lundgren redovisade avtalet med Atea.", secrets: ["Eva Lundgren", "Atea"] },
  { text: "hej jag heter lisa andersson och bor i västerås", secrets: ["lisa andersson", "västerås"] },
  { text: "min sambo jonas berg har redan ändrat adressen", secrets: ["jonas berg"] },
  { text: "Betala till bankgiro 5050-1055 senast fredag.", secrets: ["5050-1055"] },
  { text: "IBAN SE45 5000 0000 0583 9825 7466 gäller från mars.", secrets: ["SE45 5000 0000 0583 9825 7466"] },
  { text: "Fatima Al-Sayed förde protokollet.", secrets: ["Fatima Al-Sayed"] },
  { text: "Ahmed Hassan flyttar till kontoret i Malmö.", secrets: ["Ahmed Hassan", "Malmö"] },
  { text: "Nils Ek i Älmhult ringde om leveransen.", secrets: ["Nils Ek", "Älmhult"] },
  { text: "Samordningsnummer 19830761-2389 finns i ärendet.", secrets: ["19830761-2389"] },
  { text: "Petra Sundberg på Nordlo Konsult AB skickar avtalet.", secrets: ["Petra Sundberg", "Nordlo Konsult AB"] },
  { text: "Kontakta Sofia Brandt, marknadschef på Fjällgren.", secrets: ["Sofia Brandt", "Fjällgren"] },
  { text: "Erik Nyberg presenterar för kunden i Umeå den 12 november.", secrets: ["Erik Nyberg", "Umeå"] },
];
