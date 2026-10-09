# COPY.md – svensk text i Skrubba

Skrubba används av den som jobbar med andras personuppgifter eller andras hemligheter. HR-chefen, rekryteraren, projektledaren på byrån, konsulten, säljaren. Texten ska kännas som ett verktyg en kollega visade, inte som ett system.

## Regler

- Skriv som till en kollega. Korta meningar, aktiv form, du-tilltal.
- Inga kolon och inga tankstreck i löpande text. Skriv om meningen i stället.
- Versal bara i första ordet i rubriker och meningar, i egennamn och i förkortningar. Aldrig Versaler På Varje Ord.
- "Skrubba" är verbet i knappar och etiketter. "Anonymisera" och "personuppgifter" används i sidtitel, rubriker och hjälptext, eftersom det är vad folk söker på. Säg aldrig att tjänsten anonymiserar i juridisk mening, se förbehållet.
- Säg "uppgifter", inte "entiteter" eller "PII". Säg "platshållare", inte "token". Säg "egna ord", inte "ordlista" eller "gazetteer".
- Säg "din dator" och "din webbläsare", inte "klienten" eller "lokalt".
- Inga utropstecken. Ingen entusiasm. Lugn och saklig, med lite värme.
- Felmeddelanden säger vad som hände och vad man kan göra, i den ordningen.

## Fasta strängar

| Nyckel | Text |
|---|---|
| app.name | Skrubba |
| app.title | Skrubba. Gör texten ofarlig innan du klistrar in den i AI. |
| app.tagline | Namn, personnummer och hemligheter byts ut mot platshållare. Allt sker i din webbläsare. |
| mode.scrub | Skrubba |
| mode.restore | Byt tillbaka |
| mode.key | Nyckel |
| editor.empty | Klistra in text här. Den stannar i din webbläsare. |
| editor.example | Visa exempel |
| gate.lead | Skrubba laddar ner en liten svensk språkmodell till din webbläsare. |
| gate.body | Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den. |
| panel.count | {n} uppgifter |
| panel.count.one | 1 uppgift |
| panel.scrubAll | Skrubba alla |
| panel.keepAll | Behåll alla |
| panel.words | Egna ord |
| panel.wordsPlaceholder | Kundnamn, projektnamn, produkter. Ett per rad. |
| entity.scrub | Skrubba |
| entity.keep | Behåll |
| selection.scrub | Skrubba markering |
| action.copy | Kopiera |
| action.restore | Byt tillbaka |
| toast.copied | Kopierat. {n} uppgifter skrubbade. |
| toast.copiedRestored | Kopierat. {n} uppgifter tillbaka. |
| status.loading | Laddar modell {pct} % |
| status.ready | Modell laddad |
| status.rulesOnly | Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv. |
| status.trust | Inget lämnar din dator |
| restore.unmatched | Hittade {found} i svaret. Menade du {placeholder}, alltså {value}? |
| restore.accept | Ja |
| restore.reject | Nej |
| restore.unknown | {found} finns inte i nyckeln. Kontrollera svaret själv. |
| key.download | Ladda ner nyckel |
| key.upload | Ladda upp nyckel |
| key.clear | Rensa allt |
| key.downloadWarning | Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material. |
| key.note | Nyckeln finns bara i den här fliken. Stänger du fliken försvinner den. |
| key.clearConfirm | Text, uppgifter, egna ord och nyckel raderas. Vill du fortsätta? |
| unload.warning | Du har en nyckel som inte är nedladdad. Stänger du fliken går den förlorad. |
| caveat.short | Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Läs igenom innan du kopierar. |

## Typer

| Intern typ | Visas som |
|---|---|
| NAMN | Namn |
| PLATS | Plats |
| ORGANISATION | Organisation |
| ADRESS | Adress |
| PERSONNUMMER | Personnummer |
| SAMORDNINGSNUMMER | Samordningsnummer |
| ORGANISATIONSNUMMER | Organisationsnummer |
| TELEFON | Telefon |
| EPOST | E-post |
| POSTNUMMER | Postnummer |
| LAGENHETSNUMMER | Lägenhetsnummer |
| BANKGIRO | Bankgiro |
| PLUSGIRO | Plusgiro |
| IBAN | IBAN |
| KORTNUMMER | Kortnummer |
| KONTONUMMER | Kontonummer |
| IP_ADRESS | IP-adress |
| URL | Webbadress |
| JOURNALNUMMER | Journalnummer |
| REGNUMMER | Registreringsnummer |
| ORD | Ord |

## Exempeltext (påhittad, visas via "Visa exempel")

Visar båda sorters uppgifter i samma text. Personuppgifter som modellen hittar, och ett projektnamn som kräver egna ord. "Projekt Havsvind" ska ligga förifyllt under Egna ord när exemplet laddas, så att användaren ser hur det fungerar.

> Hej Karin,
>
> Jag skriver angående Johan Lindqvist (850412-1234) på byrån. Han har varit sjukskriven sedan den 3 mars och vi behöver ta ställning till rehabilitering innan lanseringen av Projekt Havsvind i maj. Johans närmaste chef, Sara Holm, har haft två samtal med honom. Han bor på Storgatan 14 i Lerum och nås på 070-123 45 67 eller johan.lindqvist@exempel.se.
>
> Kunden, Nordström Fastigheter, vet inget om detta ännu. Kan du hjälpa mig formulera ett brev till Försäkringskassan, och ett kort besked till kunden om att tidplanen kan påverkas?
>
> Hälsningar
> Micke

## Sidan /sa-funkar-det

Rubrik: Så funkar Skrubba

Tre stycken, inte fler.

1. **Vad som händer.** Texten går igenom regler och en liten svensk språkmodell som laddas ner till din webbläsare första gången. Namn, personnummer, adresser och företag byts ut mot platshållare som [NAMN_1]. Dina egna ord, som kundnamn och projektnamn, byts ut på samma sätt. Du kopierar den skrubbade texten till valfri AI-tjänst och klistrar sedan in svaret här för att byta tillbaka.

2. **Så kontrollerar du det själv.** Öppna webbläsarens utvecklarverktyg, fliken Nätverk, och klistra in en text. Inga anrop går till någon annan adress än den här sidan. Efter första besöket fungerar Skrubba även utan internet. Koden är öppen och går att läsa på GitHub.

3. **Det Skrubba inte gör.** Skrubba hittar inte allt, särskilt inte beskrivningar som pekar ut någon utan att nämna namnet. Läs alltid igenom innan du kopierar. En text med platshållare är inte anonym i lagens mening så länge nyckeln finns, så ansvaret för vad du delar är fortfarande ditt. Skrubba gör det bara mycket mindre riskabelt.

Sist på sidan: Skrubba bygger på maskera (MIT) av Hägvall Labs och KB-BERT (CC0) från Kungliga biblioteket. Öppen källkod från Prompt Agency, länk till repot.
