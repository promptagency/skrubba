# Changelog

Notable changes to Skrubba. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each version is tagged `vX.Y.Z` in git, and the version is shown in the app's footer. How to release: [docs/DEPLOY.md](docs/DEPLOY.md#releasing-a-version).

## [Unreleased]

### Fixed

- **Compound words no longer leak.** A word-list term, or a company or place the model found, is now also masked where it starts a longer word: *Fenixlanseringen* becomes *[ORD_1]lanseringen*, *Volvoavtalet* becomes *[ORGANISATION_1]avtalet*, and restore puts the name back. Word-list terms match in lowercase text too (*fenixlanseringen*). Before, these stayed in clear text.
- **Restore writes names the way names are written.** When a name appeared both as *kalle* and *Kalle*, restore wrote whichever came first everywhere. It now writes the capitalised form, and a word-list term as you typed it.
- **No stray bracket after restore.** When a masked word started right after a digit or letter (*18e våningen* masked as *18[ADRESS_2]*), restore left a "[" in the text. It now restores cleanly.

## [1.3.0] - 2026-10-16

### Added

- **Progress on long texts.** While the language model reads a long text, *Letar efter namn och platser … 40 %* shows under the text, and *Skrubba* shows *Skrubbar … 40 %* while it waits, so it is clear the work goes on.

### Changed

- **Skrubba is faster on long texts.** It reuses the reading the model already did after the paste instead of starting over, and editing the text stops a reading that is no longer needed.
- **The copy shortcut on long texts.** Pressed before the text is scrubbed, when the reading then takes more than 3 seconds, it no longer fails with *Texten kunde inte kopieras*: the text is scrubbed, *Kopiera* gets focus and one more press copies.
- **Release checks.** The privacy tests (no request leaves the site, nothing is stored in the browser) never retry, so a leak that happens only sometimes blocks a release, and every other test that passed only on a retry is listed for checking.

## [1.2.1] - 2026-10-15

The app is the same as 1.2.0. This release exists because the release checks for 1.2.0 failed on two flaky tests, so 1.2.0 got no release page.

### Fixed

- **Release checks.** The deploy tests no longer hang when they close their test server, and a keyboard test in the Uppgifter window no longer races in Firefox.

## [1.2.0] - 2026-10-15

### Added

- **Documents.** Drop a PDF, Word, OpenDocument, RTF, Excel, PowerPoint, email (.eml, .msg) or web page file on the text, or choose one with *Välj fil*. A window, *Läs in dokument*, shows that the file is being read, then what was read and the start of the text, and nothing changes until *Använd texten*. The file is read in the browser and never uploaded. Comments, hidden parts and attachments are left out, and the window says so. In Skrubba a document starts a new kodnyckel, asking first like *Ny text*.

### Changed

- Text and CSV files saved in the old Windows encoding (windows-1252) now keep their å, ä and ö.

## [1.1.1] - 2026-10-14

### Added

- **Link previews.** Sharing the link on LinkedIn, Slack, Teams, Messenger or X shows the title, the description and a share image with the logo.

## [1.1.0] - 2026-10-14

Ready for the public announcement.

### Added

- **Anonymous visit counting** with Prompt Agency's self-hosted Plausible. One page view per load goes to Skrubba's own address, which passes it on; the browser still talks to no other server. No cookies, no stored IP address, and Do Not Track and Global Privacy Control are respected. A new question in *Vanliga frågor* explains it.
- **Labelled numbers.** A number right after *kundnummer*, *avtalsnummer*, *fakturanr*, *ref*, *anläggnings-ID* and similar labels becomes `[REFERENSNUMMER_1]`.
- **Report a miss.** *Missade Skrubba något? Berätta.* under the text opens an email to the maker with a short guide. The user's text is never put into it.

## [1.0.0] - 2026-10-12

