// Every Swedish string in the UI, verbatim from docs/COPY.md. Change copy
// there first, then here.
import { APP_NAME } from "../config.ts";
import type { EntityType } from "../engine/Masker.ts";

export const COPY = {
  "app.name": APP_NAME,
  "app.title": "Skrubba. Gör texten säkrare att klistra in i AI.",
  "app.tagline": "Namn, personnummer och känsliga uppgifter byts ut mot platshållare. Allt sker i din webbläsare.",
  "mode.scrub": "Skrubba",
  "mode.restore": "Avskrubba",
  "mode.key": "Kodnyckel",
  "editor.empty": "Klistra in text här eller släpp ett dokument. Det stannar i din webbläsare och inget laddas upp.",
  "editor.example": "Visa exempel",
  "gate.lead": "Skrubba laddar ner en liten svensk språkmodell till din webbläsare.",
  "gate.body": "Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den. Efter det fungerar Skrubba utan internet.",
  "panel.count": "{n} uppgifter",
  "panel.count.one": "1 uppgift",
  "items.title": "Uppgifter",
  "panel.scrubAll": "Skrubba alla",
  "panel.keepAll": "Behåll alla",
  "panel.words": "Egna ord",
  "panel.wordsPlaceholder": "Kundnamn, projektnamn, produkter. Ett per rad.",
  "entity.tip.scrub": "{type} blir {placeholder}. Klicka för att behålla.",
  "entity.tip.keep": "{type} behålls. Klicka för att skrubba.",
  "entity.row": "{value}, {type}, {count}, {state}",
  "entity.count": "{n} gånger",
  "entity.count.one": "1 gång",
  "entity.state.scrub": "skrubbas",
  "entity.state.keep": "behålls",
  "entity.scrubAction": "Skrubba uppgift",
  "entity.keepAction": "Behåll uppgift",
  "maybe.heading": "Kanske missat · {n} ord",
  "maybe.heading.one": "Kanske missat · 1 ord",
  "maybe.lead": "Ord med stor bokstav som inte döljs. Är något ett namn eller känsligt trycker du Skrubba ord.",
  "maybe.scrub": "Skrubba ord",
  "maybe.row": "{value}, {count}",
  "words.save": "Spara ord",
  "words.load": "Hämta ord",
  "words.hint": "Spara listan som en textfil och hämta den nästa gång. Inget sparas i webbläsaren.",
  "toast.wordsLoaded": "{n} ord hämtade.",
  "toast.wordsLoaded.one": "1 ord hämtat.",
  "toast.wordsNone": "Inga nya ord i filen.",
  "words.loadFailed": "Filen gick inte att läsa. Välj en textfil med ett ord per rad.",
  "copy.instructionToggle": "Lägg till en rad som ber AI:n behålla platshållarna",
  "copy.instruction": "Texten nedan har platshållare som [NAMN_1]. Behåll dem exakt som de står i ditt svar.",
  "selection.scrub": "Skrubba markering",
  "action.copy": "Kopiera",
  "action.restore": "Avskrubba",
  "toast.copied": "Kopierat. {n} uppgifter skrubbade.",
  "toast.copiedRestored": "Kopierat. {n} uppgifter tillbaka.",
  "toast.copyFailed": "Texten kunde inte kopieras. Markera den i rutan till höger och kopiera den själv.",
  "status.loading": "Laddar modell {pct} %",
  "status.ready": "Modell laddad",
  "status.rulesOnly":
    "Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv.",
  "status.trust": "Allt sker på din dator",
  "status.scanning": "Letar efter namn och platser … {pct} %",
  "status.scanningStart": "Letar efter namn och platser",
  "action.scrubbing": "Skrubbar … {pct} %",
  "toast.pressCopy": "Texten är skrubbad. Tryck Kopiera för att kopiera den.",
  "toast.modelFailed": "Modellen svarade inte. Försök igen, eller ladda om sidan.",
  "restore.empty": "Klistra in svaret från AI här eller släpp ett dokument med svaret.",
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
  "key.downloadWarning": "Filen innehåller riktiga uppgifter. Spara den säkert.",
  "key.note": "Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den.",
  "key.clearConfirm": "Text, uppgifter, egna ord och kodnyckel raderas. Vill du fortsätta?",
  "key.empty": "Kodnyckeln skapas när du skrubbar en text.",
  "key.uploadError": "Filen kunde inte läsas som en kodnyckel. Välj en fil som du har laddat ner från Skrubba.",
  "key.uploadConfirm": "Text, uppgifter, egna ord och kodnyckel ersätts av innehållet i filen. Vill du fortsätta?",
  "unload.warning": "Du har en kodnyckel som inte är nedladdad. Stänger du fliken går den förlorad.",
  "file.choose": "Välj fil",
  "file.title": "Läs in dokument",
  "file.reading": "Läser dokumentet …",
  "file.readingPage": "Läser sida {page} av {pages} …",
  "file.words": "{n} ord",
  "file.pages": "{n} sidor",
  "file.pages.one": "1 sida",
  "file.slides": "{n} bilder",
  "file.slides.one": "1 bild",
  "file.sheets": "{n} blad",
  "file.replaces": "Texten som står i rutan nu ersätts.",
  "file.preview": "Början av texten",
  "file.use": "Använd texten",
  "file.cancel": "Avbryt",
  "file.note.hidden": "Kommentarer och dolda delar togs inte med.",
  "file.note.attachments": "Bilagor togs inte med.",
  "file.note.images": "Bilder och text i bilder togs inte med.",
  "file.note.firstOnly": "Bara en fil i taget. Den första lästes.",
  "file.error.unsupported":
    "Den här filtypen går inte att läsa. Spara dokumentet som PDF eller Word och försök igen, eller kopiera texten och klistra in den.",
  "file.error.encrypted": "Dokumentet är lösenordsskyddat. Ta bort lösenordet och försök igen.",
  "file.error.noText":
    "PDF:en innehåller bara bilder, ingen text. Kör textigenkänning (OCR) på den först, eller kopiera texten och klistra in den.",
  "file.error.empty": "Dokumentet innehåller ingen text.",
  "file.error.tooLarge": "Dokumentet är för stort. Dela upp det och läs in en del i taget.",
  "file.error.timeout": "Det tog för lång tid att läsa dokumentet. Försök igen, eller kopiera texten och klistra in den.",
  "file.error.failed":
    "Dokumentet gick inte att läsa. Det kan vara skadat. Öppna det och spara det på nytt, eller kopiera texten och klistra in den.",
  "file.format.pdf": "PDF",
  "file.format.docx": "Word",
  "file.format.doc": "Word",
  "file.format.odt": "OpenDocument",
  "file.format.rtf": "RTF",
  "file.format.msg": "Outlook-mejl",
  "file.format.eml": "E-post",
  "file.format.html": "Webbsida",
  "file.format.csv": "CSV",
  "file.format.xlsx": "Excel",
  "file.format.pptx": "PowerPoint",
  "file.format.txt": "Text",
  "file.format.md": "Markdown",
  "read.from": "Från",
  "read.to": "Till",
  "read.cc": "Kopia",
  "read.subject": "Ämne",
  "read.date": "Datum",
  "read.sheet": "Blad: {name}",
  "read.slide": "Bild {n}",
  "key.close": "Stäng",
  "footer.byline": "{app} av {author} ({agency}).",
  "footer.author": "Micke Quick",
  "footer.agency": "Prompt Agency",
  "footer.maskera": "maskera",
  "footer.kbbert": "KB-BERT",
  "footer.github": "Github",
  "footer.version": "Version {version}",
  "footer.whatsNew": "Vad är nytt i version {version}",
  "footer.credits": "Bygger på {maskera} (MIT) av Hägvall Labs och {kbbert} (CC0) från Kungliga biblioteket. Källkod till Skrubba finns på {github}.",
  "key.explainer": "Visar vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg.",
  "faq.open": "Vanliga frågor",
  "howto.open": "Så här funkar det",
  "feedback.link": "Blev något fel? Berätta.",
  "feedback.subject": "Fel i Skrubba {version}",
  "feedback.body":
    "Skriv en påhittad mening där Skrubba gör samma fel, missar en uppgift eller döljer något som borde stå kvar. Använd påhittade namn och nummer i samma form som de riktiga, till exempel \"Ring Kalle Persson om kundnummer AB-1234-567.\" Testa gärna meningen i Skrubba först, så vet du att den visar felet. Berätta också vilken sorts text det var, som ett mejl eller ett protokoll. Skicka inte den riktiga texten: den innehåller andras uppgifter, och en påhittad mening visar felet lika bra.",
  "caveat.short": "Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Kontrollera dina val innan du kopierar.",
  "mode.switch": "Vad vill du göra?",
  "pane.scrubIn": "Din text",
  "pane.scrubOut": "Skrubbad text",
  "pane.restoreIn": "Svar från AI",
  "pane.restoreOut": "Avskrubbad text",
  "action.scrub": "Skrubba",
  "action.newText": "Ny text",
  "action.newTextConfirm":
    "Den nya texten får en ny kodnyckel. Svar på den förra texten går då inte att avskrubba, om du inte har laddat ner kodnyckeln. Vill du fortsätta?",
  "scrub.resultEmpty": "Tryck Skrubba så visas texten med platshållare här.",
  "restore.resultEmpty": "Tryck Avskrubba så visas svaret med de riktiga uppgifterna här.",
  "wrongMode.notice": "Texten innehåller platshållare som {found}. Är det svaret från AI?",
  "wrongMode.move": "Flytta till Avskrubba",
  "paste.joined": "Radbrytningar mitt i meningar är borttagna.",
  "paste.undo": "Ångra",
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

/** A row's name for screen readers: "Johan Lindqvist, namn, 3 gånger, skrubbas". */
export function rowLabel(row: { value: string; type: EntityType; count: number; active: boolean }): string {
  const label = TYPE_LABEL[row.type];
  // Lower case mid-sentence, but not an abbreviation ("IBAN", "IP-adress").
  const type = /^\p{Lu}\p{Ll}/u.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
  return t("entity.row", {
    value: row.value,
    type,
    count: row.count === 1 ? t("entity.count.one") : t("entity.count", { n: row.count }),
    state: row.active ? t("entity.state.scrub") : t("entity.state.keep"),
  });
}

export const TYPE_LABEL: Record<EntityType, string> = {
  NAMN: "Namn",
  FÖRNAMN: "Förnamn",
  EFTERNAMN: "Efternamn",
  DEL_ORGANISATION: "Del av namn",
  DEL_PLATS: "Del av namn",
  DEL_ORD: "Del av namn",
  PLATS: "Plats",
  ORGANISATION: "Organisation",
  ADRESS: "Adress",
  PERSONNUMMER: "Personnummer",
  SAMORDNINGSNUMMER: "Samordningsnummer",
  FÖDELSEDATUM: "Födelsedatum",
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
  REFERENSNUMMER: "Referensnummer",
  REGNUMMER: "Registreringsnummer",
  ORD: "Ord",
};

/** Colour group per type. Colour is never the only signal; labels are always available. */
export function typeGroup(type: EntityType): "name" | "place" | "org" | "word" | "number" {
  if (type === "NAMN" || type === "FÖRNAMN" || type === "EFTERNAMN") return "name";
  if (type === "PLATS" || type === "DEL_PLATS" || type === "ADRESS") return "place";
  if (type === "ORGANISATION" || type === "DEL_ORGANISATION") return "org";
  if (type === "ORD" || type === "DEL_ORD") return "word";
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
      a: "Din text går igenom fördefinierade regler samt en liten svensk språkmodell som laddas ner lokalt till din webbläsare första gången du besöker sajten. Namn, personnummer, adresser och företag byts ut mot platshållare som till exempel [NAMN_1]. Dina egna ord, som kundnamn och projektnamn, byts ut på samma sätt. Du kopierar den skrubbade texten och arbetar med den i valfri AI-tjänst. När du är klar så väljer du \"Avskrubba\". Klistra in din bearbetade text i rutan \"Avskrubba\", så avmaskeras dina uppgifter och ersätts med de riktiga uppgifterna.",
    },
    {
      q: "Vilka uppgifter hittar Skrubba?",
      a: "Namn, platser och organisationer hittas av språkmodellen. Personnummer, samordningsnummer, organisations- och momsnummer, telefonnummer, e-post, webbadresser, adresser, postnummer, bankuppgifter, kortnummer, registreringsnummer och kund-, avtals-, faktura- och referensnummer samt födelsedatum hittas med regler. Andra datum, belopp och vanliga ord döljs inte, eftersom AI:n ofta behöver dem för att svara. Är de känsliga lägger du till dem under Egna ord.",
    },
    {
      q: "Hur döljer jag något som Skrubba missade?",
      a: "Markera ordet i texten och tryck Skrubba markering, så döljs det överallt i texten. Ord som ska döljas varje gång, som kundnamn och projektnamn, skriver du under Egna ord, ett ord per rad. Vill du behålla något i klartext, som Skrubba har dolt, klickar du på markeringen. Listan kan du spara som en textfil med Spara ord och hämta nästa gång.",
    },
    {
      q: "Vad händer om AI:n ändrar platshållarna?",
      a: "När du kopierar den maskerade texten lägger Skrubba som standard till en rad överst som ber AI:n behålla platshållarna. Du kan avaktivera den funktionen genom att avbocka den under rutan med det maskerade resultatet. Skriver AI:n platshållaren på ett annat sätt, till exempel NAMN 1 i stället för [NAMN_1], frågar Skrubba om det är samma innan uppgiften sätts tillbaka. En platshållare som inte finns i kodnyckeln lämnas som den är och visas under svaret, så att du kan kontrollera den.",
    },
    {
      q: "Vad är kodnyckeln?",
      a: "En lista över vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. Den behövs för att avmaskera svaret. Den är ingen krypteringsnyckel och låser inget. Alla som har filen med kodnyckeln kan läsa de riktiga uppgifterna, så spara den så som du hade sparat känsligt material.",
    },
    {
      q: "Hur kan jag kontrollera att inget skickas?",
      a: "Enklast är att stänga av internet. Men du kan också öppna webbläsarens utvecklarverktyg, fliken Nätverk, och klistra sedan in en text i Skrubba. Du ser att inga anrop går till andra adresser eller sidor på internet. Det enda anrop som är utanför grundtjänsten är en anonym besöksräkning som sker när sidan laddas. Inget anrop görs när du skrubbar eller avskrubbar. All kod är öppen och går att granska på Github. Allt är helt öppet och transparent.",
    },
    {
      q: "Vad gör Skrubba inte?",
      a: "Skrubba är inte ofelbart, särskilt för beskrivningar som pekar ut någon utan att nämna namnet. Läs alltid igenom innan du kopierar. En text som säger \"Enda kvinnan i Eslöv\" innebär att alla som är från Eslöv vet vem som antyds. En text med platshållare är inte anonym i lagens mening så länge kodnyckeln finns, så ansvaret för vad du delar är fortfarande ditt. Skrubba gör det bara mycket mindre riskabelt.",
    },
    {
      q: "Vilka AI-tjänster fungerar det med?",
      a: "Alla. Det här är ren text. Skrubba gör bara texten säkrare, så du kan klistra in den i ChatGPT, Claude, Copilot, Gemini eller vilken tjänst du vill.",
    },
    {
      q: "Kostar Skrubba något?",
      a: "Nej. Skrubba är gratis och har öppen källkod under MIT-licensen. Det finns inga konton och ingen reklam. Tjänsten kommer fortsatt vara helt gratis att använda. En diskret länk till utvecklaren och företaget bakom är det ni \"betalar\" för tjänsten.",
    },
    {
      q: "Räknar ni besökare?",
      a: "Ja, anonymt. När sidan laddas skickas ett besök till sidans egen adress, som skickar det vidare till Prompt Agencys egen Plausible-server i Finland. Plausible ser sidans adress, varifrån du kom, land, webbläsare och typ av enhet, men sätter inga cookies och sparar inte din IP-adress. Det du skriver, uppgifterna och kodnyckeln skickas aldrig. Har din webbläsare Do Not Track eller Global Privacy Control påslaget är du helt osynlig.",
    },
    {
      q: "Kan jag släppa in PDF och Word?",
      a: "Ja. Släpp filen på rutan eller tryck Välj fil. Skrubba läser PDF, Word, OpenDocument, RTF, Excel, PowerPoint, mejl som .eml och .msg, webbsidor och text i din webbläsare och lägger texten i rutan. Filen laddas inte upp till någon molntjänst och sparas inte. Kommentarer, dolda delar, bilagor och bilder tas inte med, och inte heller text i bilder. En skannad PDF utan text går inte att läsa.",
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
