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
| app.title | Skrubba. Gör texten säkrare att klistra in i AI. |
| app.tagline | Namn, personnummer och känsliga uppgifter byts ut mot platshållare. Allt sker i din webbläsare. |
| mode.scrub | Skrubba |
| mode.restore | Avskrubba |
| mode.key | Kodnyckel |
| editor.empty | Klistra in text här eller släpp ett dokument. Det stannar i din webbläsare och inget laddas upp. |
| editor.example | Visa exempel |
| gate.lead | Skrubba laddar ner en liten svensk språkmodell till din webbläsare. |
| gate.body | Det sker bara första gången. Sedan körs allt på din dator och inget du skriver lämnar den. Efter det fungerar Skrubba utan internet. |
| panel.count | {n} uppgifter |
| panel.count.one | 1 uppgift |
| items.title | Uppgifter |
| panel.scrubAll | Skrubba alla |
| panel.keepAll | Behåll alla |
| panel.words | Egna ord |
| panel.wordsPlaceholder | Kundnamn, projektnamn, produkter. Ett per rad. |
| entity.tip.scrub | {type} blir {placeholder}. Klicka för att behålla. |
| entity.tip.keep | {type} behålls. Klicka för att skrubba. |
| entity.row | {value}, {type}, {count}, {state} |
| entity.count | {n} gånger |
| entity.count.one | 1 gång |
| entity.state.scrub | skrubbas |
| entity.state.keep | behålls |
| entity.scrubAction | Skrubba uppgift |
| entity.keepAction | Behåll uppgift |
| selection.scrub | Skrubba markering |
| action.copy | Kopiera |
| action.restore | Avskrubba |
| toast.copied | Kopierat. {n} uppgifter skrubbade. |
| toast.copiedRestored | Kopierat. {n} uppgifter tillbaka. |
| toast.copyFailed | Texten kunde inte kopieras. Markera den i rutan till höger och kopiera den själv. |
| status.loading | Laddar modell {pct} % |
| status.ready | Modell laddad |
| status.rulesOnly | Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv. |
| status.trust | Allt sker på din dator |
| status.scanning | Letar efter namn och platser … {pct} % |
| status.scanningStart | Letar efter namn och platser |
| action.scrubbing | Skrubbar … {pct} % |
| toast.pressCopy | Texten är skrubbad. Tryck Kopiera för att kopiera den. |
| restore.empty | Klistra in svaret från AI här eller släpp ett dokument med svaret. |
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
| key.downloadWarning | Filen innehåller riktiga uppgifter. Spara den säkert. |
| key.note | Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den. |
| key.clearConfirm | Text, uppgifter, egna ord och kodnyckel raderas. Vill du fortsätta? |
| key.empty | Kodnyckeln skapas när du skrubbar en text. |
| key.uploadError | Filen kunde inte läsas som en kodnyckel. Välj en fil som du har laddat ner från Skrubba. |
| key.uploadConfirm | Text, uppgifter, egna ord och kodnyckel ersätts av innehållet i filen. Vill du fortsätta? |
| unload.warning | Du har en kodnyckel som inte är nedladdad. Stänger du fliken går den förlorad. |
| file.choose | Välj fil |
| file.title | Läs in dokument |
| file.reading | Läser dokumentet … |
| file.readingPage | Läser sida {page} av {pages} … |
| file.words | {n} ord |
| file.pages | {n} sidor |
| file.pages.one | 1 sida |
| file.slides | {n} bilder |
| file.slides.one | 1 bild |
| file.sheets | {n} blad |
| file.replaces | Texten som står i rutan nu ersätts. |
| file.preview | Början av texten |
| file.use | Använd texten |
| file.cancel | Avbryt |
| file.note.hidden | Kommentarer och dolda delar togs inte med. |
| file.note.attachments | Bilagor togs inte med. |
| file.note.images | Bilder och text i bilder togs inte med. |
| file.note.firstOnly | Bara en fil i taget. Den första lästes. |
| file.error.unsupported | Den här filtypen går inte att läsa. Spara dokumentet som PDF eller Word och försök igen, eller kopiera texten och klistra in den. |
| file.error.encrypted | Dokumentet är lösenordsskyddat. Ta bort lösenordet och försök igen. |
| file.error.noText | PDF:en innehåller bara bilder, ingen text. Kör textigenkänning (OCR) på den först, eller kopiera texten och klistra in den. |
| file.error.empty | Dokumentet innehåller ingen text. |
| file.error.tooLarge | Dokumentet är för stort. Dela upp det och läs in en del i taget. |
| file.error.timeout | Det tog för lång tid att läsa dokumentet. Försök igen, eller kopiera texten och klistra in den. |
| file.error.failed | Dokumentet gick inte att läsa. Det kan vara skadat. Öppna det och spara det på nytt, eller kopiera texten och klistra in den. |
| file.format.pdf | PDF |
| file.format.docx | Word |
| file.format.doc | Word |
| file.format.odt | OpenDocument |
| file.format.rtf | RTF |
| file.format.msg | Outlook-mejl |
| file.format.eml | E-post |
| file.format.html | Webbsida |
| file.format.csv | CSV |
| file.format.xlsx | Excel |
| file.format.pptx | PowerPoint |
| file.format.txt | Text |
| file.format.md | Markdown |
| read.from | Från |
| read.to | Till |
| read.cc | Kopia |
| read.subject | Ämne |
| read.date | Datum |
| read.sheet | Blad: {name} |
| read.slide | Bild {n} |
| key.close | Stäng |
| footer.byline | {app} av {author} ({agency}). |
| footer.author | Micke Quick |
| footer.agency | Prompt Agency |
| footer.credits | Bygger på {maskera} (MIT) av Hägvall Labs och {kbbert} (CC0) från Kungliga biblioteket. Källkod till Skrubba finns på {github}. |
| footer.maskera | maskera |
| footer.kbbert | KB-BERT |
| footer.github | Github |
| footer.version | Version {version} |
| footer.whatsNew | Vad är nytt i version {version} |
| key.explainer | Visar vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. |
| faq.open | Vanliga frågor |
| howto.open | Så här funkar det |
| feedback.link | Missade Skrubba något? Berätta. |
| feedback.subject | Skrubba missade något |
| feedback.body | Skriv en påhittad mening där Skrubba missar på samma sätt, med påhittade namn och nummer i samma form som de riktiga. Till exempel "Ring Kalle Persson om kundnummer AB-1234-567." Testa gärna meningen i Skrubba först, så vet du att den visar missen. Berätta också vilken sorts text det var, som ett mejl eller ett protokoll. Skicka inte den riktiga uppgiften eller din text. |
| caveat.short | Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Kontrollera dina val innan du kopierar. |
| mode.switch | Vad vill du göra? |
| pane.scrubIn | Din text |
| pane.scrubOut | Skrubbad text |
| pane.restoreIn | Svar från AI |
| pane.restoreOut | Avskrubbad text |
| action.scrub | Skrubba |
| action.newText | Ny text |
| action.newTextConfirm | Den nya texten får en ny kodnyckel. Svar på den förra texten går då inte att avskrubba, om du inte har laddat ner kodnyckeln. Vill du fortsätta? |
| scrub.resultEmpty | Tryck Skrubba så visas texten med platshållare här. |
| restore.resultEmpty | Tryck Avskrubba så visas svaret med de riktiga uppgifterna här. |
| wrongMode.notice | Texten innehåller platshållare som {found}. Är det svaret från AI? |
| wrongMode.move | Flytta till Avskrubba |
| paste.joined | Radbrytningar mitt i meningar är borttagna. |
| paste.undo | Ångra |
| key.summary | Kodnyckel · {n} platshållare |
| summary.show | Visa |
| key.missing | Den här fliken har ingen kodnyckel. Har du sparat en kan du ladda upp den, så byts platshållarna tillbaka. |