The public launch at [skrubba.promptagency.se](https://skrubba.promptagency.se), with the source code open on GitHub.

### Added

- **Company names.** A name followed by AB, HB, Aktiebolag, Ltd, GmbH and similar is masked, and so is the same name wherever else it appears. The company form stays visible: "[ORGANISATION_1] AB".
- **Web addresses without https://**, such as "foretaget.se", and the domain of an email address where it appears on its own.
- **Swedish VAT numbers** (SE + organisationsnummer + 01).
- **A message when copying fails.** If the browser blocks the clipboard, Skrubba says so and how to copy the text by hand, instead of nothing.
- **Five new questions in *Vanliga frågor*:** what Skrubba finds, how to hide something it missed, what happens when the AI changes a placeholder, which AI services work, and what it costs.
- **Security headers** on the live site: the Content Security Policy also as a header, with framing by other sites blocked, plus `nosniff` and `no-referrer`.

### Changed

- **A first name comes back as a first name.** Where the text has "Johan" alone next to "Johan Lindqvist", the first name becomes `[FÖRNAMN_1]` (numbered like `[NAMN_1]`, so the AI knows it is the same person), and Avskrubba writes back "Johan", not the full name. The kodnyckel gets a *Förnamn* row for it.
- **Car registration numbers are masked** (ABC 123, ABC 12D). 0.9.0 listed them, but maskera's rule for them was still off.
- ***Vanliga frågor* is an accordion.** Every question starts closed, and opening one closes the one that was open.
- **Clearer labels.** Hovering a highlight says what it becomes and what a click does ("Namn blir [NAMN_1]. Klicka för att behålla."), and screen readers hear each row in *Uppgifter* as "Johan Lindqvist, namn, 3 gånger, skrubbas".
- **Copy reviewed** by the owner, including the page title, the help texts and the warning under the text.
- **Footer.** The credits link to maskera and KB-BERT, and "Källkod till Skrubba finns på Github" links to the repository.
- **Design.** The backdrop behind windows is a design token and darker in dark mode, and all spacing follows the design scale.

### Fixed

- **Return visits on Cloudflare Pages.** The host redirects `/index.html` to `/`, and the offline cache stored that redirect, which browsers refuse for a page load. The app shell is now fetched from `/`.

## [0.9.0] - 2026-10-12

First tagged version, before the public launch.

### Added

- **Skrubba (mask).** Swedish text is scanned as you type or paste. Names, places and organisations come from maskera's Swedish NER model (KB-BERT, q8), run in a Web Worker. Personnummer, samordningsnummer, organisationsnummer, phone numbers, email, addresses, postcodes, bank details, IBAN, card numbers, IP addresses, URLs, journal and registration numbers come from rules. Each value gets a stable placeholder like `[NAMN_1]`.
- **Your own words.** *Egna ord* hides a list of terms every time; selecting text hides it once. Both become `[ORD_n]`.
- **Review.** Highlights in the text, colour-coded by type with the type always named in text. Click a highlight, or use the *Uppgifter* window, to keep a word. Organisations are masked by default.
- **Avskrubba (restore).** Paste the AI's answer to put the real values back. Restoring tolerates placeholders the AI has changed, with suggestions to confirm and a note on placeholders that are not in the key.
- **Kodnyckel.** The placeholder → value list, in memory only. Download it as JSON and upload it later to continue a case. A warning before closing the tab with a key that has not been downloaded.
- **Ny text.** Starts over with a new text and a new kodnyckel, keeping *Egna ord*.
- **Pasting from a PDF.** Lines broken mid-sentence are joined and hidden PDF characters are fixed, with *Ångra* to get the text back as pasted.
- **A name found once is masked everywhere.** A proper noun the model finds in one place is also masked where it missed it.
- **Dropping a `.txt` or `.md` file** into either pane.
- **Help.** *Vanliga frågor*, and *Så här funkar det* with a captioned demo video.
- **Offline.** A service worker caches the app and the model after the first visit, with a kill switch (`SW_KILL=1`).
- **Light and dark themes**, keyboard shortcuts, and a layout that works down to 390 px. Checked against WCAG 2.2 AA with axe-core.
- **Privacy by construction.** No requests to any other origin (enforced by a Content Security Policy and tested), and no text stored in localStorage, sessionStorage, IndexedDB or cookies (tested).

[Unreleased]: https://github.com/promptagency/skrubba/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/promptagency/skrubba/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/promptagency/skrubba/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/promptagency/skrubba/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/promptagency/skrubba/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/promptagency/skrubba/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/promptagency/skrubba/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/promptagency/skrubba/releases/tag/v0.9.0
