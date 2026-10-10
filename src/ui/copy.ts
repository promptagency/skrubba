// Every Swedish string in the UI, verbatim from docs/COPY.md. Change copy
// there first, then here.
import type { EntityType } from "../engine/index.ts";

export const COPY = {
  "app.name": "Skrubba",
  "app.title": "Skrubba. Gör texten ofarlig innan du klistrar in den i AI.",
  "app.tagline": "Namn, personnummer och hemligheter byts ut mot platshållare. Allt sker i din webbläsare.",
  "mode.scrub": "Skrubba",
  "mode.restore": "Byt tillbaka",
  "mode.key": "Nyckel",
  "editor.empty": "Klistra in text här. Den stannar i din webbläsare.",
  "editor.example": "Visa exempel",
  "gate.lead": "Skrubba laddar ner en liten svensk språkmodell till din webbläsare.",
  "gate.body": "Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den.",
  "panel.count": "{n} uppgifter",
  "panel.count.one": "1 uppgift",
  "panel.scrubAll": "Skrubba alla",
  "panel.keepAll": "Behåll alla",
  "panel.words": "Egna ord",
  "panel.wordsPlaceholder": "Kundnamn, projektnamn, produkter. Ett per rad.",
  "entity.scrub": "Skrubba",
  "entity.keep": "Behåll",
  "selection.scrub": "Skrubba markering",
  "action.copy": "Kopiera",
  "action.restore": "Byt tillbaka",
  "toast.copied": "Kopierat. {n} uppgifter skrubbade.",
  "toast.copiedRestored": "Kopierat. {n} uppgifter tillbaka.",
  "status.loading": "Laddar modell {pct} %",
  "status.ready": "Modell laddad",
  "status.rulesOnly":
    "Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv.",
  "status.trust": "Inget lämnar din dator",
  "restore.empty": "Klistra in svaret från AI här. Platshållarna byts tillbaka till de riktiga uppgifterna.",
  "restore.unmatched": "Hittade {found} i svaret. Menade du {placeholder}, alltså {value}?",
  "restore.accept": "Ja",
  "restore.reject": "Nej",
  "restore.unknown": "{found} finns inte i nyckeln. Kontrollera svaret själv.",
  "key.download": "Ladda ner nyckel",
  "key.upload": "Ladda upp nyckel",
  "key.clear": "Rensa allt",
  "key.downloadWarning": "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material.",
  "key.note": "Nyckeln finns bara i den här fliken. Stänger du fliken försvinner den.",
  "key.clearConfirm": "Text, uppgifter, egna ord och nyckel raderas. Vill du fortsätta?",
  "key.empty": "Nyckeln skapas när du kopierar en skrubbad text.",
  "key.uploadError": "Filen kunde inte läsas som en nyckel. Välj en fil som du har laddat ner från Skrubba.",
  "key.uploadConfirm": "Text, uppgifter, egna ord och nyckel ersätts av innehållet i filen. Vill du fortsätta?",
  "unload.warning": "Du har en nyckel som inte är nedladdad. Stänger du fliken går den förlorad.",
  "caveat.short": "Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Läs igenom innan du kopierar.",
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

export const EXAMPLE = {
  text: `Hej Karin,

Jag skriver angående Johan Lindqvist (850412-1234) på byrån. Han har varit sjukskriven sedan den 3 mars och vi behöver ta ställning till rehabilitering innan lanseringen av Projekt Havsvind i maj. Johans närmaste chef, Sara Holm, har haft två samtal med honom. Han bor på Storgatan 14 i Lerum och nås på 070-123 45 67 eller johan.lindqvist@exempel.se.

Kunden, Nordström Fastigheter, vet inget om detta ännu. Kan du hjälpa mig formulera ett brev till Försäkringskassan, och ett kort besked till kunden om att tidplanen kan påverkas?

Hälsningar
Micke`,
  wordList: ["Projekt Havsvind"],
};