## Ändringar

Ägaren har granskat och godkänt alla strängar nedan, 2026-10-12. `action.newTextConfirm` säger "avskrubba" i stället för "byta tillbaka", efter bytet till Avskrubba. Nya eller ändrade strängar läggs till här och granskas av ägaren.

Ändrat eller nytt 2026-10-10 för layouten med två kort (Skrubba och Avskrubba).

- `mode.restore` och `action.restore`: "Byt tillbaka" blev "Avskrubba", som i skissen.
- `editor.empty` och `restore.empty`: nämner att man kan släppa en textfil.
- `drop.unsupported`: när någon släpper en fil som inte är .txt eller .md.
- `key.close`: stänger nyckelkortet.
- `footer.byline`: första raden i sidfoten. {app} är Skrubba i fetstil, {author} länkar till mickequick.se och {agency} till promptagency.se, båda i en ny flik så att texten i Skrubba finns kvar. Nytt 2026-10-12, ägarens formulering.
- `footer.credits`: andra raden i sidfoten. {github} länkar till kodförrådet i en ny flik när det är publikt (`REPO_URL` i `src/config.ts`), annars är det vanlig text. Ändrad 2026-10-12, ägarens formulering, med ägarens stavning "Github".
- `footer.version`: sista raden i sidfoten. {version} är versionen i `package.json`, satt när appen byggs. Nytt 2026-10-12.

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
- Läget i radens namn för skärmläsare och i tipset över markeringar har egna strängar sedan 2026-10-12, se nedan.

