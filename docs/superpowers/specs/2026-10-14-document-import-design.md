# Document import: design

Date: 2026-10-14. Status: approved in conversation, awaiting review of this spec.

## Goal

Let people drop or pick a document (PDF, Word and other common formats) and get its text into Din text or the Avskrubba pane, read entirely in the browser. From there the flow is unchanged: scrub, copy into the AI, paste the answer, restore.

This lifts the v1 scope line "File upload (docx/pdf)" in `CLAUDE.md` and `PLAN.md` (owner's decision, 2026-10-14). Fake replacement names, history and the rest of the out-of-scope list stay out.

## Decisions (owner, 2026-10-14)

1. **Text only out.** A document is turned into plain text. There is no masked .docx or .pdf to download, now or as a planned phase.
2. **Formats:** pdf, docx, doc, odt, rtf, csv, html, eml, msg, pptx, xlsx, plus the existing txt and md.
3. **Hidden content is left out, and the user is told.** Comments, deleted revisions, hidden text, speaker notes, hidden slides and sheets, and attachments are not extracted. A note in the file window says so.
4. **Approach A.** Our own readers for everything except PDF; pdf.js (Mozilla, `pdfjs-dist`) for PDF. It is the only new dependency.
5. **All file work happens in a window** (the file window), which shows clearly that something is happening, then a summary, then waits for the user to confirm with "Använd texten".

## Privacy constraints (unchanged, restated for this feature)

- Files are read in the browser. Nothing about the file is sent anywhere. CSP stays as it is (`connect-src 'self'`, `worker-src 'self' blob:`, no `unsafe-eval`).
- Reader code and pdf.js are served from our own origin and precached by the service worker, so reading works offline.
- The file's bytes, the extracted text and the preview live only in memory. The reader worker is created for one file and terminated after it, so nothing from the file outlives the read.
- Metadata (author, company, revision history, document properties) is never extracted. Since only extracted text is ever shown or copied, it cannot leak.
- Body text that the reader sees on the page must all come along (headers, footers, footnotes, text boxes, tables), because text we drop is text the masker never sees, and a missed entity is worse than an over-masked one.

## Architecture

### Module boundary

New module `src/reader/`, walled off like `src/engine/`. Nothing outside it imports pdf.js or a format reader directly.

```
src/reader/
  index.ts          readDocument(file, { onProgress, signal }): Promise<ReadResult>
  protocol.ts       messages between the page and the reader worker
  worker.ts         reader worker entry: detect, dispatch, post result
  detect.ts         format from magic bytes, then container contents, then extension
  decode.ts         bytes to string: BOM, UTF-8 (fatal), fallback windows-1252
  limits.ts         size, entry and time caps
  zip.ts            central directory reader + DecompressionStream('deflate-raw')
  xml.ts            minimal well-formed XML tokenizer (no DOMParser in workers)
  cfb.ts            OLE compound file reader (shared by doc and msg)
  formats/
    text.ts         txt, md
    csv.ts
    html.ts         also used by eml for HTML-only bodies
    rtf.ts
    eml.ts
    docx.ts
    odt.ts
    pptx.ts
    xlsx.ts
    doc.ts
    msg.ts
    pdf.ts          pdf.js, loaded with a dynamic import only for PDFs
```

### Result type

```ts
type ReadResult =
  | { kind: "text"; text: string; format: Format; stats: Stats; notes: Note[] }
  | { kind: "error"; reason: "unsupported" | "encrypted" | "empty" | "noText" | "tooLarge" | "timeout" | "failed" };

type Format = "txt" | "md" | "csv" | "html" | "rtf" | "eml" | "msg" | "docx" | "doc" | "odt" | "pptx" | "xlsx" | "pdf";
type Stats = { words: number; pages?: number; slides?: number; sheets?: number };
type Note = "hiddenLeftOut" | "attachmentsLeftOut" | "onlyFirstFile";
```

`noText` is a PDF whose pages have no text layer (scanned). `empty` is any document that yields no non-whitespace text.

### Format detection (`detect.ts`)

By the file's first bytes, never by extension alone:

- `PK\x03\x04`: zip. `mimetype` entry `application/vnd.oasis.opendocument.text` means odt. Otherwise `[Content_Types].xml` decides: `word/document.xml` docx, `ppt/presentation.xml` pptx, `xl/workbook.xml` xlsx. Any other zip is unsupported.
- `%PDF-`: pdf.
- `D0 CF 11 E0 A1 B1 1A E1`: OLE. A `WordDocument` stream means doc; a `__properties_version1.0` stream plus `__substg1.0_` streams means msg. An `EncryptedPackage` stream means an encrypted OOXML file (encrypted docx/xlsx/pptx are OLE containers): `encrypted`. Anything else (xls, ppt) is unsupported.
- `{\rtf`: rtf.
- Otherwise text-like, by extension: `.txt`, `.md`, `.csv`, `.html`/`.htm`, `.eml`. Files with a NUL byte in the first 8 KiB are unsupported, whatever the extension.

### Reader worker

- `readDocument` creates a module Web Worker (`new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`), transfers the file's `ArrayBuffer`, and terminates the worker when the result arrives, on cancel (`AbortSignal`) and on timeout.
- It is separate from the NER worker, so a large PDF never blocks masking, and a hung parser can be killed.
- Progress messages: `{ type: "progress", page, pages }` for PDF and pptx; otherwise none (the window shows an indeterminate line).

### Limits (`limits.ts`)

- File size: 50 MB. Larger gives `tooLarge` before any read.
- Zip: at most 2 000 entries, at most 100 MB uncompressed in total, at most 50 MB per entry, compression ratio cap 200:1 per entry. Exceeding any gives `failed` (zip bomb guard). Only entries a reader asks for are inflated.
- CFB: sector chains checked for loops and out-of-range sectors; `failed` on either.
- Time: 30 s per file, then the worker is terminated and the result is `timeout`.
- Extracted text: 2 000 000 characters. Larger gives `tooLarge` (the engine's long-text path is tested well below that; see `longtext.model.test.ts`).

### Text decoding (`decode.ts`)

BOM first (UTF-8, UTF-16 LE/BE). Then `TextDecoder("utf-8", { fatal: true })`; on failure, `windows-1252`. Swedish CSV saved from Excel is usually windows-1252; without the fallback å, ä and ö turn into replacement characters. This also fixes dropped `.txt` files, which today are read as UTF-8 only. RTF, eml and msg use their own declared charsets where present and fall back to this.

### pdf.js

- `pdfjs-dist`, pinned exact, version at least 4.2.67 (CVE-2024-4367). Loaded by dynamic import inside the reader worker, so it is fetched only for the first PDF.
- Options: `isEvalSupported: false`, `disableFontFace: true`, `useSystemFonts: false`, `disableAutoFetch: true`, `disableStream: true`, `data` passed as bytes (no URL), no `cMapUrl` network fetch: the cmaps and standard font data it needs are copied into the build and served from our own origin (`/pdfjs/`), or left out if text extraction works without them for the fixtures. Decided while building step 3; either way nothing is fetched from elsewhere.
- pdf.js runs without its own nested worker inside our reader worker (its main-thread "fake worker" mode, with the worker module imported from our origin). The exact wiring is decided in the plan.
- Text per page from `getTextContent()`. Items are grouped into lines by baseline (y within half the font height), sorted by x, with a space where the gap between items is wider than about a quarter of the font size. Pages are joined with a blank line.
- The result goes through the existing PDF tidy-up (`normalise` and line joining in `src/ui/pasteCleanup.ts`), moved or exported so the reader can use it. All pages with no text items: `noText`. Password-protected: `encrypted`.
- Annotations and form field values: decided while building step 3, using the fixtures. Default if unclear: include form field values (they are visible on the page), leave out annotations (comments) with `hiddenLeftOut`. Settled after the final review: text and choice field values and FreeText (text typed onto the page) come along; other annotations with contents are comments.

### What each reader extracts

| Format | Taken | Left out (sets the note) |
|---|---|---|
| docx | `word/document.xml` body in order: paragraphs, tables (cells separated by tabs, rows by lines), text boxes, list numbering as plain prefixes where cheap; `header*.xml`, `footer*.xml`, `footnotes.xml`, `endnotes.xml` appended under the body | Comments (`comments.xml`), deleted runs (`w:del`), hidden runs (`w:vanish`), field instructions (`w:instrText`) |
| odt | `content.xml` body: paragraphs, headings, tables, frames; `styles.xml` header and footer; notes | `office:annotation`, `text:tracked-changes` deletions, hidden text |
| rtf | Body text, `\'xx` by `\ansicpg`, `\uN` with `\uc` skipping | `\info` (metadata), `\*` destinations (annotations, fields' instructions), font, colour and style tables, `\v` hidden text |
| doc | Text from the piece table (`WordDocument` + `0Table`/`1Table` CLX), main text, footnotes, headers; special characters mapped (cell and row marks to tab and newline) | Field instructions (between 0x13 and 0x14), deleted text where the revision marks are readable; encrypted documents give `encrypted` |
| msg | From, To, Cc, Subject, Date from the property streams, then the plain body (`0x1000`), else the HTML body (`0x1013`) through `html.ts`; Unicode or 8-bit strings by property type | Attachments (`attachmentsLeftOut`) |
| eml | From, To, Cc, Subject, Date (RFC 2047 encoded words decoded), then `text/plain`, else `text/html` through `html.ts`; quoted-printable and base64; charset per part | Attachments and any other parts (`attachmentsLeftOut`) |
| html | Visible text, one block element per line, `<br>` as newline, table cells by tab, entities decoded | `<script>`, `<style>`, `<head>`, `<template>`, comments, elements with `hidden` |
| csv | The file as decoded text, unchanged | Nothing |
| xlsx | Each visible sheet as `Blad: <name>` then one row per line, cells tab-separated, shared strings resolved, cached values for formulas, numbers as written | Hidden and very hidden sheets (`hiddenLeftOut`), comments, formulas themselves |
| pptx | Visible slides in order as `Bild <n>`, then their text in shape order, tables by tab | Speaker notes, hidden slides, comments (`hiddenLeftOut`) |
| txt, md | The file as decoded text | Nothing |

`hiddenLeftOut` is set only when hidden content was actually present and skipped, not for every Word file.

## The file window

### Opening

- Dropping a file on either pane (as today, `DropZone`), or the new "Välj fil" button on each pane (an `<input type="file">` behind a real button, so keyboard and phone users can open files).
- Every file goes through the window, `.txt` and `.md` included. Uploading a kodnyckel keeps its own flow in the kodnyckel window and is not affected.
- More than one file dropped: the first is read, with the note `onlyFirstFile`.

### States

Built on the existing `Modal` (native `<dialog>`, focus trapped, Esc closes), styled like the other windows (`yta`, `backdrop`, `rubrik-s`). No new visual element: progress is a text line like the gate's "Laddar modell 43 %". Title `file.title`.

1. **Reading.** File name, then `file.reading` or `file.readingPage` ("Läser sida 3 av 12 …"). The live region announces it. One button, `file.cancel`, which, like Esc and the window's close, aborts the read and terminates the worker. The pane is untouched.
2. **Done.** File name; a line with the type and size (`file.stats`, e.g. "Word · 1 240 ord", "PDF · 12 sidor · 4 300 ord"); any notes; `file.replaces` when the target pane already has text; a read-only, scrollable preview of the first part of the text (about 1 000 characters, ending with "…" when cut). Buttons: `file.use` (primary, focused) and `file.cancel`. "Använd texten" puts the text in the pane the file was dropped on and closes the window. The text is not passed through the paste tidy-up again (PDF text was tidied by the reader). In Skrubba a document is a new case: "Använd texten" starts a new kodnyckel as Ny text does, asking first (`action.newTextConfirm`) when the key has entries; saying no leaves the window open; Egna ord stay. In Avskrubba the key stays. (Owner's decision, 2026-10-14, replacing "does not reset the kodnyckel".)
3. **Error.** File name and one sentence for the reason, then `file.close`. The pane is untouched.

The preview shows real values unmasked. That is on the user's own screen, the same as the pane itself.

### Copy (drafts, to be reviewed in `docs/COPY.md`)

| Key | Draft |
|---|---|
| file.choose | Välj fil |
| file.title | Läs in dokument |
| file.reading | Läser dokumentet … |
| file.readingPage | Läser sida {page} av {pages} … |
| file.stats | {format} · {words} ord (with "· {pages} sidor", "· {slides} bilder" or "· {sheets} blad" where known) |
| file.replaces | Texten som står i rutan nu ersätts. |
| file.use | Använd texten |
| file.cancel | Avbryt |
| file.close | Stäng |
| file.note.hidden | Kommentarer och dolda delar togs inte med. |
| file.note.attachments | Bilagor togs inte med. |
| file.note.firstOnly | Bara en fil i taget. Den första lästes. |
| file.error.unsupported | Den här filtypen går inte att läsa. Spara dokumentet som PDF eller Word och försök igen, eller kopiera texten och klistra in den. |
| file.error.encrypted | Dokumentet är lösenordsskyddat. Ta bort lösenordet och försök igen. |
| file.error.noText | PDF:en innehåller bara bilder, ingen text. Kör textigenkänning (OCR) på den först, eller kopiera texten och klistra in den. |
| file.error.empty | Dokumentet innehåller ingen text. |
| file.error.tooLarge | Dokumentet är för stort. Dela upp det och läs in en del i taget. |
| file.error.timeout | Det tog för lång tid att läsa dokumentet. Försök igen, eller kopiera texten och klistra in den. |
| file.error.failed | Dokumentet gick inte att läsa. Det kan vara skadat. Öppna det och spara det på nytt, eller kopiera texten och klistra in den. |

Format names in `file.stats`: PDF, Word, OpenDocument, RTF, Outlook-mejl, E-post, Webbsida, CSV, Excel, PowerPoint, Text, Markdown.

`drop.unsupported` is retired (replaced by `file.error.unsupported`). `editor.empty` and `restore.empty` get the word "dokument" instead of "textfil" (exact wording in COPY.md review).

## Testing

### Fixtures

`tests/fixtures/documents/`, committed, with a `README.md` saying how each file was made (application and version, or script). One shared Swedish sample (names, personnummer, address, phone, an organisation) saved in every format, so tests compare against one expected text. Edge fixtures:

- docx with comments, tracked insertions and deletions, hidden text and a field
- docx with headers, footers, footnotes and a text box holding a name
- password-protected docx (OLE `EncryptedPackage`) and password-protected PDF
- scanned PDF (image only)
- multi-page PDF with a hyphenated word across a line and a two-column table
- windows-1252 CSV with å, ä, ö
- zip bomb (high ratio entry) and a zip with too many entries, generated by a test helper rather than committed
- eml multipart/alternative with an attachment and RFC 2047 subject; eml HTML-only
- msg with an attachment
- xlsx with a hidden sheet and a formula; pptx with speaker notes and a hidden slide
- doc with a footnote and a hyperlink field
- a file named `.pdf` that is really text (detection by bytes)

### Vitest

- Per reader: exact extracted text for the shared sample; hidden content absent; the right notes set and unset.
- `detect.ts`: each magic, each zip and OLE subtype, the misnamed file.
- `decode.ts`: BOMs, UTF-8, windows-1252 fallback.
- `zip.ts` and `cfb.ts`: caps, loops and malformed input give `failed`, never a hang or a crash.
- Round trip: each fixture's text through the rules masker masks the sample's personnummer and phone number (model tests where the model is available, as today).

### Playwright (Chromium, Firefox, WebKit)

- Drop and "Välj fil" for docx and pdf at least, all formats on Chromium: window shows reading then done, "Använd texten" fills the pane, scrubbing masks the sample's name.
- "Avbryt" during reading and after reading leaves the pane unchanged; Esc does the same.
- Error states: scanned PDF, password-protected file, unsupported file.
- Keyboard: focus moves into the window, "Använd texten" focused when done, focus returns to the pane after.
- axe on the window in each state, light and dark.
- `no-egress.spec.ts`: reading a PDF and a docx makes only same-origin requests.
- Offline: after the first visit, with the network off, a PDF can be read.
- No storage: the existing spy on localStorage, sessionStorage, indexedDB and cookies covers a file read.

## Build order

One commit per step, each with the tests that prove it. Pushed once, after step 8, since a push to main deploys.

1. Reader worker, `readDocument`, detection, decoding, limits, the file window and "Välj fil"; txt and md moved onto them; `drop.ts` replaced.
2. docx (zip reader, XML tokenizer).
3. pdf (pdf.js, line rebuilding, tidy-up shared with paste).
4. odt, rtf, csv, html.
5. eml.
6. pptx, xlsx.
7. OLE reader; doc and msg.
8. Docs: `CLAUDE.md` scope line and conventions, `PLAN.md` (phase and out-of-scope list), `docs/UX.md` (Dropping files becomes the file window), `docs/ARCHITECTURE.md` (reader module, worker, limits, pdf.js settings), `docs/COPY.md` (new strings, FAQ mention of documents). Re-record the demo video (`npm run demo-video`). Release 1.2.0.

## Open questions

- pdf.js cmaps and standard font data: ship them under `/pdfjs/` or leave them out. Settled in step 3 with the fixtures; neither choice adds a third-party request.
- PDF annotations and form fields: default above; confirm with the fixtures in step 3.
- Swedish copy: the drafts above need the owner's review before step 8 lands.
