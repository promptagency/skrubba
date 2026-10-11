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
| mode.restore | Avskrubba |
| mode.key | Kodnyckel |
| editor.empty | Klistra in text här eller släpp en textfil. Den stannar i din webbläsare. |
| editor.example | Visa exempel |
| gate.lead | Skrubba laddar ner en liten svensk språkmodell till din webbläsare. |
| gate.body | Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den. |
| panel.count | {n} uppgifter |
| panel.count.one | 1 uppgift |
| items.title | Uppgifter |
| panel.scrubAll | Skrubba alla |
| panel.keepAll | Behåll alla |
| panel.words | Egna ord |
| panel.wordsPlaceholder | Kundnamn, projektnamn, produkter. Ett per rad. |
| entity.scrub | Skrubba |
| entity.keep | Behåll |
| entity.scrubAction | Skrubba uppgift |
| entity.keepAction | Behåll uppgift |
| selection.scrub | Skrubba markering |
| action.copy | Kopiera |
| action.restore | Avskrubba |
| toast.copied | Kopierat. {n} uppgifter skrubbade. |
| toast.copiedRestored | Kopierat. {n} uppgifter tillbaka. |
| status.loading | Laddar modell {pct} % |
| status.ready | Modell laddad |
| status.rulesOnly | Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv. |
| status.trust | Inget lämnar din dator |
| restore.empty | Klistra in svaret från AI här eller släpp en textfil. |
| restore.unmatched | Hittade {found} i svaret. Menade du {placeholder}, alltså {value}? |
| restore.accept | Ja |
| restore.reject | Nej |
| restore.unknown | {found} finns inte i kodnyckeln. Kontrollera svaret själv. |
| key.col.placeholder | Platshållare |
| key.col.value | Värde |
| key.col.type | Typ |
| key.col.count | Förekomster |
| key.download | Ladda ner kodnyckel |
| key.upload | Ladda upp kodnyckel |
| key.clear | Rensa allt |
| key.downloadWarning | Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material. |
| key.note | Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den. |
| key.clearConfirm | Text, uppgifter, egna ord och kodnyckel raderas. Vill du fortsätta? |
| key.empty | Kodnyckeln skapas när du skrubbar en text. |
| key.uploadError | Filen kunde inte läsas som en kodnyckel. Välj en fil som du har laddat ner från Skrubba. |
| key.uploadConfirm | Text, uppgifter, egna ord och kodnyckel ersätts av innehållet i filen. Vill du fortsätta? |
| unload.warning | Du har en kodnyckel som inte är nedladdad. Stänger du fliken går den förlorad. |
| drop.unsupported | Bara textfiler (.txt och .md) går att släppa här. Kopiera texten ur andra filer och klistra in den. |
| key.close | Stäng |
| footer.credits | Bygger på maskera (MIT) av Hägvall Labs och KB-BERT (CC0) från Kungliga biblioteket. Öppen källkod från Prompt Agency. |
| key.explainer | Visar vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. |
| faq.open | Vanliga frågor |
| howto.open | Så här funkar det |
| caveat.short | Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Läs igenom innan du kopierar. |
| mode.switch | Vad vill du göra? |
| pane.scrubIn | Din text |
| pane.scrubOut | Skrubbad text |
| pane.restoreIn | Svar från AI |
| pane.restoreOut | Avskrubbad text |
| action.scrub | Skrubba |
| action.newText | Ny text |
| scrub.resultEmpty | Tryck Skrubba så visas texten med platshållare här. |
| restore.resultEmpty | Tryck Avskrubba så visas svaret med de riktiga uppgifterna här. |
| wrongMode.notice | Texten innehåller platshållare som {found}. Är det svaret från AI? |
| wrongMode.move | Flytta till Avskrubba |
| key.summary | Kodnyckel · {n} platshållare |
| summary.show | Visa |
| key.missing | Den här fliken har ingen kodnyckel. Har du sparat en kan du ladda upp den, så byts platshållarna tillbaka. |

## Att granska

Ändrat eller nytt 2026-10-10 för layouten med två kort (Skrubba och Avskrubba). Ägaren granskar ordvalen.

- `mode.restore` och `action.restore`: "Byt tillbaka" blev "Avskrubba", som i skissen.
- `editor.empty` och `restore.empty`: nämner att man kan släppa en textfil.
- `drop.unsupported`: när någon släpper en fil som inte är .txt eller .md.
- `key.close`: stänger nyckelkortet.
- `footer.credits`: sidfoten.

Ändrat 2026-10-10, andra omgången:

- "Nyckel" heter nu "Kodnyckel" överallt, så att ingen tror att det är en krypteringsnyckel. Kodnyckel är det vedertagna ordet för listan som kopplar koder till riktiga personer. Berörda: `mode.key`, `key.none`, `key.download`, `key.upload`, `key.note`, `key.empty`, `key.uploadError`, `key.uploadConfirm`, `key.clearConfirm`, `unload.warning`, `restore.unknown`. Filen heter `skrubba-kodnyckel-ÅÅÅÅ-MM-DD.json`.
- `key.explainer`: ny, vid knappen och överst i kodnyckelfönstret.
- `faq.open`: knappen "Vanliga frågor" ersätter "?".
- Sidan "Så funkar Skrubba" är nu fönstret "Vanliga frågor". De tre styckena är omskrivna till frågor med samma svar, och frågan "Vad är kodnyckeln?" är ny.