Nytt 2026-10-11. Länken "Så här funkar det" efter Vanliga frågor öppnar en film.

- `howto.open`: länken, och rubriken på fönstret.
- Stegen under "Så här funkar det" är textremsorna i filmen. Ändras de måste filmen spelas in igen.
- `panel.count`, `panel.count.one`: samma text som förut, nu som länk utan pil.

Nytt 2026-10-11. Länken "Ny text" under knappen mellan rutorna börjar om med en ny text. I Skrubba får den nya texten en ny kodnyckel, så att en kodnyckel aldrig blandar texter som inte hör ihop. Egna ord finns kvar. Finns det redan en kodnyckel frågar Skrubba först. I Avskrubba tömmer länken bara svaret, så att nästa svar kan bytas tillbaka med samma kodnyckel. "Rensa allt" i kodnyckeln tar fortfarande bort allt, även egna ord.

- `action.newText`: länken.
- `action.newTextConfirm`: frågan innan kodnyckeln töms. Knapparna är webbläsarens egna (OK och Avbryt), som för "Rensa allt".

Nytt 2026-10-11. Text som klistras in i Din text städas. Osynliga tecken från PDF:er fixas alltid. Ser texten ut att komma från en PDF, med radbrytningar mitt i meningarna, slås raderna ihop till stycken och en rad visas under rutan.

- `paste.joined`: raden under rutan efter att raderna slagits ihop.
- `paste.undo`: knappen som lägger tillbaka texten som den klistrades in.

Nytt 2026-10-12. Har gått igenom COPY.md manuellt och gjort vissa korrigeringar.

Nytt 2026-10-12, ägarens godkännande av utkasten.

- `toast.copyFailed`: när webbläsaren stoppar kopieringen, i både Skrubba och Avskrubba. Högra rutan går att markera, så rådet fungerar.
- `entity.tip.scrub` och `entity.tip.keep`: tipset när man håller musen över en markering. {type} är typens namn, till exempel Namn, Förnamn eller Efternamn, och {placeholder} är platshållaren som markeringen blir.
- `entity.row`, `entity.count`, `entity.count.one`, `entity.state.scrub`, `entity.state.keep`: radens namn för skärmläsare i fönstret Uppgifter, till exempel "Johan Lindqvist, namn, 3 gånger, skrubbas". Typen skrivs med liten bokstav mitt i meningen, utom förkortningar som IBAN och IP-adress. Knappen på raden säger fortfarande vad som händer (`entity.keepAction`, `entity.scrubAction`).

Ändrat 2026-10-12, ägarens granskning: `app.title`, `app.tagline`, `editor.empty`, `gate.body`, `status.trust`, `restore.empty`, `key.downloadWarning` och `caveat.short`.

Ändrat 2026-10-12, efter granskningen.

- `footer.credits`: "Källkod till Skrubba finns på {github}", ägarens formulering. {maskera} och {kbbert} är länkar till maskera på GitHub och KBLab på Hugging Face, i en ny flik.
- `footer.maskera`, `footer.kbbert`: länktexterna.
- Vanliga frågor är ett dragspel. Alla frågor är stängda från början, och en öppnad fråga stänger den som var öppen.
- Vanliga frågor har fem nya frågor (vilka uppgifter, hur man döljer något som missades, ändrade platshållare, vilka AI-tjänster, kostnad) och en ny ordning. "Byta tillbaka" heter "avskrubba" i svaren, och Github stavas som i sidfoten. Godkänt av ägaren.
- Vanliga frågor: ny fråga "Räknar ni besökare?" om den anonyma besöksräkningen med Plausible. "Kostar Skrubba något?" säger inte längre "ingen statistik", och "Hur kan jag kontrollera att inget skickas?" nämner besöksräkningen. Godkänt av ägaren 2026-10-12.
- `feedback.link`, `feedback.subject`, `feedback.body`: länken sist i varningen under Din text öppnar ett mejl till micke@promptagency.se (`FEEDBACK_EMAIL` i `src/config.ts`) med ämne och en kort guide ifyllda. Användarens text läggs aldrig in i mejlet. Godkänt av ägaren 2026-10-12.

