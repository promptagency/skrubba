# Changelog

Notable changes to Skrubba. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each version is tagged `vX.Y.Z` in git, and the version is shown in the app's footer. How to release: [docs/DEPLOY.md](docs/DEPLOY.md#releasing-a-version).

## [Unreleased]

### Added

- **Anonymous visit counting** with Prompt Agency's self-hosted Plausible. One page view per load goes to Skrubba's own address, which passes it on; the browser still talks to no other server. No cookies, no stored IP address, and Do Not Track and Global Privacy Control are respected. A new question in *Vanliga frågor* explains it.

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

[Unreleased]: https://github.com/promptagency/skrubba/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/promptagency/skrubba/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/promptagency/skrubba/releases/tag/v0.9.0