Ändrat 2026-10-10, tredje omgången. Skrubba och Avskrubba är två lägen som man väljer överst. Knappen mellan rutorna gör jobbet och resultatet visas i högra rutan, där Kopiera dyker upp.

- `mode.switch`: osynlig etikett för lägesväljaren, läses upp av skärmläsare.
- `pane.scrubIn`, `pane.scrubOut`, `pane.restoreIn`, `pane.restoreOut`: små rubriker ovanför rutorna.
- `action.scrub`: knappen mellan rutorna i läget Skrubba.
- `scrub.resultEmpty`, `restore.resultEmpty`: högra rutan innan knappen är tryckt.
- `wrongMode.notice`, `wrongMode.move`: när någon klistrar in ett svar med platshållare i läget Skrubba.
- `key.empty`: kodnyckeln skapas nu när man trycker Skrubba, inte när man kopierar.
- `restore.empty`: andra meningen flyttade till `restore.resultEmpty`.

Ändrat 2026-10-10, fjärde omgången. Kodnyckeln syns inte längre överst. Den visas där den behövs.

- `key.link`: länken bredvid Kopiera när fliken har en kodnyckel, öppnar kodnyckelfönstret.
- `key.missing`: i läget Avskrubba när fliken saknar kodnyckel, med knappen `key.upload` bredvid.
- `key.none` är borttagen.
- `key.explainer` visas bara överst i kodnyckelfönstret.

Ändrat 2026-10-11. Listan med uppgifter ligger inte längre under rutan. Antalet under rutan är en länk som öppnar listan i ett fönster, som kodnyckeln.

- `items.title`: rubriken på fönstret med uppgifterna.

Ändrat 2026-10-11, andra omgången. Länkarna "13 uppgifter" och kodnyckeln var för lätta att missa. De är nu en remsa med en prick per sorts uppgift, antalet och "Visa ›".

- `summary.show`: "Visa" till höger i båda remsorna.
- `key.summary`: ersätter `key.link` ("Kodnyckel ({n})").

Ändrat 2026-10-11, tredje omgången. Knappen på varje rad i fönstret Uppgifter visade läget ("Skrubba") men gjorde tvärtom när man tryckte. Nu säger knappen vad som händer.

- `entity.keepAction`: knappen på en rad som skrubbas.
- `entity.scrubAction`: knappen på en rad som behålls.
- `entity.scrub` och `entity.keep` finns kvar som läget i radens namn för skärmläsare och i tipset över markeringar.

Nytt 2026-10-11. Länken "Så här funkar det" efter Vanliga frågor öppnar en film.

- `howto.open`: länken, och rubriken på fönstret.
- Stegen under "Så här funkar det" är textremsorna i filmen. Ändras de måste filmen spelas in igen.
- `panel.count`, `panel.count.one`: samma text som förut, nu som länk utan pil.

Nytt 2026-10-11. Länken "Ny text" under knappen mellan rutorna börjar om med en ny text. Den tömmer rutorna men behåller egna ord och kodnyckeln, så att svar på tidigare texter fortfarande kan avskrubbas. Ingen fråga först, eftersom inget går förlorat. "Rensa allt" i kodnyckeln tar fortfarande bort allt.

- `action.newText`: länken.

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

## Så här funkar det

Fönstret med filmen. Stegen är textremsorna i filmen och läses också upp av skärmläsare.

1. Klistra in din text. Skrubba markerar namn, nummer och företag.
2. Klicka på en markering för att behålla ordet. Det får en ram i stället för färg.
3. Under rutan ser du vad som hittades. Visa öppnar hela listan.
4. Tryck Skrubba. Uppgifterna byts mot platshållare som [NAMN_1].
5. Kopiera texten och klistra in den i valfri AI-tjänst.
6. Kodnyckeln visar vilken platshållare som står för vad.
7. Byt till Avskrubba och klistra in svaret från AI.
8. Tryck Avskrubba. De riktiga uppgifterna kommer tillbaka.

## Vanliga frågor

Öppnas som ett fönster ovanpå sidan, från knappen "Vanliga frågor" uppe till höger och från "Inget lämnar din dator" i sidfoten. Rubriken är "Vanliga frågor". Varje fråga är en underrubrik med svaret under.

### Vad händer med min text?

Texten går igenom regler och en liten svensk språkmodell som laddas ner till din webbläsare första gången. Namn, personnummer, adresser och företag byts ut mot platshållare som [NAMN_1]. Dina egna ord, som kundnamn och projektnamn, byts ut på samma sätt. Du kopierar den skrubbade texten till valfri AI-tjänst och klistrar sedan in svaret här för att byta tillbaka.

### Hur kan jag kontrollera att inget skickas?

Öppna webbläsarens utvecklarverktyg, fliken Nätverk, och klistra in en text. Inga anrop går till någon annan adress än den här sidan. Efter första besöket fungerar Skrubba även utan internet. Koden är öppen och går att läsa på GitHub.

### Vad gör Skrubba inte?

Skrubba hittar inte allt, särskilt inte beskrivningar som pekar ut någon utan att nämna namnet. Läs alltid igenom innan du kopierar. En text med platshållare är inte anonym i lagens mening så länge kodnyckeln finns, så ansvaret för vad du delar är fortfarande ditt. Skrubba gör det bara mycket mindre riskabelt.

### Vad är kodnyckeln?

En lista över vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. Den behövs för att byta tillbaka i svaret. Den är ingen krypteringsnyckel och låser inget. Den som har filen kan läsa de riktiga uppgifterna, så spara den som känsligt material.