Nytt 2026-10-14, godkänt av ägaren 2026-10-15. Dokument kan släppas in eller väljas med Välj fil, och läses i fönstret Läs in dokument. Allt nedan är nytt eller ändrat i den omgången.

- `editor.empty`: ändrad. Förut "Klistra in text här eller släpp en textfil. Den stannar i din webbläsare och inget laddas upp." Nu "släpp ett dokument" och "Det stannar".
- `restore.empty`: ändrad. Förut "Klistra in svaret från AI här eller släpp en skrubbad textfil." Nu "släpp ett dokument med svaret".
- `drop.unsupported`: borttagen. Ersatt av `file.error.unsupported`, som visas i fönstret.
- `file.choose`: knappen Välj fil bredvid Visa exempel.
- `file.title`: rubriken på fönstret Läs in dokument.
- `file.reading`, `file.readingPage`: raden medan filen läses. Sidnumren visas bara för PDF.
- `file.words`, `file.pages`, `file.pages.one`, `file.slides`, `file.slides.one`, `file.sheets` och `file.format.*`: raden under filnamnet, till exempel "Word · 1 240 ord" eller "PDF · 12 sidor · 4 300 ord".
- `file.replaces`: när rutan redan har text.
- `file.preview`: osynlig etikett för rutan med början av texten, läses upp av skärmläsare.
- `file.use`, `file.cancel`: knapparna. Fönstrets egen Stäng finns kvar uppe till höger.
- `file.note.hidden`, `file.note.attachments`, `file.note.firstOnly`: rader i fönstret när något inte togs med.
- `file.error.*`: ett felmeddelande per orsak (filtypen, lösenord, bara bilder, ingen text, för stort, för lång tid, skadad fil).
- `read.*`: står i texten som läses in, inte i gränssnittet. Ett mejl börjar med raderna Från, Till, Kopia, Ämne och Datum. Varje blad i ett Excel-dokument börjar med "Blad: namn" och varje bild i en presentation med "Bild 1". Kolonet efter Från och Blad är en etikett, inte löptext.
- Vanliga frågor: ny fråga sist, "Kan jag släppa in PDF och Word?".
- Ingen ny sträng för kodnyckeln. När ett dokument läses in i Skrubba och det redan finns en kodnyckel visas samma fråga som för Ny text (`action.newTextConfirm`).
- Typen `REFERENSNUMMER` visas som "Referensnummer": ett nummer direkt efter ett ord som kundnummer, avtalsnummer, fakturanr, ref eller anläggnings-ID. "Vilka uppgifter hittar Skrubba?" nämner kund-, avtals-, faktura- och referensnummer. Godkänt av ägaren 2026-10-14.

Nytt 2026-10-16, godkänt av ägaren 2026-10-16. Medan språkmodellen läser en lång text visas hur långt den har kommit.

- `status.scanning`: raden under Din text medan modellen läser, till exempel "Letar efter namn och platser … 40 %". Visas bara om det tar mer än 0,4 sekunder.
- `status.scanningStart`: det skärmläsare hör när en sådan läsning börjar. När den är klar hör de antalet uppgifter (`panel.count`).
- `action.scrubbing`: knappen Skrubba medan den väntar på modellen, till exempel "Skrubbar … 40 %".
- `toast.pressCopy`: när någon trycker kortkommandot för Kopiera innan texten är skrubbad och modellen hinner läsa längre än webbläsaren tillåter en kopiering efter tangenttrycket. Texten skrubbas, Kopiera får fokus och den här raden visas, så att ett tryck till kopierar.

Ändrat 2026-10-20, godkänt av ägaren 2026-10-20.

