// Every Swedish string in the UI, verbatim from docs/COPY.md. Change copy
// there first, then here.
import type { EntityType } from "../engine/index.ts";

export const COPY = {
  "app.name": "Skrubba",
  "app.title": "Skrubba. Gör texten ofarlig innan du klistrar in den i AI.",
  "app.tagline": "Namn, personnummer och hemligheter byts ut mot platshållare. Allt sker i din webbläsare.",
  "mode.scrub": "Skrubba",
  "mode.restore": "Avskrubba",
  "mode.key": "Kodnyckel",
  "editor.empty": "Klistra in text här eller släpp en textfil. Den stannar i din webbläsare.",
  "editor.example": "Visa exempel",
  "gate.lead": "Skrubba laddar ner en liten svensk språkmodell till din webbläsare.",
  "gate.body": "Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den.",
  "panel.count": "{n} uppgifter",
  "panel.count.one": "1 uppgift",
  "items.title": "Uppgifter",
  "panel.scrubAll": "Skrubba alla",
  "panel.keepAll": "Behåll alla",
  "panel.words": "Egna ord",
  "panel.wordsPlaceholder": "Kundnamn, projektnamn, produkter. Ett per rad.",
  "entity.scrub": "Skrubba",
  "entity.keep": "Behåll",
  "entity.scrubAction": "Skrubba uppgift",
  "entity.keepAction": "Behåll uppgift",
  "selection.scrub": "Skrubba markering",
  "action.copy": "Kopiera",
  "action.restore": "Avskrubba",
  "toast.copied": "Kopierat. {n} uppgifter skrubbade.",
  "toast.copiedRestored": "Kopierat. {n} uppgifter tillbaka.",
  "status.loading": "Laddar modell {pct} %",
  "status.ready": "Modell laddad",
  "status.rulesOnly":
    "Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv.",
  "status.trust": "Inget lämnar din dator",
  "restore.empty": "Klistra in svaret från AI här eller släpp en textfil.",
  "restore.unmatched": "Hittade {found} i svaret. Menade du {placeholder}, alltså {value}?",
  "restore.accept": "Ja",
  "restore.reject": "Nej",
  "restore.unknown": "{found} finns inte i kodnyckeln. Kontrollera svaret själv.",
  "key.col.placeholder": "Platshållare",
  "key.col.value": "Värde",
  "key.col.type": "Typ",
  "key.col.count": "Förekomster",
  "key.download": "Ladda ner kodnyckel",
  "key.upload": "Ladda upp kodnyckel",
  "key.clear": "Rensa allt",
  "key.downloadWarning": "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material.",
  "key.note": "Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den.",
  "key.clearConfirm": "Text, uppgifter, egna ord och kodnyckel raderas. Vill du fortsätta?",
  "key.empty": "Kodnyckeln skapas när du skrubbar en text.",
  "key.uploadError": "Filen kunde inte läsas som en kodnyckel. Välj en fil som du har laddat ner från Skrubba.",
  "key.uploadConfirm": "Text, uppgifter, egna ord och kodnyckel ersätts av innehållet i filen. Vill du fortsätta?",
  "unload.warning": "Du har en kodnyckel som inte är nedladdad. Stänger du fliken går den förlorad.",
  "drop.unsupported": "Bara textfiler (.txt och .md) går att släppa här. Kopiera texten ur andra filer och klistra in den.",
  "key.close": "Stäng",
  "footer.credits": "Bygger på maskera (MIT) av Hägvall Labs och KB-BERT (CC0) från Kungliga biblioteket. Öppen källkod från Prompt Agency.",
  "key.explainer": "Visar vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg.",
  "faq.open": "Vanliga frågor",
  "howto.open": "Så här funkar det",
  "caveat.short": "Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Läs igenom innan du kopierar.",
  "mode.switch": "Vad vill du göra?",
  "pane.scrubIn": "Din text",
  "pane.scrubOut": "Skrubbad text",
  "pane.restoreIn": "Svar från AI",
  "pane.restoreOut": "Avskrubbad text",
  "action.scrub": "Skrubba",
  "action.newText": "Ny text",
  "action.newTextConfirm":
    "Den nya texten får en ny kodnyckel. Svar på den förra texten går då inte att byta tillbaka, om du inte har laddat ner kodnyckeln. Vill du fortsätta?",
  "scrub.resultEmpty": "Tryck Skrubba så visas texten med platshållare här.",
  "restore.resultEmpty": "Tryck Avskrubba så visas svaret med de riktiga uppgifterna här.",
  "wrongMode.notice": "Texten innehåller platshållare som {found}. Är det svaret från AI?",
  "wrongMode.move": "Flytta till Avskrubba",
  "key.summary": "Kodnyckel · {n} platshållare",
  "summary.show": "Visa",
  "key.missing": "Den här fliken har ingen kodnyckel. Har du sparat en kan du ladda upp den, så byts platshållarna tillbaka.",
} as const;