- `feedback.body`: ber om en påhittad mening som visar missen, gärna testad i Skrubba först, och vilken sorts text det var. Förut "Berätta vilken sorts uppgift Skrubba missade och hur den såg ut, till exempel ett kundnummer i stil med AB-1234-567." Sista meningen är kvar.

Nytt 2026-10-20, godkänt av ägaren 2026-10-20. Ett efternamn som står ensamt för ett helt namn i texten får en egen platshållare, som förnamnet.

- Typen `EFTERNAMN` visas som "Efternamn", till exempel i tipset över markeringen och i kodnyckeln. Platshållaren är `[EFTERNAMN_1]`, numrerad som namnets `[NAMN_1]`.

Nytt 2026-10-21, godkänt av ägaren 2026-10-21. Fönstret Läs in dokument säger när bilder inte lästes.

- `file.note.images`: visas när ett Word-, PowerPoint-, Excel-, OpenDocument- eller RTF-dokument har en bild i själva texten, eller när en PDF med text också har en skannad sida. En logga i sidhuvudet eller i bildmallen räknas inte. Bilder läses aldrig, och inte heller text i dem.
- Vanliga frågor, "Kan jag släppa in PDF och Word?": "Kommentarer, dolda delar och bilagor tas inte med." blir "Kommentarer, dolda delar, bilagor och bilder tas inte med, och inte heller text i bilder."

Nytt 2026-10-21, godkänt av ägaren 2026-10-21. Versionen i sidfoten är en länk.

- `footer.version` länkar till listan med versioner och vad som är nytt i dem på Github, i en ny flik. Sidan är på engelska.
- `footer.whatsNew`: länkens namn för skärmläsare, till exempel "Vad är nytt i version 1.4.0".

Nytt 2026-10-21, godkänt av ägaren 2026-10-21. Födelsedatum döljs.

- Typen `FÖDELSEDATUM` visas som "Födelsedatum": ett datum direkt efter född, f., födelsedatum eller liknande. Andra datum döljs inte, inte heller ett födelseår för sig.
- Vanliga frågor, "Vilka uppgifter hittar Skrubba?": "… och referensnummer samt födelsedatum hittas med regler. Andra datum, belopp och vanliga ord döljs inte …".

Nytt 2026-10-22, godkänt av ägaren 2026-10-22. Ett ord ur ett flerordigt namn på en organisation, en plats eller ett ord i ordlistan får en egen platshållare, som förnamnet.

- Typerna `DEL_ORGANISATION`, `DEL_PLATS` och `DEL_ORD` visas som "Del av namn", till exempel i tipset över markeringen och i kodnyckeln. Platshållaren bär värdets typ och nummer: "Volvo-fabriken" blir "[DEL_ORGANISATION_1]-fabriken" när "Volvo Cars" är [ORGANISATION_1], och "Havsvindsteamet" blir "[DEL_ORD_1]steamet" när "Projekt Havsvind" i ordlistan är [ORD_1]. (Ägaren godkände namnet DEL och "Del av namn"; typen i platshållaren behövs eftersom [ORGANISATION_1] och [ORD_1] finns samtidigt.)

## Typer

| Intern typ | Visas som |
|---|---|
| NAMN | Namn |
| FÖRNAMN | Förnamn |
| EFTERNAMN | Efternamn |
| DEL_ORGANISATION | Del av namn |
| DEL_PLATS | Del av namn |
| DEL_ORD | Del av namn |
| PLATS | Plats |
| ORGANISATION | Organisation |
| ADRESS | Adress |
| PERSONNUMMER | Personnummer |
| SAMORDNINGSNUMMER | Samordningsnummer |
| FÖDELSEDATUM | Födelsedatum |
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
| REFERENSNUMMER | Referensnummer |
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
4. Tryck Skrubba. Uppgifterna byts mot platshållare som [NAMN_2].
5. Kopiera texten och klistra in den i valfri AI-tjänst.
6. Kodnyckeln visar vilken platshållare som står för vad.
7. Byt till Avskrubba och klistra in svaret från AI.
8. Tryck Avskrubba. De riktiga uppgifterna kommer tillbaka.

## Vanliga frågor

Öppnas som ett fönster ovanpå sidan, från länken "Vanliga frågor" under lägesväljaren och från "Allt sker på din dator" i sidfoten. Rubriken är "Vanliga frågor". Frågorna visas som ett dragspel. Alla är stängda från början, och klickar man på en fråga stängs den som var öppen.


### Vad händer med min text?

Texten går igenom regler och en liten svensk språkmodell som laddas ner till din webbläsare första gången. Namn, personnummer, adresser och företag byts ut mot platshållare som [NAMN_1]. Dina egna ord, som kundnamn och projektnamn, byts ut på samma sätt. Du kopierar den skrubbade texten till valfri AI-tjänst och klistrar sedan in svaret under Avskrubba, så kommer de riktiga uppgifterna tillbaka.

### Vilka uppgifter hittar Skrubba?

Namn, platser och organisationer hittas av språkmodellen. Personnummer, samordningsnummer, organisations- och momsnummer, telefonnummer, e-post, webbadresser, adresser, postnummer, bankuppgifter, kortnummer, registreringsnummer och kund-, avtals-, faktura- och referensnummer samt födelsedatum hittas med regler. Andra datum, belopp och vanliga ord döljs inte, eftersom AI:n ofta behöver dem för att svara. Är de känsliga lägger du till dem under Egna ord.

### Hur döljer jag något som Skrubba missade?

Markera ordet i texten och tryck Skrubba markering, så döljs det överallt i texten. Ord som ska döljas varje gång, som kundnamn och projektnamn, skriver du under Egna ord, ett per rad. Vill du behålla något som Skrubba har dolt klickar du på markeringen.

### Vad händer om AI:n ändrar platshållarna?

Skriver AI:n platshållaren på ett annat sätt, till exempel NAMN 1 i stället för [NAMN_1], frågar Skrubba om det är samma innan uppgiften sätts tillbaka. En platshållare som inte finns i kodnyckeln lämnas som den är och visas under svaret, så att du kan kontrollera den.

### Vad är kodnyckeln?

En lista över vilka riktiga uppgifter platshållarna står för, till exempel att [NAMN_1] är Anna Berg. Den behövs för att avskrubba svaret. Den är ingen krypteringsnyckel och låser inget. Den som har filen kan läsa de riktiga uppgifterna, så spara den som känsligt material.

### Hur kan jag kontrollera att inget skickas?

Öppna webbläsarens utvecklarverktyg, fliken Nätverk, och klistra in en text. Inga anrop går till någon annan adress än den här sidan. Det enda anrop som inte hämtar själva sidan är besöksräkningen när sidan laddas, och inget anrop görs när du skrubbar eller avskrubbar. Efter första besöket fungerar Skrubba även utan internet. Koden är öppen och går att läsa på Github.

### Vad gör Skrubba inte?

Skrubba hittar inte allt, särskilt inte beskrivningar som pekar ut någon utan att nämna namnet. Läs alltid igenom innan du kopierar. En text med platshållare är inte anonym i lagens mening så länge kodnyckeln finns, så ansvaret för vad du delar är fortfarande ditt. Skrubba gör det bara mycket mindre riskabelt.

### Vilka AI-tjänster fungerar det med?

Alla. Skrubba gör bara texten säkrare, så du kan klistra in den i ChatGPT, Claude, Copilot, Gemini eller vilken tjänst du vill.

### Kostar Skrubba något?

Nej. Skrubba är gratis och har öppen källkod under MIT-licensen. Det finns inga konton och ingen reklam.

### Räknar ni besökare?

Ja, anonymt. När sidan laddas skickas ett besök till sidans egen adress, som skickar det vidare till Prompt Agencys egen Plausible-server i Finland. Plausible ser sidans adress, varifrån du kom, land, webbläsare och typ av enhet, men sätter inga cookies och sparar inte din IP-adress. Det du skriver, uppgifterna och kodnyckeln skickas aldrig. Har webbläsaren Do Not Track eller Global Privacy Control påslaget räknas du inte.

### Kan jag släppa in PDF och Word?

Ja. Släpp filen på rutan eller tryck Välj fil. Skrubba läser PDF, Word, OpenDocument, RTF, Excel, PowerPoint, mejl som .eml och .msg, webbsidor och text i din webbläsare och lägger texten i rutan. Filen laddas inte upp och sparas inte. Kommentarer, dolda delar, bilagor och bilder tas inte med, och inte heller text i bilder. En skannad PDF utan text går inte att läsa.