export type CopyKey = keyof typeof COPY;

export function t(key: CopyKey, vars: Record<string, string | number> = {}): string {
  return COPY[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function countLabel(n: number): string {
  return n === 1 ? t("panel.count.one") : t("panel.count", { n });
}

export const TYPE_LABEL: Record<EntityType, string> = {
  NAMN: "Namn",
  PLATS: "Plats",
  ORGANISATION: "Organisation",
  ADRESS: "Adress",
  PERSONNUMMER: "Personnummer",
  SAMORDNINGSNUMMER: "Samordningsnummer",
  ORGANISATIONSNUMMER: "Organisationsnummer",
  TELEFON: "Telefon",
  EPOST: "E-post",
  POSTNUMMER: "Postnummer",
  LAGENHETSNUMMER: "Lägenhetsnummer",
  BANKGIRO: "Bankgiro",
  PLUSGIRO: "Plusgiro",
  IBAN: "IBAN",
  KORTNUMMER: "Kortnummer",
  KONTONUMMER: "Kontonummer",
  IP_ADRESS: "IP-adress",
  URL: "Webbadress",
  JOURNALNUMMER: "Journalnummer",
  REGNUMMER: "Registreringsnummer",
  ORD: "Ord",
};

/** Colour group per type. Colour is never the only signal; labels are always available. */
export function typeGroup(type: EntityType): "name" | "place" | "org" | "word" | "number" {
  if (type === "NAMN") return "name";
  if (type === "PLATS" || type === "ADRESS") return "place";
  if (type === "ORGANISATION") return "org";
  if (type === "ORD") return "word";
  return "number";
}

// Så här funkar det: the steps captioned in the video, also its text alternative. Verbatim from docs/COPY.md.
export const HOWTO = {
  title: "Så här funkar det",
  steps: [
    "Klistra in din text. Skrubba markerar namn, nummer och företag.",
    "Klicka på en markering för att behålla ordet. Det får en ram i stället för färg.",
    "Under rutan ser du vad som hittades. Visa öppnar hela listan.",
    "Tryck Skrubba. Uppgifterna byts mot platshållare som [NAMN_2].",
    "Kopiera texten och klistra in den i valfri AI-tjänst.",
    "Kodnyckeln visar vilken platshållare som står för vad.",
    "Byt till Avskrubba och klistra in svaret från AI.",
    "Tryck Avskrubba. De riktiga uppgifterna kommer tillbaka.",
  ],
};

// Vanliga frågor, verbatim from docs/COPY.md.
export const FAQ = {
  title: "Vanliga frågor",
  items: [
    {
      q: "Vad händer med min text?",
      a: "Texten går igenom regler och en liten svensk språkmodell som laddas ner till din webbläsare första gången. Namn, personnummer, adresser och företag byts ut mot platshållare som [NAMN_1]. Dina egna ord, som kundnamn och projektnamn, byts ut på samma sätt. Du kopierar den skrubbade texten till valfri AI-tjänst och klistrar sedan in svaret här för att byta tillbaka.",
    },
    {
      q: "Hur kan jag kontrollera att inget skickas?",
      a: "Öppna webbläsarens utvecklarverktyg, fliken Nätverk, och klistra in en text. Inga anrop går till någon annan adress än den här sidan. Efter första besöket fungerar Skrubba även utan internet. Koden är öppen och går att läsa på GitHub.",
    },
    {
      q: "Vad gör Skrubba inte?",
      a: "Skrubba hittar inte allt, särskilt inte beskrivningar som pekar ut någon utan att nämna namnet. Läs alltid igenom innan du kopierar. En text med platshållare är inte anonym i lagens mening så länge kodnyckeln finns, så ansvaret för vad du delar är fortfarande ditt. Skrubba gör det bara mycket mindre riskabelt.",
    },
    {
      q: "Vad är kodnyckeln?",
      a: "En lista över vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. Den behövs för att byta tillbaka i svaret. Den är ingen krypteringsnyckel och låser inget. Den som har filen kan läsa de riktiga uppgifterna, så spara den som känsligt material.",
    },
  ],
};

export const EXAMPLE = {
  text: `Hej Karin,

Jag skriver angående Johan Lindqvist (850412-1234) på byrån. Han har varit sjukskriven sedan den 3 mars och vi behöver ta ställning till rehabilitering innan lanseringen av Projekt Havsvind i maj. Johans närmaste chef, Sara Holm, har haft två samtal med honom. Han bor på Storgatan 14 i Lerum och nås på 070-123 45 67 eller johan.lindqvist@exempel.se.

Kunden, Nordström Fastigheter, vet inget om detta ännu. Kan du hjälpa mig formulera ett brev till Försäkringskassan, och ett kort besked till kunden om att tidplanen kan påverkas?

Hälsningar
Micke`,
  wordList: ["Projekt Havsvind"],
};
