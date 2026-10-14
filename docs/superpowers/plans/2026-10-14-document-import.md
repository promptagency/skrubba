# Document import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people drop or pick a PDF, Word or other document and get its text into Din text or Svar från AI, read entirely in the browser, through a window that shows progress, a summary and a preview before anything changes.

**Architecture:** A new module `src/reader/` (walled off like `src/engine/`) turns a `File` into a `ReadResult` inside a dedicated Web Worker that lives for one file. Format is detected from bytes. Zip-based formats share a tiny zip reader (the browser's `DecompressionStream`) and XML tokenizer, OLE formats share a compound-file reader, PDF uses pdf.js. The UI adds a file window (`FileWindow.tsx`, on the existing `Modal`) and a "Välj fil" button; all file input goes through it.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (`erasableSyntaxOnly`, so no parameter properties or enums), Vitest 5 (Node 26), Playwright (Chromium, Firefox, WebKit), `pdfjs-dist` 6.4.299 (new, pinned exact).

**Spec:** `docs/superpowers/specs/2026-10-14-document-import-design.md`

## Global Constraints

- The browser talks to our own origin only. CSP in `vite.config.ts` and `public/_headers` does not change: `connect-src 'self'`, `worker-src 'self' blob:`, no `unsafe-eval`.
- Text, file bytes and preview live only in memory. Never `localStorage`, `sessionStorage`, IndexedDB, cookies or URL params.
- One new runtime dependency only: `pdfjs-dist`, exact version `6.4.299`, and nothing imports it outside `src/reader/formats/pdf.ts`. No other new runtime dependency. No new dev dependency.
- Nothing outside `src/reader/` imports a format reader or pdf.js; the UI imports only `src/reader/index.ts`.
- Limits (verbatim from the spec): file 50 MB; zip at most 2 000 entries, 100 MB uncompressed in total, 50 MB per entry, ratio cap 200:1 per entry; 30 s per file; extracted text 2 000 000 characters.
- Hidden content is left out and the user is told (`hiddenLeftOut`): comments, deleted revisions, hidden text, speaker notes, hidden slides and sheets. Attachments are left out (`attachmentsLeftOut`). The note is set only when such content was actually present.
- Body text the reader sees must all come along: headers, footers, footnotes, endnotes, text boxes, tables.
- pdf.js runs with `isEvalSupported: false`, `disableFontFace: true`, `useSystemFonts: false`, `disableAutoFetch: true`, `disableStream: true`, bytes passed as `data`, no `cMapUrl` and no `standardFontDataUrl`.
- UI copy is Swedish and comes from `docs/COPY.md` first, then `src/ui/copy.ts` (a test compares them). Copy rules: no colons or dashes in running text, no exclamation marks, sentence case.
- Component CSS uses only variables (`--space-*`, `--radius-*`, `--yta-sankt`, and the aliases already in `src/ui/styles.css` such as `--muted`, `--line`, `--surface`). No hex, no `rgb()`, no font names. Check light and dark.
- Code, comments, commits and docs (except `COPY.md`) in English. Commit messages in the repo's style: one plain sentence, no prefix, ending with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `worktree-document-import`. Never push to `main`. A push to `main` deploys to production.

## Review Focus

1. **A file whose name lies** (a Word file renamed `.pdf`, a text file named `.docx`): detection goes by bytes, so the Word file is read as Word and the text file is refused, never parsed as the wrong thing. Pinned in Task 1 (`detect.test.ts`, `extract.test.ts`) and Task 3 (`extract.test.ts`).
2. **Closing the window while a file is still being read:** the read stops, the worker is terminated and the pane is untouched. Pinned in Task 2 (`file-import.spec.ts`, "Avbryt while reading").
3. **A Swedish CSV or text file saved as windows-1252:** å, ä, ö come out right instead of replacement characters. Pinned in Task 1 (`decode.test.ts`, `extract.test.ts`).
4. **Dropping a document on a pane that already has text, then changing one's mind:** the window says the text will be replaced, and Avbryt or Esc leaves the old text. Pinned in Task 2 (`file-import.spec.ts`).
5. **A zip bomb or a zip with absurd entry counts disguised as a .docx:** the read fails fast with `failed`, with no hang and no memory blow-up. Pinned in Task 3 (`zip.test.ts`).

## Deviations from the spec (decided while planning)

- Synthetic fixtures are built by code (`tests/fixtures/documents/build.ts`) rather than committed as binaries, since no office suite is available to make them and code is reviewable. Real-application fixtures are seven Apache Tika test documents committed under `tests/fixtures/documents/tika/` (Apache-2.0, pinned by sha256).
- The worker file is `src/reader/readerWorker.ts`, not `worker.ts`, so its build chunk (`readerWorker-<hash>.js`) is distinguishable from the NER worker's in tests.
- The zip subtype is decided by the main part's entry name (`word/document.xml`, `ppt/presentation.xml`, `xl/workbook.xml`, ODF `mimetype`), which is what `[Content_Types].xml` would say for every real file.
- The error state has no extra button: the window's own "Stäng" (in the head, already there in `Modal`) closes it. A second "Stäng" would be a duplicate. So there is no `file.close` key.
- pdf.js cmaps and standard font data are left out (open question in the spec, settled here): text extraction for Latin scripts does not need them, and leaving them out cannot add a request. Task 4 proves it with the fixtures and `no-egress.spec.ts`.
- PDF form fields (text field values) are included; PDF annotations with comments are left out with `hiddenLeftOut` (the spec's default).
- Known limits, recorded in docs in Task 15 rather than built: `.msg` files whose only body is compressed RTF give headers only; `.doc` deleted revisions are not detected; `.doc` table rows come out on one line; xlsx dates come out as serial numbers.

## File map

```
src/reader/
  index.ts            readDocument(file, opts) → Promise<ReadResult>; the only import for the UI
  types.ts            Format, Note, Stats, ErrorReason, ReadResult, Extracted, ReadError, Progress
  limits.ts           LIMITS
  decode.ts           decodeText(bytes, declared?), labelForCodepage(cp)
  detect.ts           detect(bytes, name) → Detected
  extract.ts          extract(bytes, name, onProgress?) → ReadResult (dispatch + shared checks)
  protocol.ts         ToReader, FromReader
  readerWorker.ts     worker entry
  textBuilder.ts      TextBuilder (paragraphs, table cells and rows)
  zip.ts              openZip(bytes) → Zip; zipFormat(zip)
  xml.ts              xmlEvents(xml), decodeEntities(s)
  cfb.ts              openCfb(bytes) → Cfb; oleFormat(cfb)
  formats/
    text.ts           readText (txt, md, csv)
    html.ts           htmlToText(html), readHtml(bytes)
    rtf.ts            readRtf(bytes)
    mail.ts           mailText(headers, body)
    eml.ts            readEml(bytes)
    docx.ts           readDocx(zip)
    odt.ts            readOdt(zip)
    xlsx.ts           readXlsx(zip)
    pptx.ts           readPptx(zip)
    doc.ts            readDoc(cfb)
    msg.ts            readMsg(cfb)
    pdf.ts            readPdf(bytes, onProgress?)
    pdfLines.ts       pageText(items) (pure, unit-tested)
src/ui/
  FileWindow.tsx      the file window (reading → done → error)
  FilePicker.tsx      "Välj fil" button + hidden file input
  fileText.ts         statsLine(result), preview(text)
  DropZone.tsx        now hands dropped files up (onFiles)
  App.tsx             wires DropZone, FilePicker and FileWindow
  drop.ts, drop.test.ts   deleted (replaced by src/reader)
tests/fixtures/documents/
  build.ts            SAMPLE, esc, errorReason, buildZip, buildDocx, buildOdt, buildXlsx, buildPptx, buildPdf, buildCfb, buildDoc, buildMsg
  tika/               seven Apache Tika test documents + README.md (source, licence, sha256)
tests/e2e/
  file-import.spec.ts new
  helpers.ts          dropFile moves here (bytes or string), fileWindow()
  layout.spec.ts      its three drop tests move to file-import.spec.ts
  no-egress.spec.ts, offline.spec.ts, a11y.spec.ts   one new test each
```

---

### Task 1: Reader core and plain text files

Builds the reader module's skeleton: types, limits, decoding, detection, the dispatcher with its shared checks, the worker and `readDocument`. Only txt, md and csv are read; every other detected family is `unsupported` until its task.

**Files:**
- Create: `src/reader/types.ts`, `src/reader/limits.ts`, `src/reader/decode.ts`, `src/reader/detect.ts`, `src/reader/extract.ts`, `src/reader/protocol.ts`, `src/reader/readerWorker.ts`, `src/reader/index.ts`, `src/reader/formats/text.ts`
- Create: `tests/fixtures/documents/build.ts`
- Test: `src/reader/decode.test.ts`, `src/reader/detect.test.ts`, `src/reader/extract.test.ts`

**Interfaces:**
- Produces:
  - `type Format = "txt" | "md" | "csv" | "html" | "rtf" | "eml" | "msg" | "docx" | "doc" | "odt" | "pptx" | "xlsx" | "pdf"`
  - `type Note = "hiddenLeftOut" | "attachmentsLeftOut" | "onlyFirstFile"`
  - `type Stats = { words: number; pages?: number; slides?: number; sheets?: number }`
  - `type ErrorReason = "unsupported" | "encrypted" | "empty" | "noText" | "tooLarge" | "timeout" | "failed"`
  - `type ReadResult = { kind: "text"; text: string; format: Format; stats: Stats; notes: Note[] } | { kind: "error"; reason: ErrorReason }`
  - `interface Extracted { text: string; hidden?: boolean; attachments?: boolean; pages?: number; slides?: number; sheets?: number }` (what every format reader returns)
  - `class ReadError extends Error { readonly reason: ErrorReason }` (format readers throw it)
  - `type Progress = (page: number, pages: number) => void`
  - `decodeText(bytes: Uint8Array, declared?: string): string`, `labelForCodepage(cp: number): string`
  - `detect(bytes: Uint8Array, name: string): Detected` with `type Detected = { family: "zip" } | { family: "ole" } | { family: "pdf" } | { family: "rtf" } | { family: "text"; format: "txt" | "md" | "csv" | "html" | "eml" } | { family: "unknown" }`
  - `extract(bytes: Uint8Array, name: string, onProgress?: Progress): Promise<ReadResult>`
  - `readDocument(file: File, opts?: { onProgress?: Progress; signal?: AbortSignal }): Promise<ReadResult>` (rejects with a `DOMException` named `AbortError` when aborted)
  - test helpers: `SAMPLE`, `SAMPLE_TEXT`, `esc(s)`, `latin1(s)`, `errorReason(fn)`

- [ ] **Step 1: Write the fixture helpers**

Create `tests/fixtures/documents/build.ts`:

```ts
// Test documents, built by code so they are reproducible and reviewable.
// Every builder makes the same Swedish sample where it can, so tests compare
// against one expected text. Real-application files are in ./tika/.

/** The shared sample: a name, an organisation, a personnummer, an address and a phone number. */
export const SAMPLE = {
  title: "Anställningsavtal",
  lines: [
    "Mellan Norrström Media AB och Anna Berg, personnummer 19850312-4471.",
    "Anna bor på Storgatan 12 i Umeå och nås på 070-1740612.",
  ],
};
export const SAMPLE_TEXT = [SAMPLE.title, ...SAMPLE.lines].join("\n");

/** Escape text for XML and HTML. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One byte per character, for text in the latin-1 range (windows-1252 for å, ä, ö, é). */
export function latin1(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => {
    const code = c.charCodeAt(0);
    if (code > 0xff) throw new Error(`not latin-1: ${c}`);
    return code;
  });
}

/** The ReadError reason a call throws or rejects with, or "none". */
export async function errorReason(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return (e as { reason?: string }).reason ?? "not a ReadError";
  }
  return "none";
}
```

- [ ] **Step 2: Write the failing tests for decoding**

Create `src/reader/decode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latin1 } from "../../tests/fixtures/documents/build.ts";
import { decodeText, labelForCodepage } from "./decode.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("decodeText", () => {
  it("reads UTF-8", () => {
    expect(decodeText(utf8("Åsa på Öland"))).toBe("Åsa på Öland");
  });

  it("drops a UTF-8 byte order mark", () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe("A");
  });

  it("reads UTF-16 with a byte order mark", () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0xe5, 0x00, 0x41, 0x00]))).toBe("åA");
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0xe5, 0x00, 0x41]))).toBe("åA");
  });

  it("falls back to windows-1252 when the bytes are not UTF-8", () => {
    expect(decodeText(latin1("Åsa på Öland"))).toBe("Åsa på Öland");
  });

  it("uses a declared charset", () => {
    expect(decodeText(latin1("på"), "ISO-8859-1")).toBe("på");
  });

  it("ignores a declared charset it does not know", () => {
    expect(decodeText(utf8("på"), "x-nonsense")).toBe("på");
  });

  it("still checks bytes declared as UTF-8", () => {
    expect(decodeText(latin1("på"), "utf-8")).toBe("på");
  });
});

describe("labelForCodepage", () => {
  it.each([
    [65001, "utf-8"],
    [1252, "windows-1252"],
    [28591, "iso-8859-1"],
    [1200, "utf-16le"],
    [4711, "windows-1252"],
  ])("maps %i to %s", (cp, label) => {
    expect(labelForCodepage(cp)).toBe(label);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run src/reader/decode.test.ts`
Expected: FAIL, `Failed to resolve import "./decode.ts"`.

- [ ] **Step 4: Write types, limits and decoding**

Create `src/reader/types.ts`:

```ts
// What reading a document gives: the text and what to tell the user about
// it, or why it could not be read. See docs/ARCHITECTURE.md, Reading documents.

export type Format = "txt" | "md" | "csv" | "html" | "rtf" | "eml" | "msg" | "docx" | "doc" | "odt" | "pptx" | "xlsx" | "pdf";
export type Note = "hiddenLeftOut" | "attachmentsLeftOut" | "onlyFirstFile";
export type Stats = { words: number; pages?: number; slides?: number; sheets?: number };
export type ErrorReason = "unsupported" | "encrypted" | "empty" | "noText" | "tooLarge" | "timeout" | "failed";

export type ReadResult =
  | { kind: "text"; text: string; format: Format; stats: Stats; notes: Note[] }
  | { kind: "error"; reason: ErrorReason };

/** What a format reader returns, before the shared checks in extract.ts. */
export interface Extracted {
  text: string;
  /** Hidden content (comments, deletions, hidden text, notes, hidden slides or sheets) was present and left out. */
  hidden?: boolean;
  /** Attachments were present and left out. */
  attachments?: boolean;
  pages?: number;
  slides?: number;
  sheets?: number;
}

/** Thrown by a format reader when a file cannot be read. */
export class ReadError extends Error {
  readonly reason: ErrorReason;
  constructor(reason: ErrorReason) {
    super(reason);
    this.reason = reason;
  }
}

export type Progress = (page: number, pages: number) => void;
```

Create `src/reader/limits.ts`:

```ts
// Caps that keep a hostile or broken file from hanging the reader or eating
// memory. Exceeding one gives a plain error in the file window.
export const LIMITS = {
  fileBytes: 50 * 1024 * 1024,
  zipEntries: 2000,
  zipTotalBytes: 100 * 1024 * 1024,
  zipEntryBytes: 50 * 1024 * 1024,
  zipRatio: 200,
  timeoutMs: 30_000,
  textChars: 2_000_000,
} as const;
```

Create `src/reader/decode.ts`:

```ts
// Bytes to text. A byte order mark wins, then a declared charset, then UTF-8
// if the bytes are valid UTF-8, else windows-1252: Swedish files saved from
// Excel or old Windows programs are usually windows-1252, and read as UTF-8
// their å, ä and ö would turn into replacement characters.

const CODEPAGES: Record<number, string> = {
  65001: "utf-8",
  1252: "windows-1252",
  28591: "iso-8859-1",
  28605: "iso-8859-15",
  1200: "utf-16le",
  1201: "utf-16be",
  10000: "macintosh",
};

/** A TextDecoder label for a Windows code page number; windows-1252 when unknown. */
export function labelForCodepage(cp: number): string {
  return CODEPAGES[cp] ?? "windows-1252";
}

function decoderFor(label: string): TextDecoder | null {
  try {
    return new TextDecoder(label.trim().toLowerCase());
  } catch {
    return null;
  }
}

export function decodeText(bytes: Uint8Array, declared?: string): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const named = declared ? decoderFor(declared) : null;
  if (named && named.encoding !== "utf-8") return named.decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
```

- [ ] **Step 5: Run the decode tests**

Run: `npx vitest run src/reader/decode.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Write the failing tests for detection**

Create `src/reader/detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detect } from "./detect.ts";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe("detect", () => {
  it.each([
    ["a zip", bytes(0x50, 0x4b, 0x03, 0x04, 0x14), "x.bin", { family: "zip" }],
    ["an OLE file", bytes(...OLE, 0), "x.bin", { family: "ole" }],
    ["a PDF", ascii("%PDF-1.7\n"), "avtal.pdf", { family: "pdf" }],
    ["a PDF named .docx", ascii("%PDF-1.4\n"), "avtal.docx", { family: "pdf" }],
    ["a PDF after a few junk bytes", ascii("junk\r\n%PDF-1.4\n"), "avtal.pdf", { family: "pdf" }],
    ["RTF", ascii("{\\rtf1\\ansi hej}"), "brev.rtf", { family: "rtf" }],
    ["RTF named .doc", ascii("{\\rtf1 hej}"), "brev.doc", { family: "rtf" }],
    ["text by extension", ascii("hej"), "brev.txt", { family: "text", format: "txt" }],
    ["Markdown", ascii("# hej"), "NOTES.MD", { family: "text", format: "md" }],
    ["CSV", ascii("a;b"), "lista.csv", { family: "text", format: "csv" }],
    ["HTML", ascii("<p>hej</p>"), "sida.htm", { family: "text", format: "html" }],
    ["an email", ascii("From: a"), "mejl.eml", { family: "text", format: "eml" }],
    ["UTF-16 text with a byte order mark", bytes(0xff, 0xfe, 0x68, 0x00), "brev.txt", { family: "text", format: "txt" }],
  ])("finds %s", (_label, data, name, expected) => {
    expect(detect(data, name)).toEqual(expected);
  });

  it.each([
    ["an image", bytes(0x89, 0x50, 0x4e, 0x47), "bild.png"],
    ["text named .docx", ascii("hej"), "avtal.docx"],
    ["a binary file named .txt", bytes(0x68, 0x00, 0x65, 0x00), "brev.txt"],
    ["a file without an extension", ascii("hej"), "README"],
  ])("refuses %s", (_label, data, name) => {
    expect(detect(data, name)).toEqual({ family: "unknown" });
  });
});
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `npx vitest run src/reader/detect.test.ts`
Expected: FAIL, `Failed to resolve import "./detect.ts"`.

- [ ] **Step 8: Write detection**

Create `src/reader/detect.ts`:

```ts
// Which reader a file goes to, by its first bytes. The name only decides
// between plain-text formats, so a renamed file is never parsed as the
// wrong thing.

export type Detected =
  | { family: "zip" }
  | { family: "ole" }
  | { family: "pdf" }
  | { family: "rtf" }
  | { family: "text"; format: "txt" | "md" | "csv" | "html" | "eml" }
  | { family: "unknown" };

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const TEXT_EXTENSIONS: Record<string, "txt" | "md" | "csv" | "html" | "eml"> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  csv: "csv",
  html: "html",
  htm: "html",
  eml: "eml",
};

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

function asciiHead(b: Uint8Array, n: number): string {
  let s = "";
  for (let i = 0; i < Math.min(n, b.length); i++) s += String.fromCharCode(b[i]);
  return s;
}

const hasBom = (b: Uint8Array) => startsWith(b, [0xef, 0xbb, 0xbf]) || startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff]);

export function detect(bytes: Uint8Array, name: string): Detected {
  if (startsWith(bytes, ZIP)) return { family: "zip" };
  if (startsWith(bytes, OLE)) return { family: "ole" };
  // pdf.js accepts a header anywhere in the first kilobyte, as Acrobat does.
  if (asciiHead(bytes, 1024).includes("%PDF-")) return { family: "pdf" };
  const head = asciiHead(startsWith(bytes, [0xef, 0xbb, 0xbf]) ? bytes.subarray(3) : bytes, 5);
  if (head === "{\\rtf") return { family: "rtf" };
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  const format = TEXT_EXTENSIONS[ext];
  if (!format) return { family: "unknown" };
  if (!hasBom(bytes) && bytes.subarray(0, 8192).includes(0)) return { family: "unknown" };
  return { family: "text", format };
}
```

- [ ] **Step 9: Run the detection tests**

Run: `npx vitest run src/reader/detect.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 10: Write the failing tests for extract**

Create `src/reader/extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latin1 } from "../../tests/fixtures/documents/build.ts";
import { extract } from "./extract.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("extract", () => {
  it("reads a text file and counts its words", async () => {
    expect(await extract(utf8("Hej Anna\r\n"), "brev.txt")).toEqual({
      kind: "text",
      text: "Hej Anna",
      format: "txt",
      stats: { words: 2 },
      notes: [],
    });
  });

  it("reads a windows-1252 CSV with å, ä and ö", async () => {
    const result = await extract(latin1("Namn;Ort\r\nÅsa Öberg;Umeå\r\n"), "lista.csv");
    expect(result).toMatchObject({ kind: "text", text: "Namn;Ort\nÅsa Öberg;Umeå", format: "csv" });
  });

  it("tidies line ends, trailing spaces and runs of blank lines", async () => {
    const result = await extract(utf8("Rad ett  \n\n\n\nRad två\t\n"), "brev.md");
    expect(result).toMatchObject({ text: "Rad ett\n\nRad två", format: "md" });
  });

  it("says a file with only whitespace is empty", async () => {
    expect(await extract(utf8(" \n\t\n"), "tom.txt")).toEqual({ kind: "error", reason: "empty" });
  });

  it("refuses a text that is too long", async () => {
    expect(await extract(utf8("a ".repeat(1_000_001)), "lang.txt")).toEqual({ kind: "error", reason: "tooLarge" });
  });

  it("refuses a file it does not know", async () => {
    expect(await extract(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "bild.png")).toEqual({ kind: "error", reason: "unsupported" });
  });

  it("refuses a text file named like a Word file", async () => {
    expect(await extract(utf8("hej"), "avtal.docx")).toEqual({ kind: "error", reason: "unsupported" });
  });
});
```

- [ ] **Step 11: Run it to make sure it fails**

Run: `npx vitest run src/reader/extract.test.ts`
Expected: FAIL, `Failed to resolve import "./extract.ts"`.

- [ ] **Step 12: Write the text reader and extract**

Create `src/reader/formats/text.ts`:

```ts
import { decodeText } from "../decode.ts";
import type { Extracted } from "../types.ts";

/** txt, md and csv: the decoded text as it is. */
export function readText(bytes: Uint8Array): Extracted {
  return { text: decodeText(bytes) };
}
```

Create `src/reader/extract.ts`:

```ts
// Reads one file's bytes into a ReadResult: detect the format, run its
// reader, then the checks every format shares. Runs in the reader worker
// (readerWorker.ts) and, for tests, in Node.
import { detect } from "./detect.ts";
import { readText } from "./formats/text.ts";
import { LIMITS } from "./limits.ts";
import { type Extracted, type Format, type Note, type Progress, ReadError, type ReadResult, type Stats } from "./types.ts";

const WORD = /[\p{L}\p{N}]+/gu;

export async function extract(bytes: Uint8Array, name: string, onProgress?: Progress): Promise<ReadResult> {
  try {
    const { format, extracted } = await dispatch(bytes, name, onProgress);
    return finish(format, extracted);
  } catch (e) {
    return { kind: "error", reason: e instanceof ReadError ? e.reason : "failed" };
  }
}

async function dispatch(bytes: Uint8Array, name: string, _onProgress?: Progress): Promise<{ format: Format; extracted: Extracted }> {
  const found = detect(bytes, name);
  switch (found.family) {
    case "text":
      if (found.format === "txt" || found.format === "md" || found.format === "csv") return { format: found.format, extracted: readText(bytes) };
      throw new ReadError("unsupported");
    default:
      throw new ReadError("unsupported");
  }
}

function finish(format: Format, x: Extracted): ReadResult {
  const text = x.text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { kind: "error", reason: "empty" };
  if (text.length > LIMITS.textChars) return { kind: "error", reason: "tooLarge" };
  const notes: Note[] = [];
  if (x.hidden) notes.push("hiddenLeftOut");
  if (x.attachments) notes.push("attachmentsLeftOut");
  const stats: Stats = { words: text.match(WORD)?.length ?? 0 };
  if (x.pages !== undefined) stats.pages = x.pages;
  if (x.slides !== undefined) stats.slides = x.slides;
  if (x.sheets !== undefined) stats.sheets = x.sheets;
  return { kind: "text", text, format, stats, notes };
}
```

- [ ] **Step 13: Run the extract tests**

Run: `npx vitest run src/reader/extract.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 14: Write the worker, its protocol and readDocument**

Create `src/reader/protocol.ts`:

```ts
import type { ReadResult } from "./types.ts";

/** Page → reader worker: the file, transferred. */
export type ToReader = { bytes: ArrayBuffer; name: string };
/** Reader worker → page. */
export type FromReader = { type: "progress"; page: number; pages: number } | { type: "result"; result: ReadResult };
```

Create `src/reader/readerWorker.ts`:

```ts
// Web Worker: reads one dropped or chosen file into text. The page starts a
// fresh one per file and terminates it when the result arrives, on cancel
// and on timeout, so nothing from the file outlives the read.
import { extract } from "./extract.ts";
import type { FromReader, ToReader } from "./protocol.ts";

const post = (msg: FromReader) => postMessage(msg);

self.onmessage = async (e: MessageEvent<ToReader>) => {
  const result = await extract(new Uint8Array(e.data.bytes), e.data.name, (page, pages) => post({ type: "progress", page, pages }));
  post({ type: "result", result });
};
```

Create `src/reader/index.ts`:

```ts
// Reading documents (PDF, Word and others) into text, in the browser. The
// only part of src/reader/ the UI imports. See docs/ARCHITECTURE.md.
import { LIMITS } from "./limits.ts";
import type { FromReader, ToReader } from "./protocol.ts";
import type { Progress, ReadResult } from "./types.ts";

export type { ErrorReason, Format, Note, ReadResult, Stats } from "./types.ts";

export interface ReadOptions {
  onProgress?: Progress;
  signal?: AbortSignal;
}

/** Reads a file in a worker of its own. Rejects with an AbortError when `signal` aborts. */
export function readDocument(file: File, opts: ReadOptions = {}): Promise<ReadResult> {
  if (file.size > LIMITS.fileBytes) return Promise.resolve({ kind: "error", reason: "tooLarge" });
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./readerWorker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const stop = () => {
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      opts.signal?.removeEventListener("abort", onAbort);
    };
    const finish = (result: ReadResult) => {
      if (settled) return;
      stop();
      resolve(result);
    };
    const onAbort = () => {
      if (settled) return;
      stop();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => finish({ kind: "error", reason: "timeout" }), LIMITS.timeoutMs);
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener("abort", onAbort);
    worker.onmessage = (e: MessageEvent<FromReader>) => {
      if (e.data.type === "progress") opts.onProgress?.(e.data.page, e.data.pages);
      else finish(e.data.result);
    };
    worker.onerror = () => finish({ kind: "error", reason: "failed" });
    file.arrayBuffer().then(
      (bytes) => {
        if (settled) return;
        const msg: ToReader = { bytes, name: file.name };
        worker.postMessage(msg, [bytes]);
      },
      () => finish({ kind: "error", reason: "failed" }),
    );
  });
}
```

- [ ] **Step 15: Typecheck and run all unit tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck passes; all Vitest tests pass (the existing ones plus 37 new).

- [ ] **Step 16: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Reader: read text files in a worker, detect formats by their bytes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The file window and Välj fil

Every dropped or chosen file opens the file window: reading, then a summary with a preview and "Använd texten", or an error. Replaces `src/ui/drop.ts`. At the end of this task only txt, md and csv read; other files show the unsupported message in the window.

**Files:**
- Create: `src/ui/FileWindow.tsx`, `src/ui/FilePicker.tsx`, `src/ui/fileText.ts`, `src/ui/fileText.test.ts`, `tests/e2e/file-import.spec.ts`
- Modify: `src/ui/DropZone.tsx` (whole file), `src/ui/App.tsx` (imports, state at line 41, pane head at lines 278–293, the two `DropZone`s at lines 296–336, the drop notice at lines 344–348, the dialogs), `src/ui/copy.ts`, `docs/COPY.md`, `src/ui/styles.css` (after `.modal-lead`, line ~797), `tests/e2e/helpers.ts`, `tests/e2e/layout.spec.ts` (lines 1–40)
- Delete: `src/ui/drop.ts`, `src/ui/drop.test.ts`

**Interfaces:**
- Consumes: `readDocument`, `ReadResult`, `ErrorReason`, `Format`, `Note` from `src/reader/index.ts` (Task 1).
- Produces: `interface FileJob { file: File; target: "text" | "answer"; multiple: boolean; replaces: boolean }`; `<FileWindow job onUse onClose />`; `<FilePicker onFile disabled? />`; `DropZone` prop `onFiles(files: File[])`; `statsLine(result)`, `preview(text)`; e2e helpers `dropFile(page, target, name, type, content: string | Uint8Array)` and `fileWindow(page)`.

- [ ] **Step 1: Add the copy to docs/COPY.md**

In `docs/COPY.md`, in the "Fasta strängar" table:

Replace the row
`| editor.empty | Klistra in text här eller släpp en textfil. Den stannar i din webbläsare och inget laddas upp. |`
with
`| editor.empty | Klistra in text här eller släpp ett dokument. Det stannar i din webbläsare och inget laddas upp. |`

Replace the row
`| restore.empty | Klistra in svaret från AI här eller släpp en skrubbad textfil. |`
with
`| restore.empty | Klistra in svaret från AI här eller släpp ett dokument med svaret. |`

Replace the row `| drop.unsupported | … |` (line 75) with these rows:

```
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
```

In the notes under the table (lines 117–118), replace

```
- `editor.empty` och `restore.empty`: nämner att man kan släppa en textfil.
- `drop.unsupported`: när någon släpper en fil som inte är .txt eller .md.
```

with

```
- `editor.empty` och `restore.empty` nämner att man kan släppa ett dokument.
- `file.*` hör till fönstret Läs in dokument, som öppnas när någon släpper en fil eller väljer Välj fil. `file.format.*` är typen i raden under filnamnet, till exempel "Word · 1 240 ord". Utkast 2026-10-14, ska granskas av ägaren.
```

- [ ] **Step 2: Mirror the copy in src/ui/copy.ts**

In `src/ui/copy.ts`, change `editor.empty` and `restore.empty` to the new texts above, delete the `"drop.unsupported"` entry (line 62), and add after the position where it was:

```ts
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
```

Run: `npx vitest run src/ui/copy.test.ts`
Expected: PASS (the copy matches `docs/COPY.md`).

- [ ] **Step 3: Write the failing tests for the summary line and preview**

Create `src/ui/fileText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { preview, statsLine } from "./fileText.ts";

const result = (format: "pdf" | "docx" | "pptx" | "xlsx", stats: object) =>
  ({ kind: "text", text: "", format, stats, notes: [] }) as Parameters<typeof statsLine>[0];

describe("statsLine", () => {
  it("names the type and counts words with a Swedish thousands space", () => {
    expect(statsLine(result("docx", { words: 1240 }))).toBe("Word · 1 240 ord");
  });

  it("puts pages before words", () => {
    expect(statsLine(result("pdf", { words: 4300, pages: 12 }))).toBe("PDF · 12 sidor · 4 300 ord");
    expect(statsLine(result("pdf", { words: 3, pages: 1 }))).toBe("PDF · 1 sida · 3 ord");
  });

  it("counts slides and sheets", () => {
    expect(statsLine(result("pptx", { words: 9, slides: 1 }))).toBe("PowerPoint · 1 bild · 9 ord");
    expect(statsLine(result("xlsx", { words: 9, sheets: 2 }))).toBe("Excel · 2 blad · 9 ord");
  });
});

describe("preview", () => {
  it("shows a short text whole", () => {
    expect(preview("Anna Berg")).toBe("Anna Berg");
  });

  it("cuts a long text at a word and marks the cut", () => {
    const text = `${"ord ".repeat(300)}slut`;
    const shown = preview(text);
    expect(shown.length).toBeLessThanOrEqual(1002);
    expect(shown.endsWith("ord …")).toBe(true);
  });
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `npx vitest run src/ui/fileText.test.ts`
Expected: FAIL, `Failed to resolve import "./fileText.ts"`.

- [ ] **Step 5: Write fileText.ts**

Create `src/ui/fileText.ts`:

```ts
// The summary line and preview in the file window.
import type { Format, ReadResult } from "../reader/index.ts";
import { type CopyKey, t } from "./copy.ts";

type TextResult = Extract<ReadResult, { kind: "text" }>;

const FORMAT_KEY: Record<Format, CopyKey> = {
  pdf: "file.format.pdf",
  docx: "file.format.docx",
  doc: "file.format.doc",
  odt: "file.format.odt",
  rtf: "file.format.rtf",
  msg: "file.format.msg",
  eml: "file.format.eml",
  html: "file.format.html",
  csv: "file.format.csv",
  xlsx: "file.format.xlsx",
  pptx: "file.format.pptx",
  txt: "file.format.txt",
  md: "file.format.md",
};
const PREVIEW_CHARS = 1000;

/** "Word · 1 240 ord", "PDF · 12 sidor · 4 300 ord". */
export function statsLine({ format, stats }: TextResult): string {
  const parts = [t(FORMAT_KEY[format])];
  if (stats.pages !== undefined) parts.push(stats.pages === 1 ? t("file.pages.one") : t("file.pages", { n: stats.pages }));
  if (stats.slides !== undefined) parts.push(stats.slides === 1 ? t("file.slides.one") : t("file.slides", { n: stats.slides }));
  if (stats.sheets !== undefined) parts.push(t("file.sheets", { n: stats.sheets }));
  parts.push(t("file.words", { n: stats.words.toLocaleString("sv-SE") }));
  return parts.join(" · ");
}

/** The start of the text, cut at a word, with " …" when cut. */
export function preview(text: string): string {
  if (text.length <= PREVIEW_CHARS) return text;
  const cut = text.slice(0, PREVIEW_CHARS);
  const lastSpace = cut.search(/\s\S*$/);
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut} …`;
}
```

Run: `npx vitest run src/ui/fileText.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the file window and the picker**

Create `src/ui/FileWindow.tsx`:

```tsx
import { useEffect, useState } from "react";
import { type ErrorReason, type Note, readDocument, type ReadResult } from "../reader/index.ts";
import { type CopyKey, t } from "./copy.ts";
import { preview, statsLine } from "./fileText.ts";
import { Modal } from "./Modal.tsx";

/** A file to read and the pane its text goes to. */
export interface FileJob {
  file: File;
  target: "text" | "answer";
  /** More than one file was dropped; only `file` is read. */
  multiple: boolean;
  /** The target pane has text that "Använd texten" replaces. */
  replaces: boolean;
}

type TextResult = Extract<ReadResult, { kind: "text" }>;
type State = { step: "reading"; page?: number; pages?: number } | { step: "done"; result: TextResult } | { step: "error"; reason: ErrorReason };

const ERROR_KEY: Record<ErrorReason, CopyKey> = {
  unsupported: "file.error.unsupported",
  encrypted: "file.error.encrypted",
  empty: "file.error.empty",
  noText: "file.error.noText",
  tooLarge: "file.error.tooLarge",
  timeout: "file.error.timeout",
  failed: "file.error.failed",
};
const NOTE_KEY: Record<Note, CopyKey> = {
  hiddenLeftOut: "file.note.hidden",
  attachmentsLeftOut: "file.note.attachments",
  onlyFirstFile: "file.note.firstOnly",
};

/**
 * Läs in dokument: every dropped or chosen file is read here, in a worker,
 * while the window says so. The pane changes only on "Använd texten".
 * Closing the window (Avbryt, Stäng, Esc) stops the read.
 */
export function FileWindow({ job, onUse, onClose }: { job: FileJob | null; onUse(text: string): void; onClose(): void }) {
  const [state, setState] = useState<State>({ step: "reading" });

  useEffect(() => {
    if (!job) return;
    setState({ step: "reading" });
    const reading = new AbortController();
    readDocument(job.file, { signal: reading.signal, onProgress: (page, pages) => setState({ step: "reading", page, pages }) }).then(
      (result) => setState(result.kind === "text" ? { step: "done", result } : { step: "error", reason: result.reason }),
      () => {}, // aborted: the window is closing
    );
    return () => reading.abort();
  }, [job]);

  const notes: Note[] = state.step === "done" ? [...(job?.multiple ? (["onlyFirstFile"] as Note[]) : []), ...state.result.notes] : [];

  return (
    <Modal open={job !== null} onClose={onClose} title={t("file.title")}>
      {job && (
        <div className="file-window">
          <p className="file-name">{job.file.name}</p>
          {state.step === "reading" && (
            <>
              <p className="file-progress" role="status">
                {state.pages ? t("file.readingPage", { page: state.page ?? 1, pages: state.pages }) : t("file.reading")}
              </p>
              <div className="file-actions">
                <button type="button" onClick={onClose}>
                  {t("file.cancel")}
                </button>
              </div>
            </>
          )}
          {state.step === "done" && (
            <>
              <p className="file-stats">{statsLine(state.result)}</p>
              {notes.map((note) => (
                <p className="notice" key={note}>
                  {t(NOTE_KEY[note])}
                </p>
              ))}
              {job.replaces && <p className="notice">{t("file.replaces")}</p>}
              {/* Focusable so the scrollable preview can be read with the keyboard. */}
              <pre className="file-preview" tabIndex={0} aria-label={t("file.preview")}>
                {preview(state.result.text)}
              </pre>
              <div className="file-actions">
                <button type="button" className="primary" autoFocus onClick={() => onUse(state.result.text)}>
                  {t("file.use")}
                </button>
                <button type="button" onClick={onClose}>
                  {t("file.cancel")}
                </button>
              </div>
            </>
          )}
          {state.step === "error" && (
            <p className="notice" role="alert">
              {t(ERROR_KEY[state.reason])}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
```

Create `src/ui/FilePicker.tsx`:

```tsx
import { useRef } from "react";
import { t } from "./copy.ts";

/** What the file dialog offers. Other files can still be dropped and get a plain message. */
const ACCEPT = ".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.csv,.html,.htm,.eml,.msg,.pptx,.xlsx";

/** "Välj fil": a real button that opens the file dialog, for keyboards and phones. */
export function FilePicker({ onFile, disabled }: { onFile(file: File): void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="link" aria-haspopup="dialog" disabled={disabled} onClick={() => input.current?.click()}>
        {t("file.choose")}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
```

Replace `src/ui/DropZone.tsx` entirely with:

```tsx
import { type ReactNode, useState } from "react";

interface Props {
  children: ReactNode;
  onFiles(files: File[]): void;
}

/** A card that accepts dropped files and hands them to the file window. */
export function DropZone({ children, onFiles }: Props) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? "dropzone-over" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
    >
      {children}
    </div>
  );
}
```

Delete the old reader: `git rm src/ui/drop.ts src/ui/drop.test.ts`

- [ ] **Step 7: Wire it into App.tsx**

In `src/ui/App.tsx`:

1. Add imports next to the `DropZone` import:

```tsx
import { FilePicker } from "./FilePicker.tsx";
import { type FileJob, FileWindow } from "./FileWindow.tsx";
```

2. Replace `const [dropError, setDropError] = useState(false);` (line 41) with:

```tsx
  const [fileJob, setFileJob] = useState<FileJob | null>(null);
```

3. Below the other handler functions in the component (next to `uploadKey`), add:

```tsx
  /** Opens the file window for the first of the files, for the left pane of the mode. */
  function openFiles(files: File[], target: FileJob["target"]) {
    const current = target === "text" ? state.text : state.answer;
    setFileJob({ file: files[0], target, multiple: files.length > 1, replaces: current.trim() !== "" });
  }

  /** "Använd texten": the read text goes into the pane the file was for, like a dropped text file did. */
  function applyFileText(text: string) {
    const target = fileJob?.target;
    setFileJob(null);
    if (target === "answer") {
      dispatch({ type: "setAnswer", text });
      setTimeout(() => answerPane.current?.focus());
    } else {
      pasted.current = true;
      dispatch({ type: "setText", text });
      setTimeout(() => editor.current?.focus());
    }
  }
```

4. In the pane head, right after the `{mode === "scrub" && ( … Visa exempel … )}` block (ends at line 293), add:

```tsx
            <FilePicker
              disabled={mode === "scrub" && state.model.status === "loading"}
              onFile={(file) => openFiles([file], mode === "scrub" ? "text" : "answer")}
            />
```

5. Replace the Avskrubba `DropZone` props

```tsx
            <DropZone
              onText={(text) => {
                setDropError(false);
                dispatch({ type: "setAnswer", text });
              }}
              onUnsupported={() => setDropError(true)}
            >
```

with

```tsx
            <DropZone onFiles={(files) => openFiles(files, "answer")}>
```

and the Skrubba `DropZone` props

```tsx
            <DropZone
              onText={(text) => {
                setDropError(false);
                pasted.current = true;
                dispatch({ type: "setText", text });
              }}
              onUnsupported={() => setDropError(true)}
            >
```

with

```tsx
            <DropZone onFiles={(files) => openFiles(files, "text")}>
```

6. Delete the drop notice:

```tsx
          {dropError && (
            <p className="notice" role="alert">
              {t("drop.unsupported")}
            </p>
          )}
```

7. Next to `<FaqDialog … />` in the JSX, add:

```tsx
      <FileWindow job={fileJob} onUse={applyFileText} onClose={() => setFileJob(null)} />
```

Run: `npm run typecheck`
Expected: passes. If `pane-head` puts the two links on separate lines, wrap them as the help links are: `<span className="help-sep" aria-hidden="true" />` between "Visa exempel" and "Välj fil".

- [ ] **Step 8: Style the window**

In `src/ui/styles.css`, after the `.modal-lead` rule, add:

```css
/* Läs in dokument: reading, then a summary and the start of the text. */

.file-window {
  display: grid;
  gap: var(--space-3);
  max-width: 44em;
}

.file-name {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.file-progress,
.file-stats {
  margin: 0;
  color: var(--muted);
}

.file-preview {
  margin: 0;
  max-height: 14em;
  overflow: auto;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--yta-sankt);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
```

- [ ] **Step 9: Move the drop helper and write the failing e2e tests**

In `tests/e2e/helpers.ts`, add `type Locator` to the Playwright import and append:

```ts
/** Simulate dropping one or more files on an element. Content is text or bytes. */
export async function dropFile(page: Page, target: Locator, name: string, type: string, content: string | Uint8Array, extra: string[] = []) {
  const data = await page.evaluateHandle(
    ({ name, type, content, extra }) => {
      const dt = new DataTransfer();
      const body = typeof content === "string" ? content : new Uint8Array(content);
      dt.items.add(new File([body], name, { type }));
      for (const more of extra) dt.items.add(new File(["x"], more, { type: "text/plain" }));
      return dt;
    },
    { name, type, content: typeof content === "string" ? content : Array.from(content), extra },
  );
  await target.dispatchEvent("dragover", { dataTransfer: data });
  await target.dispatchEvent("drop", { dataTransfer: data });
}
/** The Läs in dokument window. */
export const fileWindow = (page: Page) => page.getByRole("dialog", { name: "Läs in dokument" });
```

In `tests/e2e/layout.spec.ts`, delete the local `dropFile` function and the three tests "a dropped .txt file lands in Din text and is marked", "a dropped .md file lands in Svar från AI" and "a dropped PDF is refused with a message and nothing changes" (lines 4–40). Remove imports that are now unused.

Create `tests/e2e/file-import.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SAMPLE_TEXT } from "../fixtures/documents/build.ts";
import { answerBox, dropFile, editor, fileWindow, openReady, rows } from "./helpers.ts";

test("a dropped text file opens the window, and Använd texten puts it in Din text", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toBeVisible();
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Text · 23 ord");
  await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
  const use = w.getByRole("button", { name: "Använd texten" });
  await expect(use).toBeFocused();
  await use.click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toContainText("Anna Berg");
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Välj fil opens the same window", async ({ page }) => {
  await openReady(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Välj fil" }).click();
  await (await chooser).setFiles({ name: "avtal.md", mimeType: "text/markdown", buffer: Buffer.from(SAMPLE_TEXT) });
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(editor(page)).toContainText("Storgatan 12");
});

test("a dropped file lands in Svar från AI in Avskrubba", async ({ page }) => {
  await openReady(page);
  const box = await answerBox(page);
  await dropFile(page, box, "svar.md", "text/markdown", "# Svar\n\nHej [NAMN_1].");
  await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
  await expect(box).toHaveValue("# Svar\n\nHej [NAMN_1].");
});

test("with text in the pane, the window warns, and Avbryt keeps the old text", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  const w = fileWindow(page);
  await expect(w).toContainText("Texten som står i rutan nu ersätts.");
  await w.getByRole("button", { name: "Avbryt" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveText("Min egen text.");
});

test("Esc closes the window and changes nothing", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Min egen text.");
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
  await expect(fileWindow(page).getByRole("button", { name: "Använd texten" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(fileWindow(page)).toBeHidden();
  await expect(editor(page)).toHaveText("Min egen text.");
});

test("an unsupported file gets a plain message and changes nothing", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "bild.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  const w = fileWindow(page);
  await expect(w.getByRole("alert")).toHaveText(/^Den här filtypen går inte att läsa\./);
  await w.getByRole("button", { name: "Stäng" }).click();
  await expect(w).toBeHidden();
  await expect(editor(page)).toHaveText("");
});

test("dropping two files reads the first and says so", async ({ page }) => {
  await openReady(page);
  await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT, ["annat.txt"]);
  const w = fileWindow(page);
  await expect(w).toContainText("avtal.txt");
  await expect(w).toContainText("Bara en fil i taget. Den första lästes.");
});

test.describe("while reading", () => {
  // Without the offline cache, page.route sees the reader worker's request and can hold it.
  test.use({ serviceWorkers: "block" });

  test("Avbryt stops the read and leaves the pane alone", async ({ page }) => {
    await openReady(page);
    await editor(page).fill("Min egen text.");
    await page.route("**/readerWorker-*.js", () => new Promise(() => {}));
    await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
    const w = fileWindow(page);
    await expect(w.getByRole("status")).toHaveText("Läser dokumentet …");
    await w.getByRole("button", { name: "Avbryt" }).click();
    await expect(w).toBeHidden();
    await expect(editor(page)).toHaveText("Min egen text.");
  });
});
```

`SAMPLE_TEXT` has 23 words by the reader's count (runs of letters and digits; "19850312-4471" and "070-1740612" count as two each).

- [ ] **Step 10: Run the e2e tests**

Run: `npx playwright test tests/e2e/file-import.spec.ts tests/e2e/layout.spec.ts`
Expected: PASS in Chromium, Firefox and WebKit.

- [ ] **Step 11: Check both themes by eye**

Run: `npm run build && npx vite preview --port 4174`, open `http://localhost:4174`, drop a `.txt` file, and look at the window in light and dark (system setting or DevTools "Emulate CSS prefers-color-scheme"). Check the preview box has contrast against the window and the buttons wrap on a 360 px wide viewport. Stop the server.

- [ ] **Step 12: Run everything and commit**

Run: `npm run typecheck && npx vitest run`
Expected: all pass.

```bash
git add -A src/ui docs/COPY.md tests/e2e
git commit -m "Read dropped and chosen files in a window that shows progress, a summary and a preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Zip, XML and Word (.docx)

The zip reader (browser `DecompressionStream`, with the zip bomb caps), a minimal XML tokenizer, a text builder for paragraphs and tables, OOXML relationships, and the docx reader. Also commits the Apache Tika real-application fixtures used by this and later tasks.

**Files:**
- Create: `src/reader/zip.ts`, `src/reader/xml.ts`, `src/reader/textBuilder.ts`, `src/reader/ooxml.ts`, `src/reader/formats/docx.ts`
- Create: `tests/fixtures/documents/tika/README.md`, `tests/fixtures/documents/tika/fetch.sh`, and the seven files it fetches
- Modify: `tests/fixtures/documents/build.ts` (add `buildZip`, `buildDocx`, `wp`), `src/reader/extract.ts` (zip case), `tests/e2e/file-import.spec.ts` (one docx test)
- Test: `src/reader/zip.test.ts`, `src/reader/xml.test.ts`, `src/reader/formats/docx.test.ts`, `src/reader/extract.test.ts`

**Interfaces:**
- Consumes: `ReadError`, `Extracted`, `LIMITS`, `decodeText` (Task 1).
- Produces:
  - `interface Zip { has(name: string): boolean; names(): string[]; bytes(name: string): Promise<Uint8Array | null>; text(name: string): Promise<string | null> }`
  - `openZip(data: Uint8Array): Zip` (throws `ReadError("failed")` on a broken zip or a cap); `zipFormat(zip: Zip): Promise<"docx" | "odt" | "pptx" | "xlsx" | null>`
  - `type XmlEvent = { type: "open"; name: string; attrs: Record<string, string>; selfClosing: boolean } | { type: "close"; name: string } | { type: "text"; text: string }`; `xmlEvents(xml: string): Generator<XmlEvent>` (a self-closing element yields its open and then its close); `decodeEntities(s: string): string`
  - `class TextBuilder { add(s: string): void; openCell(): void; closeCell(): void; closeRow(): void; toString(): string }`
  - `relationships(xml: string, base: string): Array<{ id: string; type: string; target: string }>` (`type` is the last segment of the relationship type URL, `target` a zip path)
  - `readDocx(zip: Zip): Promise<Extracted>`, `wordPartText(xml: string): { text: string; hidden: boolean }`
  - test helpers `buildZip(files, opts?)`, `buildDocx(parts)`, `wp(text)`

- [ ] **Step 1: Commit the Tika fixtures**

Create `tests/fixtures/documents/tika/fetch.sh`:

```sh
#!/bin/sh
# Fetches the Apache Tika test documents used by the reader tests and checks
# their sha256. Run from the repo root: sh tests/fixtures/documents/tika/fetch.sh
set -e
cd "$(dirname "$0")"
BASE="https://raw.githubusercontent.com/apache/tika/7cb848a1ac9c3374ebaa909225ba2185a54ae074/tika-parsers/tika-parsers-standard/tika-parsers-standard-modules"
MS="$BASE/tika-parser-microsoft-module/src/test/resources/test-documents"
for f in testWORD.docx testWORD.doc testPPT.pptx testEXCEL.xlsx test-outlook.msg; do curl -sfo "$f" "$MS/$f"; done
curl -sfo testOpenOffice2.odt "$BASE/tika-parser-miscoffice-module/src/test/resources/test-documents/testOpenOffice2.odt"
curl -sfo testPDF.pdf "$BASE/tika-parser-pdf-module/src/test/resources/test-documents/testPDF.pdf"
shasum -a 256 -c <<'SUMS'
ba546a434638c46fc6f1edd802c9084b95752afef2fa0aee8301388ab1f8131e  test-outlook.msg
960ba8f1cfa5838b563c369d281babe4ac0219100e00cecc93147fad22c549c3  testEXCEL.xlsx
daee7b62602780f2599c19b3593a1e455a21e041959416304c112bdb136640bb  testOpenOffice2.odt
8035bc3f748d8b97b8a9978bd812197bf40cf2b294a7e9b30e39d7167ddc720e  testPDF.pdf
730a6ade20208eaad375160949db37b2ffb52af4d3704b51976ff45564bff83b  testPPT.pptx
5ca19b67876f284a0e04ed06df44a004f850629a871fe522d014e1fdff912799  testWORD.doc
67797f5691cb5346201f1c40000a959f9f08d05d0b4493b4291e8d5f16e81e65  testWORD.docx
SUMS
```

Create `tests/fixtures/documents/tika/README.md`:

```markdown
# Apache Tika test documents

Real files made by Microsoft Office, Outlook, NeoOffice and a PDF writer, from the Apache Tika project's test suite at commit `7cb848a1ac9c3374ebaa909225ba2185a54ae074`. They check the readers against files no code of ours produced. Licensed under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0); copyright The Apache Software Foundation.

`fetch.sh` downloads them again and checks each sha256.

| File | Made by | Text the tests look for |
|---|---|---|
| testWORD.docx | Word | "This is a sample Microsoft Word Document.", header "This is the header for our document", footer "This is the footer for our document", "Nested table" |
| testWORD.doc | Word 97–2003 | the same body text; a HYPERLINK field whose result is "http://tika.apache.org/" |
| testPPT.pptx | PowerPoint | "Attachment Test", "Rajiv" |
| testEXCEL.xlsx | Excel X for Mac | "Sample Excel Worksheet - Numbers and their Squares" |
| test-outlook.msg | Outlook Express (8-bit strings) | subject "Nouvel utilisateur de Outlook Express", "Messagerie et groupes de discussion" |
| testOpenOffice2.odt | NeoOffice 2.2.1 | "This is a sample Open Office document" |
| testPDF.pdf | PDF 1.3 | "Tika" |
```

Run: `sh tests/fixtures/documents/tika/fetch.sh`
Expected: seven `: OK` lines. (If a shell guard refuses the command because the URL contains "github", run it exactly as written, as a script file; do not inline it.)

- [ ] **Step 2: Add the zip and docx builders**

Add `import { crc32, deflateRawSync } from "node:zlib";` at the top of `tests/fixtures/documents/build.ts` and append:

```ts
/**
 * A zip file. Entries are deflated except `mimetype` (ODF wants it stored)
 * or when `store` is set. `encrypted` sets the encryption flag on entries;
 * `declaredSize` lies about an entry's size, to test the caps.
 */
export function buildZip(
  files: Record<string, string | Uint8Array>,
  opts: { store?: boolean; encrypted?: string[]; declaredSize?: Record<string, number> } = {},
): Uint8Array {
  const enc = new TextEncoder();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === "string" ? enc.encode(content) : content;
    const nameBytes = Buffer.from(enc.encode(name));
    const method = opts.store || name === "mimetype" ? 0 : 8;
    const comp = method === 8 ? deflateRawSync(data) : Buffer.from(data);
    const flags = 0x0800 | (opts.encrypted?.includes(name) ? 1 : 0);
    const size = opts.declaredSize?.[name] ?? data.length;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, comp);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  const count = Object.keys(files).length;
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
export const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** A Word paragraph with one run. */
export const wp = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

/** A .docx with the given body XML and optional headers, footers, footnotes and comments (inner XML of each part). */
export function buildDocx(parts: { body: string; headers?: string[]; footers?: string[]; footnotes?: string; comments?: string }): Uint8Array {
  const files: Record<string, string> = {};
  const rels: string[] = [];
  parts.headers?.forEach((xml, i) => {
    files[`word/header${i + 1}.xml`] = `<w:hdr ${W_NS}>${xml}</w:hdr>`;
    rels.push(`<Relationship Id="rIdH${i + 1}" Type="${REL}/header" Target="header${i + 1}.xml"/>`);
  });
  parts.footers?.forEach((xml, i) => {
    files[`word/footer${i + 1}.xml`] = `<w:ftr ${W_NS}>${xml}</w:ftr>`;
    rels.push(`<Relationship Id="rIdF${i + 1}" Type="${REL}/footer" Target="footer${i + 1}.xml"/>`);
  });
  if (parts.footnotes) files["word/footnotes.xml"] = `<w:footnotes ${W_NS}>${parts.footnotes}</w:footnotes>`;
  if (parts.comments) files["word/comments.xml"] = `<w:comments ${W_NS}>${parts.comments}</w:comments>`;
  return buildZip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${parts.body}</w:body></w:document>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${rels.join("")}</Relationships>`,
    ...files,
  });
}
```

- [ ] **Step 3: Write the failing tests for zip and XML**

Create `src/reader/zip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildZip, errorReason } from "../../tests/fixtures/documents/build.ts";
import { openZip, zipFormat } from "./zip.ts";

describe("openZip", () => {
  it.each([false, true])("reads entries (stored: %s)", async (store) => {
    const zip = openZip(buildZip({ "a.txt": "Åsa", "dir/b.xml": "<b/>" }, { store }));
    expect(await zip.text("a.txt")).toBe("Åsa");
    expect(await zip.text("dir/b.xml")).toBe("<b/>");
    expect(await zip.text("nej.txt")).toBeNull();
    expect(zip.has("a.txt")).toBe(true);
    expect(zip.names()).toEqual(["a.txt", "dir/b.xml"]);
  });

  it("refuses an encrypted entry", async () => {
    const zip = openZip(buildZip({ "a.txt": "Åsa" }, { encrypted: ["a.txt"] }));
    expect(await errorReason(() => zip.bytes("a.txt"))).toBe("encrypted");
  });

  it("refuses an entry over 50 MB", async () => {
    const zip = openZip(buildZip({ "bomb.xml": new Uint8Array(60 * 1024 * 1024) }));
    expect(await errorReason(() => zip.bytes("bomb.xml"))).toBe("failed");
  });

  it("refuses an entry that compresses more than 200 to 1", async () => {
    const zip = openZip(buildZip({ "bomb.xml": new Uint8Array(10 * 1024 * 1024) }));
    expect(await errorReason(() => zip.bytes("bomb.xml"))).toBe("failed");
  });

  it("refuses an entry that inflates past its declared size", async () => {
    const zip = openZip(buildZip({ "a.txt": "Åsa Berg bor i Umeå" }, { declaredSize: { "a.txt": 12 } }));
    expect(await errorReason(() => zip.bytes("a.txt"))).toBe("failed");
  });

  it("refuses more than 100 MB in total", async () => {
    const big = 40 * 1024 * 1024;
    const bytes = buildZip({ a: "x", b: "x", c: "x" }, { store: true, declaredSize: { a: big, b: big, c: big } });
    expect(await errorReason(() => openZip(bytes))).toBe("failed");
  });

  it("refuses more than 2 000 entries", async () => {
    const files = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`f${i}.txt`, "x"]));
    expect(await errorReason(() => openZip(buildZip(files, { store: true })))).toBe("failed");
  });

  it("refuses bytes that are not a zip", async () => {
    expect(await errorReason(() => openZip(new Uint8Array(100)))).toBe("failed");
    expect(await errorReason(() => openZip(new Uint8Array(3)))).toBe("failed");
  });
});

describe("zipFormat", () => {
  it.each([
    [{ "word/document.xml": "<w/>" }, "docx"],
    [{ "ppt/presentation.xml": "<p/>" }, "pptx"],
    [{ "xl/workbook.xml": "<x/>" }, "xlsx"],
    [{ mimetype: "application/vnd.oasis.opendocument.text", "content.xml": "<c/>" }, "odt"],
    [{ mimetype: "application/vnd.oasis.opendocument.spreadsheet", "content.xml": "<c/>" }, null],
    [{ "readme.txt": "hej" }, null],
  ])("tells %j is %s", async (files, format) => {
    expect(await zipFormat(openZip(buildZip(files)))).toBe(format);
  });
});
```

Create `src/reader/xml.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeEntities, xmlEvents } from "./xml.ts";

describe("xmlEvents", () => {
  it("yields opens, closes and decoded text, and skips declarations and comments", () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE x><a x="1 &amp; 2"><b/>t&lt;x&#229;&#xE4;<!-- Lisa --><![CDATA[<rå>]]></a>';
    expect([...xmlEvents(xml)]).toEqual([
      { type: "open", name: "a", attrs: { x: "1 & 2" }, selfClosing: false },
      { type: "open", name: "b", attrs: {}, selfClosing: true },
      { type: "close", name: "b" },
      { type: "text", text: "t<xåä" },
      { type: "text", text: "<rå>" },
      { type: "close", name: "a" },
    ]);
  });

  it("reads single-quoted attributes and a > inside quotes", () => {
    expect([...xmlEvents("<w:t a='x>y' b = \"z\">")]).toEqual([{ type: "open", name: "w:t", attrs: { a: "x>y", b: "z" }, selfClosing: false }]);
  });

  it("survives a truncated document", () => {
    expect([...xmlEvents("<a>text<b")].map((e) => e.type)).toEqual(["open", "text", "open"]);
  });
});

describe("decodeEntities", () => {
  it("leaves an unknown or broken entity as it is", () => {
    expect(decodeEntities("&nbsp; &#99999999; &amp")).toBe("&nbsp; &#99999999; &amp");
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `npx vitest run src/reader/zip.test.ts src/reader/xml.test.ts`
Expected: FAIL, `Failed to resolve import "./zip.ts"` and `"./xml.ts"`.

- [ ] **Step 5: Write zip.ts and xml.ts**

Create `src/reader/zip.ts`:

```ts
// A small zip reader for Word, Excel, PowerPoint and OpenDocument files,
// inflating with the browser's own DecompressionStream. Only entries a
// reader asks for are inflated, and every cap in limits.ts is checked
// against what the bytes really do, not only what the zip claims.
import { decodeText } from "./decode.ts";
import { LIMITS } from "./limits.ts";
import { ReadError } from "./types.ts";

interface Entry {
  flags: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

export interface Zip {
  has(name: string): boolean;
  names(): string[];
  bytes(name: string): Promise<Uint8Array | null>;
  text(name: string): Promise<string | null>;
}

const fail = () => new ReadError("failed");

export function openZip(data: Uint8Array): Zip {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (o: number) => {
    if (o < 0 || o + 2 > data.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o < 0 || o + 4 > data.length) throw fail();
    return dv.getUint32(o, true);
  };

  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw fail();
  const count = u16(eocd + 10);
  const cdOffset = u32(eocd + 16);
  // Zip64 is never needed for office files under the 50 MB file cap.
  if (count === 0xffff || cdOffset === 0xffffffff || count > LIMITS.zipEntries) throw fail();

  const entries = new Map<string, Entry>();
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (u32(p) !== 0x02014b50) throw fail();
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    if (p + 46 + nameLen > data.length) throw fail();
    const name = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nameLen));
    const entry: Entry = { flags: u16(p + 8), method: u16(p + 10), compressedSize: u32(p + 20), size: u32(p + 24), offset: u32(p + 42) };
    total += entry.size;
    if (total > LIMITS.zipTotalBytes) throw fail();
    entries.set(name, entry);
    p += 46 + nameLen + extraLen + commentLen;
  }

  async function bytes(name: string): Promise<Uint8Array | null> {
    const e = entries.get(name);
    if (!e) return null;
    if (e.flags & 1) throw new ReadError("encrypted");
    if (e.size > LIMITS.zipEntryBytes) throw fail();
    if (e.compressedSize > 0 && e.size / e.compressedSize > LIMITS.zipRatio) throw fail();
    if (u32(e.offset) !== 0x04034b50) throw fail();
    const start = e.offset + 30 + u16(e.offset + 26) + u16(e.offset + 28);
    if (start + e.compressedSize > data.length) throw fail();
    const raw = data.subarray(start, start + e.compressedSize);
    if (e.method === 0) {
      if (raw.length !== e.size) throw fail();
      return raw.slice();
    }
    if (e.method === 8) return inflateRaw(raw, e.size);
    throw fail();
  }

  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    bytes,
    text: async (name) => {
      const b = await bytes(name);
      return b === null ? null : decodeText(b);
    },
  };
}

/** Inflates into exactly `size` bytes; more output than that is a lie and fails. */
async function inflateRaw(input: Uint8Array, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let n = 0;
  const reader = new Blob([input.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (n + value.length > size) throw fail();
      out.set(value, n);
      n += value.length;
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e instanceof ReadError ? e : fail();
  }
  if (n !== size) throw fail();
  return out;
}

/** Which office format a zip holds, by its main part. */
export async function zipFormat(zip: Zip): Promise<"docx" | "odt" | "pptx" | "xlsx" | null> {
  if (zip.has("mimetype")) return (await zip.text("mimetype"))?.trim() === "application/vnd.oasis.opendocument.text" ? "odt" : null;
  if (zip.has("word/document.xml")) return "docx";
  if (zip.has("ppt/presentation.xml")) return "pptx";
  if (zip.has("xl/workbook.xml")) return "xlsx";
  return null;
}
```

Create `src/reader/xml.ts`:

```ts
// A minimal XML tokenizer for office files. Workers have no DOMParser, and
// the readers only need elements, attributes and text in document order.
// It never throws: a broken document yields what it can.

export type XmlEvent =
  | { type: "open"; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: "close"; name: string }
  | { type: "text"; text: string };

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (whole, body: string) => {
    if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? whole;
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function tagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let j = from; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return j;
  }
  return xml.length;
}

const ATTR = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function* xmlEvents(xml: string): Generator<XmlEvent> {
  const n = xml.length;
  let i = 0;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      yield { type: "text", text: decodeEntities(xml.slice(i)) };
      return;
    }
    if (lt > i) yield { type: "text", text: decodeEntities(xml.slice(i, lt)) };
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      yield { type: "text", text: xml.slice(lt + 9, end === -1 ? n : end) };
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<?", lt) || xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const gt = tagEnd(xml, lt + 1);
    const raw = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith("/")) {
      yield { type: "close", name: raw.slice(1).trim() };
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const name = /^[^\s/>]+/.exec(body)?.[0] ?? "";
    const attrs: Record<string, string> = {};
    for (const m of body.slice(name.length).matchAll(ATTR)) attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? "");
    yield { type: "open", name, attrs, selfClosing };
    if (selfClosing) yield { type: "close", name };
  }
}
```

- [ ] **Step 6: Run the zip and XML tests**

Run: `npx vitest run src/reader/zip.test.ts src/reader/xml.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 7: Write the failing docx tests**

Create `src/reader/formats/docx.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocx, buildZip, errorReason, SAMPLE, SAMPLE_TEXT, wp } from "../../../tests/fixtures/documents/build.ts";
import { openZip } from "../zip.ts";
import { readDocx } from "./docx.ts";

const read = (bytes: Uint8Array) => readDocx(openZip(bytes));

describe("readDocx", () => {
  it("reads paragraphs in order and flags nothing in a plain document", async () => {
    const body = [SAMPLE.title, ...SAMPLE.lines].map(wp).join("");
    expect(await read(buildDocx({ body }))).toEqual({ text: SAMPLE_TEXT, hidden: false });
  });

  it("reads a table one row per line, cells by tab", async () => {
    const cell = (...ps: string[]) => `<w:tc>${ps.map(wp).join("")}</w:tc>`;
    const body = `<w:tbl><w:tr>${cell("Namn")}${cell("Anna Berg")}</w:tr><w:tr>${cell("Ort")}${cell("Umeå", "Västerbotten")}</w:tr></w:tbl>`;
    expect((await read(buildDocx({ body }))).text).toBe("Namn\tAnna Berg\nOrt\tUmeå Västerbotten");
  });

  it("keeps tabs and line breaks inside a run", async () => {
    const body = "<w:p><w:r><w:t>Anna</w:t><w:tab/><w:t>Berg</w:t><w:br/><w:t>Umeå</w:t></w:r></w:p>";
    expect((await read(buildDocx({ body }))).text).toBe("Anna\tBerg\nUmeå");
  });

  it("adds headers, footers and footnotes after the body, each text once", async () => {
    const docx = buildDocx({
      body: wp("Avtal"),
      headers: [wp("Norrström Media AB, konfidentiellt"), wp("Norrström Media AB, konfidentiellt")],
      footers: [wp("Sida 1")],
      footnotes: `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="1">${wp("Enligt Erik Holm på HR.")}</w:footnote>`,
    });
    expect((await read(docx)).text).toBe("Avtal\n\nNorrström Media AB, konfidentiellt\n\nSida 1\n\nEnligt Erik Holm på HR.");
  });

  it("leaves out deleted, hidden and commented text and says so", async () => {
    const body =
      '<w:p><w:r><w:t xml:space="preserve">Kontakt </w:t></w:r><w:del w:id="1" w:author="x"><w:r><w:delText>Raderad Person</w:delText></w:r></w:del>' +
      '<w:ins w:id="2" w:author="x"><w:r><w:t>Anna Berg</w:t></w:r></w:ins></w:p>' +
      "<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Dold Uppgift</w:t></w:r></w:p>";
    const comments = `<w:comment w:id="0" w:author="Erik">${wp("Fråga Lisa Ek")}</w:comment>`;
    expect(await read(buildDocx({ body, comments }))).toEqual({ text: "Kontakt Anna Berg", hidden: true });
  });

  it("keeps text whose vanish is switched off", async () => {
    const body = '<w:p><w:r><w:rPr><w:vanish w:val="0"/></w:rPr><w:t>Anna Berg</w:t></w:r></w:p>';
    expect(await read(buildDocx({ body }))).toEqual({ text: "Anna Berg", hidden: false });
  });

  it("keeps a field's result, not its instruction", async () => {
    const body =
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.se" </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>example.se</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    expect((await read(buildDocx({ body }))).text).toBe("example.se");
  });

  it("reads a text box once, not its fallback copy", async () => {
    const box = `<w:txbxContent>${wp("Lisa Ek")}</w:txbxContent>`;
    const body = `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx>${box}</wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox>${box}</v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`;
    const { text } = await read(buildDocx({ body }));
    expect(text.match(/Lisa Ek/g)).toHaveLength(1);
  });

  it("reads Word's own file, header and footer included", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testWORD.docx")));
    expect(text).toContain("This is a sample Microsoft Word Document.");
    expect(text).toContain("This is the header for our document");
    expect(text).toContain("This is the footer for our document");
    expect(text).toContain("Nested table");
  });

  it("fails without a document part", async () => {
    expect(await errorReason(() => read(buildZip({ "word/other.xml": "<x/>" })))).toBe("failed");
  });
});
```

Add to `src/reader/extract.test.ts`, inside the `describe` (and add `buildDocx, buildZip, SAMPLE, wp` to its fixture import):

```ts
  it("reads a Word file, even one named .pdf", async () => {
    const docx = buildDocx({ body: [SAMPLE.title, ...SAMPLE.lines].map(wp).join("") });
    expect(await extract(docx, "avtal.docx")).toMatchObject({ kind: "text", format: "docx", notes: [] });
    expect(await extract(docx, "avtal.pdf")).toMatchObject({ kind: "text", format: "docx" });
  });

  it("refuses a zip that is no office file", async () => {
    expect(await extract(buildZip({ "bild.png": "x" }), "arkiv.zip")).toEqual({ kind: "error", reason: "unsupported" });
  });

  it("says a Word file with no text is empty", async () => {
    expect(await extract(buildDocx({ body: "<w:p/>" }), "tom.docx")).toEqual({ kind: "error", reason: "empty" });
  });
```

- [ ] **Step 8: Run them to make sure they fail**

Run: `npx vitest run src/reader/formats/docx.test.ts src/reader/extract.test.ts`
Expected: FAIL, `Failed to resolve import "./docx.ts"`; the new extract tests fail with `unsupported`.

- [ ] **Step 9: Write the text builder, relationships and the docx reader**

Create `src/reader/textBuilder.ts`:

```ts
// Collects a document's text: paragraphs as lines, table cells separated by
// tabs, one table row per line. A cell's own paragraphs are joined by spaces
// so a row stays on one line.
export class TextBuilder {
  private parts: string[] = [""];

  add(s: string): void {
    this.parts[this.parts.length - 1] += s;
  }

  openCell(): void {
    this.parts.push("");
  }

  closeCell(): void {
    if (this.parts.length === 1) {
      this.add("\t");
      return;
    }
    const cell = this.parts.pop() ?? "";
    this.add(`${cell.trim().replace(/\s*\n\s*/g, " ")}\t`);
  }

  closeRow(): void {
    const last = this.parts.length - 1;
    this.parts[last] = `${this.parts[last].replace(/\t$/, "")}\n`;
  }

  toString(): string {
    return this.parts
      .join("")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
```

Create `src/reader/ooxml.ts`:

```ts
// Relationships in Word, Excel and PowerPoint files: which part a header,
// slide or sheet is, by id.
import { xmlEvents } from "./xml.ts";

/** The relationships in a .rels part. `type` is the last segment of the type URL; `target` is a zip path. */
export function relationships(xml: string, base: string): Array<{ id: string; type: string; target: string }> {
  const out: Array<{ id: string; type: string; target: string }> = [];
  for (const ev of xmlEvents(xml)) {
    if (ev.type !== "open" || ev.name !== "Relationship" || ev.attrs.TargetMode === "External") continue;
    const { Id: id, Type: type, Target: target } = ev.attrs;
    if (!id || !type || !target) continue;
    out.push({ id, type: type.slice(type.lastIndexOf("/") + 1), target: resolve(base, target) });
  }
  return out;
}

function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
```

Create `src/reader/formats/docx.ts`:

```ts
// Word (.docx): body, tables, text boxes, headers, footers, footnotes and
// endnotes. Deleted text, hidden text and comments are left out, and we say
// so; field instructions and the fallback copy of drawings are left out
// silently since nobody sees them.
import { relationships } from "../ooxml.ts";
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const SKIP_SILENT = new Set(["w:instrText", "w:delInstrText", "mc:Fallback"]);
const SKIP_HIDDEN = new Set(["w:del", "w:moveFrom"]);
const OFF = new Set(["0", "false", "off"]);

/** The text of one WordprocessingML part, and whether it had hidden content. */
export function wordPartText(xml: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skip = 0;
  let skipIsHidden = false;
  let hidden = false;
  let inRun = false;
  let runHidden = false;
  let inText = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      else if (skipIsHidden && ev.text.trim()) hidden = true;
      continue;
    }
    if (ev.type === "text") {
      if (!inText) continue;
      if (!runHidden) out.add(ev.text);
      else if (ev.text.trim()) hidden = true;
      continue;
    }
    const { name } = ev;
    if (ev.type === "open") {
      const separatorNote = (name === "w:footnote" || name === "w:endnote") && !!ev.attrs["w:type"] && ev.attrs["w:type"] !== "normal";
      if (SKIP_SILENT.has(name) || SKIP_HIDDEN.has(name) || separatorNote) {
        skip = 1;
        skipIsHidden = SKIP_HIDDEN.has(name);
        continue;
      }
      if (name === "w:r") {
        inRun = true;
        runHidden = false;
      } else if (name === "w:vanish") {
        if (inRun && !OFF.has(ev.attrs["w:val"] ?? "")) runHidden = true;
      } else if (name === "w:t") inText = true;
      else if (inRun && !runHidden && name === "w:tab") out.add("\t");
      else if (inRun && !runHidden && (name === "w:br" || name === "w:cr")) out.add("\n");
      else if (inRun && !runHidden && name === "w:noBreakHyphen") out.add("-");
      else if (name === "w:tc") out.openCell();
      continue;
    }
    if (name === "w:t") inText = false;
    else if (name === "w:r") {
      inRun = false;
      runHidden = false;
    } else if (name === "w:p") out.add("\n");
    else if (name === "w:tc") out.closeCell();
    else if (name === "w:tr") out.closeRow();
  }
  return { text: out.toString(), hidden };
}

export async function readDocx(zip: Zip): Promise<Extracted> {
  const body = await zip.text("word/document.xml");
  if (body === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("word/_rels/document.xml.rels")) ?? "", "word/");
  const parts = [wordPartText(body)];
  for (const kind of ["header", "footer"]) {
    for (const rel of rels.filter((r) => r.type === kind)) {
      const xml = await zip.text(rel.target);
      if (xml !== null) parts.push(wordPartText(xml));
    }
  }
  for (const notes of ["word/footnotes.xml", "word/endnotes.xml"]) {
    const xml = await zip.text(notes);
    if (xml !== null) parts.push(wordPartText(xml));
  }
  const comments = await zip.text("word/comments.xml");
  const commented = comments !== null && wordPartText(comments).text !== "";
  const texts = [...new Set(parts.map((p) => p.text).filter(Boolean))];
  return { text: texts.join("\n\n"), hidden: commented || parts.some((p) => p.hidden) };
}
```

In `src/reader/extract.ts`, add the imports

```ts
import { readDocx } from "./formats/docx.ts";
import { openZip, zipFormat } from "./zip.ts";
```

and add this case to the `switch` in `dispatch`, before `case "text":`:

```ts
    case "zip": {
      const zip = openZip(bytes);
      const format = await zipFormat(zip);
      if (format === "docx") return { format, extracted: await readDocx(zip) };
      throw new ReadError("unsupported");
    }
```

- [ ] **Step 10: Run the unit tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 11: Add a docx test in the browser**

Append to `tests/e2e/file-import.spec.ts` (add `buildDocx, SAMPLE, wp` to the fixture import):

```ts
test("a Word file is read into Din text and its name gets masked", async ({ page }) => {
  await openReady(page);
  const docx = buildDocx({ body: [SAMPLE.title, ...SAMPLE.lines].map(wp).join("") });
  await dropFile(page, editor(page), "avtal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx);
  const w = fileWindow(page);
  await expect(w).toContainText("Word · 23 ord");
  await w.getByRole("button", { name: "Använd texten" }).click();
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});
```

Run: `npx playwright test tests/e2e/file-import.spec.ts -g "Word file"`
Expected: PASS in all three browsers (this proves `DecompressionStream("deflate-raw")` in each engine).

- [ ] **Step 12: Commit**

```bash
git add src/reader tests/fixtures/documents tests/e2e/file-import.spec.ts
git commit -m "Read Word files: a small zip reader with zip bomb caps, an XML tokenizer and the docx reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: PDF

pdf.js in the reader worker, text rebuilt into lines, the existing PDF tidy-up, form values in, comments out. Proves no request leaves our origin and that it works offline.

**Files:**
- Create: `src/reader/formats/pdf.ts`, `src/reader/formats/pdfLines.ts`, possibly `src/reader/formats/pdfjs-worker.d.ts`
- Modify: `package.json`, `package-lock.json` (pdfjs-dist), `src/reader/extract.ts` (pdf case), `tests/fixtures/documents/build.ts` (`buildPdf`, `PDF_WRAPPED`), `tests/e2e/file-import.spec.ts`, `tests/e2e/no-egress.spec.ts`, `tests/e2e/offline.spec.ts`
- Test: `src/reader/formats/pdfLines.test.ts`

**Interfaces:**
- Consumes: `cleanPaste(raw: string): { text: string; joined: boolean }` from `src/ui/pasteCleanup.ts` (existing); `Extracted`, `Progress`, `ReadError`.
- Produces: `readPdf(bytes: Uint8Array, onProgress?: Progress): Promise<Extracted>`; `interface PdfItem { str: string; x: number; y: number; width: number; height: number }`; `pageText(items: PdfItem[]): string`; test helpers `buildPdf(pages, opts?)`, `PDF_WRAPPED`.

- [ ] **Step 1: Install pdf.js**

Run: `npm install --save-exact pdfjs-dist@6.4.299`
Expected: installs. If the repo's `allowScripts` guard reports a package with install scripts that is not listed, add it to `allowScripts` in `package.json` as `false` (pdf.js needs no install scripts in the browser) and run the install again. Check: `grep '"pdfjs-dist": "6.4.299"' package.json`.

- [ ] **Step 2: Write the failing tests for line rebuilding**

Create `src/reader/formats/pdfLines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { type PdfItem, pageText } from "./pdfLines.ts";

const item = (str: string, x: number, y: number, width = str.length * 6, height = 12): PdfItem => ({ str, x, y, width, height });

describe("pageText", () => {
  it("orders lines top to bottom and items left to right", () => {
    expect(pageText([item("Umeå", 72, 700), item("Berg", 100, 720), item("Anna", 72, 720)])).toBe("Anna Berg\nUmeå");
  });

  it("puts a space only where the gap is wider than a quarter of the font size", () => {
    expect(pageText([item("Ber", 72, 720), item("g", 90.5, 720)])).toBe("Berg");
    expect(pageText([item("Anna", 72, 720), item("Berg", 100, 720)])).toBe("Anna Berg");
  });

  it("keeps items a little off the baseline on the same line", () => {
    expect(pageText([item("Anna", 72, 720), item("Berg", 100, 718)])).toBe("Anna Berg");
  });

  it("does not double a space the items already have", () => {
    expect(pageText([item("Anna ", 72, 720), item("Berg", 110, 720)])).toBe("Anna Berg");
  });

  it("skips empty items", () => {
    expect(pageText([item("", 72, 740, 0), item("Anna", 72, 720)])).toBe("Anna");
  });
});
```

Run: `npx vitest run src/reader/formats/pdfLines.test.ts`
Expected: FAIL, `Failed to resolve import "./pdfLines.ts"`.

- [ ] **Step 3: Write pdfLines.ts**

Create `src/reader/formats/pdfLines.ts`:

```ts
// pdf.js gives a page's text as positioned pieces. This puts them back into
// lines: top to bottom, left to right, with a space where the gap between two
// pieces is wider than a quarter of the font size.

export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pageText(items: PdfItem[]): string {
  const lines: PdfItem[][] = [];
  const sorted = items.filter((i) => i.str !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - item.y) <= Math.max(line[0].height, item.height, 1) / 2) line.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let prev: PdfItem | null = null;
      for (const item of line) {
        if (prev) {
          const gap = item.x - (prev.x + prev.width);
          if (gap > Math.max(prev.height, 1) / 4 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += " ";
        }
        out += item.str;
        prev = item;
      }
      return out.trim();
    })
    .filter(Boolean)
    .join("\n");
}
```

Run: `npx vitest run src/reader/formats/pdfLines.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Write the PDF reader and wire it in**

Create `src/reader/formats/pdf.ts`:

```ts
// PDF with pdf.js, loaded only for the first PDF. It gets the bytes and
// nothing else: no eval, no font loading, no fetching (no cMapUrl, no
// standardFontDataUrl; text extraction for Latin scripts needs neither).
// Form field values are text on the page and come along; comments do not.
import { cleanPaste } from "../../ui/pasteCleanup.ts";
import { type Extracted, type Progress, ReadError } from "../types.ts";
import { type PdfItem, pageText } from "./pdfLines.ts";

type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | null = null;

/** pdf.js with its worker code running here, in the reader worker, instead of a worker of its own. */
function loadPdfJs(): Promise<PdfJs> {
  loading ??= (async () => {
    const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs")]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return pdfjs;
  })();
  return loading;
}

export async function readPdf(bytes: Uint8Array, onProgress?: Progress): Promise<Extracted> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    verbosity: 0,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new ReadError((e as Error | undefined)?.name === "PasswordException" ? "encrypted" : "failed");
  }
  try {
    const pages: string[] = [];
    let hidden = false;
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.(n, doc.numPages);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: PdfItem[] = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;
        const [, , c, d, x, y] = it.transform as number[];
        items.push({ str: it.str, x, y, width: it.width, height: it.height || Math.hypot(c, d) });
      }
      const lines = [pageText(items)];
      for (const a of await page.getAnnotations({ intent: "display" })) {
        if (a.subtype === "Widget") {
          if (a.fieldType === "Tx" && typeof a.fieldValue === "string" && a.fieldValue.trim()) lines.push(a.fieldValue.trim());
        } else if (a.subtype !== "Link" && String(a.contentsObj?.str ?? "").trim()) hidden = true;
      }
      pages.push(lines.filter(Boolean).join("\n"));
      page.cleanup();
    }
    if (!pages.some((p) => p.trim())) throw new ReadError("noText");
    return { text: cleanPaste(pages.join("\n\n")).text, pages: doc.numPages, hidden };
  } finally {
    await doc.destroy();
  }
}
```

In `src/reader/extract.ts`, add `import { readPdf } from "./formats/pdf.ts";`, rename the `_onProgress` parameter of `dispatch` to `onProgress`, and add before `case "text":`:

```ts
    case "pdf":
      return { format: "pdf", extracted: await readPdf(bytes, onProgress) };
```

Run: `npm run typecheck`
Expected: passes. If TypeScript reports `Could not find a declaration file for module 'pdfjs-dist/build/pdf.worker.mjs'`, create `src/reader/formats/pdfjs-worker.d.ts`:

```ts
declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
```

If TypeScript reports a type error on a `getDocument` option or an annotation field because 6.x renamed it, read `node_modules/pdfjs-dist/types/src/display/api.d.ts` for the 6.x name and use it. Do not drop an option from the Global Constraints list without putting its 6.x equivalent in its place.

- [ ] **Step 5: Add the PDF builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
/** A PDF string literal in WinAnsi (latin-1 range), with octal escapes for anything outside ASCII. */
function pdfString(s: string): string {
  let out = "(";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c > 0xff) throw new Error(`not in WinAnsi: ${ch}`);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (c < 0x20 || c > 0x7e) out += `\\${c.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `${out})`;
}

const streamObj = (dict: string, data: string) => `<< ${dict} /Length ${data.length} >>\nstream\n${data}\nendstream`;

/**
 * A PDF with Helvetica text, one line per string, or an image-only page
 * (`{ image: true }`, like a scan). `comment` adds a sticky note and `field`
 * a filled-in text field on the first page. `encrypted` adds a standard
 * security handler whose empty password does not open it.
 */
export function buildPdf(
  pages: Array<string[] | { image: true }>,
  opts: { encrypted?: boolean; comment?: string; field?: string } = {},
): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body);
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  const fields: number[] = [];
  for (const page of pages) {
    let resources = `/Font << /F1 ${font} 0 R >>`;
    let content: string;
    if ("image" in page) {
      const img = add(streamObj("/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8", "\x80".repeat(64)));
      resources += ` /XObject << /Im1 ${img} 0 R >>`;
      content = "q 200 0 0 200 72 500 cm /Im1 Do Q";
    } else {
      content = `BT /F1 12 Tf 14 TL 72 760 Td ${page.map((line) => `${pdfString(line)} Tj T*`).join(" ")} ET`;
    }
    const contents = add(streamObj("", content));
    const pageId = add("");
    const annots: number[] = [];
    if (kids.length === 0 && opts.comment) annots.push(add(`<< /Type /Annot /Subtype /Text /Rect [400 700 420 720] /Contents ${pdfString(opts.comment)} >>`));
    if (kids.length === 0 && opts.field) {
      const f = add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (namn) /V ${pdfString(opts.field)} /Rect [72 600 300 620] /P ${pageId} 0 R >>`);
      annots.push(f);
      fields.push(f);
    }
    const annotList = annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(" ")}]` : "";
    objs[pageId - 1] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << ${resources} >> /Contents ${contents} 0 R${annotList} >>`;
    kids.push(pageId);
  }
  const form = fields.length ? ` /AcroForm << /Fields [${fields.map((f) => `${f} 0 R`).join(" ")}] >>` : "";
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R${form} >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const encrypt = opts.encrypted ? add(`<< /Filter /Standard /V 1 /R 2 /Length 40 /P -3904 /O <${"ab".repeat(32)}> /U <${"cd".repeat(32)}> >>`) : 0;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  const encryptRef = encrypt ? ` /Encrypt ${encrypt} 0 R /ID [<${"01".repeat(16)}> <${"01".repeat(16)}>]` : "";
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${encryptRef} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}

/** Two pages of long lines wrapped mid-sentence, with a word split by a hyphen across lines. */
export const PDF_WRAPPED = [
  [
    "Anna Berg har arbetat på Norrström Media AB sedan 2019 och har under",
    "våren varit sjukskriven på heltid. Hon deltar nu i ett program för rehabili-",
    "tering som Försäkringskassan har godkänt efter ett möte i mars i år.",
  ],
  [
    "Erik Holm på HR ansvarar för uppföljningen och ringer Anna varje vecka",
    "under hösten för att stämma av hur arbetet med återgången går framåt.",
  ],
];
```

- [ ] **Step 6: Write the PDF tests in the browser**

These also answer whether pdf.js runs inside our worker in all three engines, which the rest of the task depends on. Append to `tests/e2e/file-import.spec.ts` (add `buildPdf, PDF_WRAPPED` to the fixture import and `import { readFileSync } from "node:fs";` at the top):

```ts
test.describe("PDF", () => {
  const PDF = "application/pdf";

  test("a PDF is read page by page into Din text, lines rejoined", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "rehab.pdf", PDF, buildPdf(PDF_WRAPPED));
    const w = fileWindow(page);
    await expect(w).toContainText("PDF · 2 sidor");
    await w.getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toContainText("har under våren");
    await expect(editor(page)).toContainText("rehabilitering");
    await expect(editor(page)).toContainText("Erik Holm");
  });

  test("a PDF from another program is read", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "testPDF.pdf", PDF, new Uint8Array(readFileSync("tests/fixtures/documents/tika/testPDF.pdf")));
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toContainText("Tika");
  });

  test("a scanned PDF says it has no text", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "skannad.pdf", PDF, buildPdf([{ image: true }]));
    await expect(fileWindow(page).getByRole("alert")).toHaveText(/^PDF:en innehåller bara bilder, ingen text\./);
  });

  test("a password-protected PDF says so", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "last.pdf", PDF, buildPdf([[SAMPLE.title]], { encrypted: true }));
    await expect(fileWindow(page).getByRole("alert")).toHaveText(/^Dokumentet är lösenordsskyddat\./);
  });

  test("a form's filled-in values come along, its comments do not", async ({ page }) => {
    await openReady(page);
    await dropFile(page, editor(page), "blankett.pdf", PDF, buildPdf([["Namn"]], { field: "Anna Berg", comment: "Ring Lisa Ek" }));
    const w = fileWindow(page);
    await expect(w.getByLabel("Början av texten")).toContainText("Anna Berg");
    await expect(w.getByLabel("Början av texten")).not.toContainText("Lisa Ek");
    await expect(w).toContainText("Kommentarer och dolda delar togs inte med.");
  });
});
```

- [ ] **Step 7: Run the PDF tests in all three browsers**

Run: `npx playwright test tests/e2e/file-import.spec.ts -g "PDF"`
Expected: PASS in Chromium, Firefox and WebKit.

If any engine fails every PDF with "Dokumentet gick inte att läsa", pdf.js could not start inside the worker. Look for a `ReferenceError` or "Setting up fake worker failed" (add `page.on("console", (m) => console.log(m.text()))` to the test, or open DevTools on `npm run preview`). Then switch `loadPdfJs` to a nested worker of pdf.js's own:

```ts
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: "module" });
    return pdfjs;
  });
  return loading;
}
```

and run the tests again. `worker-src 'self'` already allows it. Record in `docs/ARCHITECTURE.md` (Task 15) which variant shipped and why.

If the form test fails only on the field value (6.x may name it differently), log one annotation from the fixture with `console.log(JSON.stringify(a))` inside `readPdf`, use the property that holds "Anna Berg", and remove the log.

- [ ] **Step 8: Prove no request leaves our origin, and offline**

Append to `tests/e2e/no-egress.spec.ts` (add `dropFile, fileWindow` to the helpers import and `import { buildDocx, buildPdf, SAMPLE, wp } from "../fixtures/documents/build.ts";`):

```ts
test("reading a PDF and a Word file makes no request outside our origin", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });

  await openReady(page);
  const files = [
    ["avtal.pdf", "application/pdf", buildPdf([[SAMPLE.title, ...SAMPLE.lines]])],
    ["avtal.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buildDocx({ body: SAMPLE.lines.map(wp).join("") })],
  ] as const;
  for (const [name, type, bytes] of files) {
    await dropFile(page, editor(page), name, type, bytes);
    await fileWindow(page).getByRole("button", { name: "Använd texten" }).click();
    await expect(editor(page)).toContainText("Anna Berg");
  }

  const outside = requests.filter((url) => !url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin);
  expect(outside).toEqual([]);
  expect(cspViolations).toEqual([]);
});
```

Append to `tests/e2e/offline.spec.ts` (add `dropFile, fileWindow` to the helpers import and `import { buildPdf, SAMPLE } from "../fixtures/documents/build.ts";`):

```ts
test("after one visit a PDF can be read offline", async ({ page, context }) => {
  await openReady(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".model-status")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await dropFile(page, editor(page), "avtal.pdf", "application/pdf", buildPdf([[SAMPLE.title, ...SAMPLE.lines]]));
  await expect(fileWindow(page)).toContainText("PDF · 1 sida");
});
```

Run: `npx playwright test tests/e2e/no-egress.spec.ts tests/e2e/offline.spec.ts`
Expected: PASS in all three browsers.

- [ ] **Step 9: Check the build**

Run: `npm run build`
Expected: succeeds, and `postbuild` (the 25 MiB per-file check) passes. Note the size of the pdf.js chunks in the Vite output, for the commit message body.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/reader tests/fixtures/documents/build.ts tests/e2e
git commit -m "Read PDF files with pdf.js inside the reader worker, form values in and comments out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: OpenDocument text (.odt)

LibreOffice and Google Docs exports. Same zip and XML pieces as Word.

**Files:**
- Create: `src/reader/formats/odt.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildOdt`, `tp`), `src/reader/extract.ts` (odt in the zip case)
- Test: `src/reader/formats/odt.test.ts`

**Interfaces:**
- Consumes: `Zip`, `xmlEvents`, `TextBuilder`, `Extracted`, `ReadError` (Tasks 1, 3).
- Produces: `readOdt(zip: Zip): Promise<Extracted>`; test helpers `buildOdt(body, opts?)`, `tp(text)`.

- [ ] **Step 1: Add the ODT builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
const ODF_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"';

/** An ODF paragraph. */
export const tp = (text: string) => `<text:p>${esc(text)}</text:p>`;

/** An .odt with the given office:text XML and an optional page header and footer. */
export function buildOdt(body: string, opts: { header?: string; footer?: string } = {}): Uint8Array {
  const header = opts.header ? `<style:header>${opts.header}</style:header>` : "";
  const footer = opts.footer ? `<style:footer>${opts.footer}</style:footer>` : "";
  return buildZip({
    mimetype: "application/vnd.oasis.opendocument.text",
    "content.xml": `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ODF_NS}><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
    "styles.xml": `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${ODF_NS}><office:master-styles><style:master-page style:name="Standard">${header}${footer}</style:master-page></office:master-styles></office:document-styles>`,
    "META-INF/manifest.xml": "<manifest/>",
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/odt.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOdt, SAMPLE, SAMPLE_TEXT, tp } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readOdt } from "./odt.ts";

const read = (bytes: Uint8Array) => readOdt(openZip(bytes));

describe("readOdt", () => {
  it("reads headings and paragraphs, ignoring the XML's own line breaks", async () => {
    const body = `\n  <text:h text:outline-level="1">${SAMPLE.title}</text:h>\n  ${SAMPLE.lines.map(tp).join("\n  ")}\n`;
    expect(await read(buildOdt(body))).toEqual({ text: SAMPLE_TEXT, hidden: false });
  });

  it("keeps spaces, tabs and line breaks written as elements", async () => {
    const body = '<text:p>Anna<text:s text:c="3"/>Berg<text:tab/>Umeå<text:line-break/>Sverige</text:p>';
    expect((await read(buildOdt(body))).text).toBe("Anna   Berg\tUmeå\nSverige");
  });

  it("reads a table one row per line, cells by tab", async () => {
    const cell = (s: string) => `<table:table-cell>${tp(s)}</table:table-cell>`;
    const body = `<table:table><table:table-row>${cell("Namn")}${cell("Anna Berg")}</table:table-row><table:table-row>${cell("Ort")}${cell("Umeå")}</table:table-row></table:table>`;
    expect((await read(buildOdt(body))).text).toBe("Namn\tAnna Berg\nOrt\tUmeå");
  });

  it("puts footnotes after the body and the page header and footer before them", async () => {
    const body = `<text:p>Avtalet<text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body>${tp("Enligt Erik Holm.")}</text:note-body></text:note> gäller.</text:p>`;
    const odt = buildOdt(body, { header: tp("Konfidentiellt"), footer: tp("Sida 1") });
    expect((await read(odt)).text).toBe("Avtalet gäller.\n\nKonfidentiellt\nSida 1\n\nEnligt Erik Holm.");
  });

  it("leaves out comments and tracked deletions and says so", async () => {
    const body =
      '<text:tracked-changes><text:changed-region text:id="c1"><text:deletion><office:change-info><dc:creator>Erik</dc:creator></office:change-info>' +
      `${tp("Raderad Person")}</text:deletion></text:changed-region></text:tracked-changes>` +
      `<text:p>Kontakt Anna<office:annotation><dc:creator>Erik</dc:creator>${tp("Fråga Lisa Ek")}</office:annotation></text:p>`;
    expect(await read(buildOdt(body))).toEqual({ text: "Kontakt Anna", hidden: true });
  });

  it("reads NeoOffice's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testOpenOffice2.odt")));
    expect(text).toContain("This is a sample Open Office document");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildOdt(tp("Anna Berg")), "avtal.odt")).toMatchObject({ kind: "text", format: "odt", text: "Anna Berg" });
  });
});
```

Run: `npx vitest run src/reader/formats/odt.test.ts`
Expected: FAIL, `Failed to resolve import "./odt.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/formats/odt.ts`:

```ts
// OpenDocument text (.odt): body, headings, tables, frames, footnotes and
// the page header and footer. Comments, tracked deletions and hidden text are
// left out, and we say so. As ODF says, whitespace in the XML collapses to
// one space and only <text:s>, <text:tab> and <text:line-break> add more.
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const SKIP_HIDDEN = new Set(["office:annotation", "text:tracked-changes", "text:hidden-text", "text:hidden-paragraph"]);
const SKIP_SILENT = new Set(["text:note-citation", "office:annotation-end", "svg:title", "svg:desc"]);
const PARAGRAPH = new Set(["text:p", "text:h"]);
const CELL = new Set(["table:table-cell", "table:covered-table-cell"]);
const BODY = new Set(["office:body"]);
const HEADER_FOOTER = new Set(["style:header", "style:footer", "style:header-left", "style:footer-left", "style:header-first", "style:footer-first"]);

/** The text inside the `roots` elements of an ODF part; footnotes are collected separately. */
function odfText(xml: string, roots: Set<string>): { text: string; notes: string[]; hidden: boolean } {
  const out = new TextBuilder();
  const notes: string[] = [];
  let note: TextBuilder | null = null;
  const target = () => note ?? out;
  let inside = 0;
  let inParagraph = 0;
  let skip = 0;
  let skipIsHidden = false;
  let hidden = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      else if (skipIsHidden && ev.text.trim()) hidden = true;
      continue;
    }
    if (ev.type !== "text" && roots.has(ev.name)) {
      if (ev.type === "open") inside++;
      else {
        inside--;
        out.add("\n");
      }
      continue;
    }
    if (!inside) continue;
    if (ev.type === "text") {
      if (inParagraph) target().add(ev.text.replace(/\s+/g, " "));
      continue;
    }
    const { name } = ev;
    if (ev.type === "open") {
      if (SKIP_HIDDEN.has(name) || SKIP_SILENT.has(name)) {
        skip = 1;
        skipIsHidden = SKIP_HIDDEN.has(name);
      } else if (PARAGRAPH.has(name)) inParagraph++;
      else if (name === "text:s") target().add(" ".repeat(Math.min(Number(ev.attrs["text:c"] ?? 1) || 1, 100)));
      else if (name === "text:tab") target().add("\t");
      else if (name === "text:line-break") target().add("\n");
      else if (CELL.has(name)) target().openCell();
      else if (name === "text:note") note = new TextBuilder();
      continue;
    }
    if (PARAGRAPH.has(name)) {
      inParagraph = Math.max(0, inParagraph - 1);
      target().add("\n");
    } else if (CELL.has(name)) target().closeCell();
    else if (name === "table:table-row") target().closeRow();
    else if (name === "text:note" && note) {
      const text = note.toString();
      if (text) notes.push(text);
      note = null;
    }
  }
  return { text: out.toString(), notes, hidden };
}

export async function readOdt(zip: Zip): Promise<Extracted> {
  const content = await zip.text("content.xml");
  if (content === null) throw new ReadError("failed");
  const body = odfText(content, BODY);
  const styles = await zip.text("styles.xml");
  const page = styles === null ? null : odfText(styles, HEADER_FOOTER);
  const texts = [...new Set([body.text, page?.text ?? "", ...body.notes].filter(Boolean))];
  return { text: texts.join("\n\n"), hidden: body.hidden || !!page?.hidden };
}
```

In `src/reader/extract.ts`, add `import { readOdt } from "./formats/odt.ts";` and, in the zip case under the docx line:

```ts
      if (format === "odt") return { format, extracted: await readOdt(zip) };
```

Run: `npx vitest run src/reader`
Expected: PASS. (Whitespace between elements, such as the XML's own indentation, is outside any paragraph and is ignored; the space in " gäller." is inside one and stays.)

- [ ] **Step 4: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Read OpenDocument text files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: RTF

WordPad, old Word versions and some mail clients. A character-level parser: groups, control words, hex bytes in the document's code page, Unicode escapes.

**Files:**
- Create: `src/reader/formats/rtf.ts`
- Modify: `src/reader/decode.ts` (add `binaryString`), `src/reader/extract.ts` (rtf case)
- Test: `src/reader/formats/rtf.test.ts`, `src/reader/decode.test.ts`

**Interfaces:**
- Consumes: `decodeText`, `labelForCodepage`, `Extracted`.
- Produces: `readRtf(bytes: Uint8Array): Extracted`; `binaryString(bytes: Uint8Array): string` (one character per byte, for parsers that work on bytes; also used by eml in Task 8).

- [ ] **Step 1: Write the failing tests**

Add to `src/reader/decode.test.ts` (and `binaryString` to its import):

```ts
describe("binaryString", () => {
  it("maps each byte to one character", () => {
    expect(binaryString(new Uint8Array([0x41, 0xe5, 0x00, 0xff]))).toBe("Aå\u0000ÿ");
  });

  it("handles more bytes than one call can spread", () => {
    expect(binaryString(new Uint8Array(200_000).fill(0x61))).toHaveLength(200_000);
  });
});
```

Create `src/reader/formats/rtf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { readRtf } from "./rtf.ts";

const read = (rtf: string) => readRtf(latin1(rtf));

describe("readRtf", () => {
  it("reads paragraphs, hex bytes in the code page, and skips metadata and tables of fonts and colours", () => {
    const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}{\info{\author Erik Holm}{\title Avtal}}\pard Anst\'e4llningsavtal\par Mellan Norrstr\'f6m Media AB och Anna Berg.\par}`;
    expect(read(rtf)).toEqual({ text: "Anställningsavtal\nMellan Norrström Media AB och Anna Berg.", hidden: false });
  });

  it("reads Unicode escapes and skips their fallback characters", () => {
    expect(read(String.raw`{\rtf1\ansi Pris 荤? 100, \uc0\u229 r}`).text).toBe("Pris € 100, år");
  });

  it("keeps a field's result, not its instruction", () => {
    expect(read(String.raw`{\rtf1{\field{\*\fldinst HYPERLINK "https://example.se"}{\fldrslt example.se}}}`).text).toBe("example.se");
  });

  it("leaves out hidden text and annotations and says so", () => {
    expect(read(String.raw`{\rtf1 Kontakt Anna{\v Dold Uppgift}.{\*\annotation Fr\'e5ga Lisa Ek}\par}`)).toEqual({ text: "Kontakt Anna.", hidden: true });
  });

  it("reads a table row with cells by tab", () => {
    expect(read(String.raw`{\rtf1\trowd\cellx1000\cellx2000 Namn\cell Anna Berg\cell\row}`).text).toBe("Namn\tAnna Berg");
  });

  it("reads escaped braces and backslashes, and skips unknown starred groups", () => {
    expect(read(String.raw`{\rtf1 a\{b\}c\\d{\*\unknownthing Lisa}}`).text).toBe("a{b}c\\d");
  });

  it("skips binary data", () => {
    expect(read(String.raw`{\rtf1 Anna{\pict\bin4 }}}} Berg}`).text).toBe("Anna Berg");
  });

  it("is reached through extract, even named .doc", async () => {
    expect(await extract(latin1(String.raw`{\rtf1 Anna Berg}`), "brev.doc")).toMatchObject({ kind: "text", format: "rtf", text: "Anna Berg" });
  });
});
```

Run: `npx vitest run src/reader/decode.test.ts src/reader/formats/rtf.test.ts`
Expected: FAIL (`binaryString` is not exported; `./rtf.ts` does not resolve).

- [ ] **Step 2: Write binaryString and the RTF reader**

Append to `src/reader/decode.ts`:

```ts
/** One character per byte (U+0000 to U+00FF), for parsers that work on bytes. */
export function binaryString(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}
```

Create `src/reader/formats/rtf.ts`:

```ts
// RTF: body text, tables, fields' results, Unicode escapes and hex bytes in
// the document's code page. Font, colour and style tables, metadata, pictures
// and field instructions are skipped. Annotations, hidden text (\v) and
// deleted text are left out, and we say so.
import { binaryString, decodeText, labelForCodepage } from "../decode.ts";
import type { Extracted } from "../types.ts";

/** Destinations skipped without a word: nobody reads them as text. */
const SKIP = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "objdata", "themedata", "colorschememapping", "datastore",
  "latentstyles", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "mmathPr", "fldinst",
  "pgdsctbl", "revtbl", "filetbl", "shprslt", "sp", "nonshppict", "bkmkstart", "bkmkend", "fontemb", "fontfile",
  "userprops", "docvar", "xe", "tc", "template", "listtext", "pntext",
]);
/** Destinations the writer hid from the page; text in them sets the note. */
const HIDDEN = new Set(["annotation", "atnid", "atnauthor", "atndate", "atnicn", "atnref", "atrfstart", "atrfend", "atnparent"]);
/** Starred destinations that hold visible text (text boxes). Every other starred one is skipped. */
const KEEP_STARRED = new Set(["shpinst", "shptxt"]);
const SYMBOLS: Record<string, string> = {
  par: "\n", line: "\n", sect: "\n", page: "\n", tab: "\t", cell: "\t",
  emdash: "—", endash: "–", bullet: "•", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”",
  emspace: " ", enspace: " ", qmspace: " ",
};
const CONTROL_WORD = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/;

interface Group {
  skip: "no" | "silent" | "hidden";
  hiddenText: boolean;
  uc: number;
}

export function readRtf(bytes: Uint8Array): Extracted {
  const src = binaryString(bytes);
  let out = "";
  let hidden = false;
  let label = "windows-1252";
  let group: Group = { skip: "no", hiddenText: false, uc: 1 };
  const stack: Group[] = [];
  let pending: number[] = [];
  let skipChars = 0;
  let atGroupStart = false;
  let starred = false;

  const emit = (s: string) => {
    if (group.skip !== "no" || group.hiddenText) {
      if (group.skip !== "silent" && s.trim()) hidden = true;
      return;
    }
    out += s;
  };
  const flush = () => {
    if (!pending.length) return;
    emit(decodeText(Uint8Array.from(pending), label));
    pending = [];
  };
  const literal = (s: string) => {
    atGroupStart = false;
    flush();
    if (skipChars > 0) {
      skipChars--;
      return;
    }
    emit(s);
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "{") {
      flush();
      stack.push(group);
      group = { ...group };
      atGroupStart = true;
      starred = false;
      skipChars = 0;
      i++;
      continue;
    }
    if (c === "}") {
      flush();
      group = stack.pop() ?? group;
      atGroupStart = false;
      skipChars = 0;
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (c !== "\\") {
      literal(c);
      i++;
      continue;
    }
    const next = src[i + 1];
    if (next === "'") {
      const byte = Number.parseInt(src.slice(i + 2, i + 4), 16);
      i += 4;
      atGroupStart = false;
      if (skipChars > 0) skipChars--;
      else if (!Number.isNaN(byte)) pending.push(byte);
      continue;
    }
    flush();
    if (next === "*") {
      starred = true;
      i += 2;
      continue;
    }
    const m = next !== undefined && /[a-zA-Z]/.test(next) ? CONTROL_WORD.exec(src.slice(i + 1, i + 50)) : null;
    if (!m) {
      i += 2;
      if (next === "\\" || next === "{" || next === "}") literal(next);
      else if (next === "~") literal(" ");
      else if (next === "_") literal("-");
      else if (next === "\n" || next === "\r") literal("\n");
      continue;
    }
    i += 1 + m[0].length;
    const word = m[1];
    const param = m[2] === undefined ? null : Number(m[2]);
    if (atGroupStart) {
      atGroupStart = false;
      if (HIDDEN.has(word)) {
        if (group.skip === "no") group.skip = "hidden";
        continue;
      }
      if (SKIP.has(word) || (starred && !KEEP_STARRED.has(word))) {
        if (group.skip === "no") group.skip = "silent";
        continue;
      }
    }
    if (word === "bin") {
      i += Math.max(0, param ?? 0);
      continue;
    }
    if (word === "ansicpg" && param !== null) label = labelForCodepage(param);
    else if (word === "uc" && param !== null) group.uc = param;
    else if (word === "u" && param !== null) {
      emit(String.fromCharCode(param < 0 ? param + 65536 : param));
      skipChars = group.uc;
    } else if (word === "v" || word === "deleted") group.hiddenText = param !== 0;
    else if (word === "plain") group.hiddenText = false;
    else if (word === "row") {
      if (group.skip === "no" && !group.hiddenText) out = `${out.replace(/\t$/, "")}\n`;
    } else if (SYMBOLS[word]) emit(SYMBOLS[word]);
  }
  flush();
  return { text: out.replace(/[ \t]+$/gm, "").trim(), hidden };
}
```

In `src/reader/extract.ts`, add `import { readRtf } from "./formats/rtf.ts";` and, before `case "text":`:

```ts
    case "rtf":
      return { format: "rtf", extracted: readRtf(bytes) };
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/reader
git commit -m "Read RTF files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: HTML

Saved web pages, and (in Task 8) the HTML body of emails. A tolerant tokenizer, since HTML is not XML.

**Files:**
- Create: `src/reader/formats/html.ts`
- Modify: `src/reader/extract.ts` (html in the text case)
- Test: `src/reader/formats/html.test.ts`

**Interfaces:**
- Consumes: `decodeText`, `binaryString`, `TextBuilder`, `Extracted`.
- Produces: `htmlToText(html: string): { text: string; hidden: boolean }`; `readHtml(bytes: Uint8Array): Extracted`; `htmlEntities(s: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/reader/formats/html.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { htmlToText, readHtml } from "./html.ts";

describe("htmlToText", () => {
  it("keeps visible text by block, drops head, scripts, styles, comments and hidden elements, and says so", () => {
    const html =
      '<html><head><title>Avtal</title><style>p{}</style><script>var a="Erik"; if (a<b) {}</script></head><body>' +
      "<h1>Anställningsavtal</h1><p>Mellan Norrström Media AB och <b>Anna Berg</b>,<br>personnummer 19850312-4471.</p>" +
      "<div hidden>Dold Uppgift</div><table><tr><td>Namn<td>Anna Berg</tr></table><!-- Lisa --></body></html>";
    expect(htmlToText(html)).toEqual({
      text: "Anställningsavtal\n\nMellan Norrström Media AB och Anna Berg,\npersonnummer 19850312-4471.\n\nNamn\tAnna Berg",
      hidden: true,
    });
  });

  it("collapses source whitespace and decodes entities", () => {
    expect(htmlToText("<p>\n  R&auml;ksm&ouml;rg&aring;s&nbsp;&amp;&#229;&#xE5;\n</p>").text).toBe("Räksmörgås &åå");
  });

  it("keeps whitespace inside pre", () => {
    expect(htmlToText("<pre>Anna\tBerg\nUmeå</pre>").text).toBe("Anna\tBerg\nUmeå");
  });

  it("closes unclosed cells and rows", () => {
    expect(htmlToText("<table><tr><td>Namn<td>Anna<tr><td>Ort<td>Umeå</table>").text).toBe("Namn\tAnna\nOrt\tUmeå");
  });

  it("does not take data-hidden or an input's type for hidden", () => {
    expect(htmlToText('<p data-hidden="1">Anna</p><input type="hidden" value="x"><p>Berg</p>')).toEqual({ text: "Anna\n\nBerg", hidden: false });
  });
});

describe("readHtml", () => {
  it("uses the charset in a meta tag", () => {
    expect(readHtml(latin1('<meta charset="iso-8859-1"><p>Räksmörgås</p>')).text).toBe("Räksmörgås");
  });

  it("reads UTF-8 without a meta tag", () => {
    expect(readHtml(new TextEncoder().encode("<p>Räksmörgås</p>")).text).toBe("Räksmörgås");
  });

  it("is reached through extract", async () => {
    expect(await extract(new TextEncoder().encode("<p>Anna Berg</p>"), "sida.html")).toMatchObject({ kind: "text", format: "html", text: "Anna Berg" });
  });
});
```

Run: `npx vitest run src/reader/formats/html.test.ts`
Expected: FAIL, `Failed to resolve import "./html.ts"`.

- [ ] **Step 2: Write the reader and wire it in**

Create `src/reader/formats/html.ts`:

```ts
// HTML (saved web pages and the HTML body of emails): the visible text, one
// block per paragraph, table cells by tab. The head, scripts, styles and
// similar are skipped; elements marked hidden are left out and we say so.
import { binaryString, decodeText } from "../decode.ts";
import { TextBuilder } from "../textBuilder.ts";
import type { Extracted } from "../types.ts";

const SKIP = new Set(["script", "style", "head", "template", "noscript", "svg", "object", "iframe", "select"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "caption", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "ul",
]);
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "",
  auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", aring: "å", Aring: "Å", eacute: "é", Eacute: "É", uuml: "ü", Uuml: "Ü", szlig: "ß",
  hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  bull: "•", middot: "·", euro: "€", copy: "©", reg: "®",
};
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const HIDDEN_ATTR = /(^|\s)hidden(\s|=|$)/i;

export function htmlEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== "#") return NAMED[body] ?? whole;
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

export function htmlToText(html: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skipName: string | null = null;
  let skipDepth = 0;
  let skipIsHidden = false;
  let hidden = false;
  let pre = 0;
  let inCell = false;
  let inRow = false;
  const endCell = () => {
    if (inCell) out.closeCell();
    inCell = false;
  };
  const endRow = () => {
    endCell();
    if (inRow) out.closeRow();
    inRow = false;
  };
  for (const m of html.matchAll(TOKEN)) {
    const [token, slash, rawName, attrs = ""] = m;
    if (token.startsWith("<!--")) continue;
    if (rawName === undefined) {
      const text = htmlEntities(token);
      if (skipName) {
        if (skipIsHidden && text.trim()) hidden = true;
      } else out.add(pre ? text : text.replace(/\s+/g, " "));
      continue;
    }
    const name = rawName.toLowerCase();
    const closing = slash === "/";
    const selfClosing = /\/\s*$/.test(attrs);
    if (skipName) {
      if (name === skipName && !selfClosing) {
        if (!closing) skipDepth++;
        else if (--skipDepth === 0) skipName = null;
      }
      continue;
    }
    if (!closing && !VOID.has(name) && !selfClosing && (SKIP.has(name) || HIDDEN_ATTR.test(attrs))) {
      skipName = name;
      skipDepth = 1;
      skipIsHidden = !SKIP.has(name);
      continue;
    }
    if (name === "br") out.add("\n");
    else if (name === "pre") pre = Math.max(0, pre + (closing ? -1 : 1));
    else if (name === "td" || name === "th") {
      endCell();
      if (!closing) {
        out.openCell();
        inCell = true;
      }
    } else if (name === "tr") {
      endRow();
      if (!closing) inRow = true;
    } else if (name === "table" && closing) endRow();
    if (BLOCK.has(name)) out.add("\n");
  }
  endRow();
  const text = out
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  return { text, hidden };
}

export function readHtml(bytes: Uint8Array): Extracted {
  const head = binaryString(bytes.subarray(0, 1024));
  const declared = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  return htmlToText(decodeText(bytes, declared));
}
```

In `src/reader/extract.ts`, add `import { readHtml } from "./formats/html.ts";` and replace the text case with:

```ts
    case "text":
      if (found.format === "html") return { format: "html", extracted: readHtml(bytes) };
      if (found.format === "eml") throw new ReadError("unsupported");
      return { format: found.format, extracted: readText(bytes) };
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/reader
git commit -m "Read saved web pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Saved emails (.eml)

MIME: headers with encoded words, multipart, quoted-printable and base64, a charset per part. Adds the header labels to the copy, since they end up in the user's text.

**Files:**
- Create: `src/reader/formats/mail.ts`, `src/reader/formats/eml.ts`
- Modify: `docs/COPY.md`, `src/ui/copy.ts` (seven `read.*` keys, two of them used in Tasks 9 and 10), `src/reader/extract.ts` (eml in the text case)
- Test: `src/reader/formats/eml.test.ts`

**Interfaces:**
- Consumes: `decodeText`, `binaryString`, `htmlToText`, `t` from `src/ui/copy.ts`.
- Produces: `interface MailHeaders { from?: string; to?: string; cc?: string; subject?: string; date?: string }`; `mailText(headers: MailHeaders, body: string): string`; `readEml(bytes: Uint8Array): Extracted`. Copy keys `read.from`, `read.to`, `read.cc`, `read.subject`, `read.date`, `read.sheet` (`{name}`), `read.slide` (`{n}`).

- [ ] **Step 1: Add the labels to the copy**

In `docs/COPY.md`, in the "Fasta strängar" table after the `file.format.md` row, add:

```
| read.from | Från |
| read.to | Till |
| read.cc | Kopia |
| read.subject | Ämne |
| read.date | Datum |
| read.sheet | Blad: {name} |
| read.slide | Bild {n} |
```

and under the table's notes add:

```
- `read.*` står i texten som läses in från ett dokument, inte i gränssnittet. Ett mejl börjar med raderna Från, Till, Kopia, Ämne och Datum. Varje blad i ett Excel-dokument börjar med "Blad: namn" och varje bild i en presentation med "Bild 1". Kolonet efter Från och Blad är en etikett, inte löptext.
```

In `src/ui/copy.ts`, after `"file.format.md"`, add:

```ts
  "read.from": "Från",
  "read.to": "Till",
  "read.cc": "Kopia",
  "read.subject": "Ämne",
  "read.date": "Datum",
  "read.sheet": "Blad: {name}",
  "read.slide": "Bild {n}",
```

Run: `npx vitest run src/ui/copy.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/eml.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latin1 } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { readEml } from "./eml.ts";
import { mailText } from "./mail.ts";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const read = (lines: string[]) => readEml(latin1(lines.join("\r\n")));

const MIXED = [
  "From: =?UTF-8?Q?Anna_Berg?= <anna.berg@norrstrom.se>",
  "To: Erik Holm <erik.holm@norrstrom.se>",
  "Cc: lisa.ek@norrstrom.se",
  `Subject: =?UTF-8?B?${b64("Sjukskrivning för")}?=`,
  " =?UTF-8?Q?_Anna?=",
  "Date: Tue, 13 Oct 2026 09:30:00 +0200",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="yttre"',
  "",
  "--yttre",
  'Content-Type: multipart/alternative; boundary="inre"',
  "",
  "--inre",
  "Content-Type: text/plain; charset=iso-8859-1",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hej Erik,",
  "",
  "Anna Berg =E4r sjukskriven till och med fredag. Ring 070-1740612 =",
  "om du har fr=E5gor.",
  "--inre",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>HTML-versionen</p>",
  "--inre--",
  "--yttre",
  'Content-Type: application/pdf; name="intyg.pdf"',
  'Content-Disposition: attachment; filename="intyg.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--yttre--",
  "",
];

describe("readEml", () => {
  it("reads the headers and the plain part, and says the attachment was left out", () => {
    expect(read(MIXED)).toEqual({
      text:
        "Från: Anna Berg <anna.berg@norrstrom.se>\nTill: Erik Holm <erik.holm@norrstrom.se>\nKopia: lisa.ek@norrstrom.se\n" +
        "Ämne: Sjukskrivning för Anna\nDatum: Tue, 13 Oct 2026 09:30:00 +0200\n\n" +
        "Hej Erik,\n\nAnna Berg är sjukskriven till och med fredag. Ring 070-1740612 om du har frågor.",
      attachments: true,
    });
  });

  it("reads an HTML-only mail as text", () => {
    const eml = ["From: anna.berg@norrstrom.se", "Subject: Hej", "Content-Type: text/html; charset=utf-8", "", "<p>Hej <b>Anna</b></p>"];
    expect(read(eml)).toEqual({ text: "Från: anna.berg@norrstrom.se\nÄmne: Hej\n\nHej Anna", attachments: false });
  });

  it("decodes a base64 body in its charset", () => {
    const eml = ["Subject: Hej", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64("Hälsningar Erik")];
    expect(read(eml).text).toBe("Ämne: Hej\n\nHälsningar Erik");
  });

  it("reads 8-bit headers and bodies without a declared charset", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("Subject: Möte\r\n\r\nHej Åsa")]);
    expect(readEml(bytes).text).toBe("Ämne: Möte\n\nHej Åsa");
  });

  it("is reached through extract", async () => {
    expect(await extract(latin1(MIXED.join("\r\n")), "mejl.eml")).toMatchObject({ kind: "text", format: "eml", notes: ["attachmentsLeftOut"] });
  });
});

describe("mailText", () => {
  it("leaves out headers that are missing", () => {
    expect(mailText({ subject: "Hej" }, "Text\r\n")).toBe("Ämne: Hej\n\nText");
  });
});
```

Run: `npx vitest run src/reader/formats/eml.test.ts`
Expected: FAIL, `Failed to resolve import "./eml.ts"`.

- [ ] **Step 3: Write mail.ts and the eml reader**

Create `src/reader/formats/mail.ts`:

```ts
// The text of an email, .eml or .msg: the headers people read, then the body.
import { t } from "../../ui/copy.ts";

export interface MailHeaders {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
}

const LABELS = [
  ["from", "read.from"],
  ["to", "read.to"],
  ["cc", "read.cc"],
  ["subject", "read.subject"],
  ["date", "read.date"],
] as const;

export function mailText(headers: MailHeaders, body: string): string {
  const head = LABELS.flatMap(([key, label]) => {
    const value = headers[key]?.trim();
    return value ? [`${t(label)}: ${value}`] : [];
  }).join("\n");
  return [head, body.replace(/\r\n?/g, "\n").trim()].filter(Boolean).join("\n\n");
}
```

Create `src/reader/formats/eml.ts`:

```ts
// Saved emails (.eml): From, To, Cc, Subject and Date, then the body. The
// plain-text part is preferred; an HTML-only mail goes through html.ts.
// Attachments are left out, and we say so. Works on the raw bytes as a
// binary string, and decodes each part in its own charset.
import { binaryString, decodeText } from "../decode.ts";
import type { Extracted } from "../types.ts";
import { htmlToText } from "./html.ts";
import { mailText } from "./mail.ts";

interface Part {
  headers: Map<string, string>;
  body: string;
}

const bytesOf = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function parsePart(raw: string): Part {
  // Headers end at the first blank line; a part may have no headers at all.
  const blank = /^\r?\n/.exec(raw) ?? /\r?\n\r?\n/.exec(raw);
  const head = blank ? raw.slice(0, blank.index) : raw;
  const body = blank ? raw.slice(blank.index + blank[0].length) : "";
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(key)) headers.set(key, line.slice(colon + 1).trim());
  }
  return { headers, body };
}

function param(value: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i").exec(value);
  return m ? (m[1] ?? m[2]) : undefined;
}

function base64(s: string): Uint8Array {
  let clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  if (clean.length % 4 === 1) clean = clean.slice(0, -1);
  clean += "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    return bytesOf(atob(clean));
  } catch {
    return new Uint8Array(0);
  }
}

const unQuote = (s: string) => s.replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)));

/** A header value: RFC 2047 encoded words decoded, raw 8-bit text decoded as UTF-8 or windows-1252. */
function decodeHeader(raw: string): string {
  const joined = raw.replace(/(=\?[^?]+\?[bq]\?[^?]*\?=)\s+(?==\?)/gi, "$1");
  const decoded = joined.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, charset: string, enc: string, text: string) =>
    decodeText(enc.toLowerCase() === "b" ? base64(text) : bytesOf(unQuote(text.replace(/_/g, " "))), charset),
  );
  return decoded === joined && /[\x80-\xff]/.test(decoded) ? decodeText(bytesOf(decoded)) : decoded;
}

function contentType(part: Part): string {
  return (part.headers.get("content-type") ?? "text/plain").split(";")[0].trim().toLowerCase();
}

function decodeBody(part: Part): string {
  const cte = (part.headers.get("content-transfer-encoding") ?? "").trim().toLowerCase();
  const bytes =
    cte === "base64" ? base64(part.body) : cte === "quoted-printable" ? bytesOf(unQuote(part.body.replace(/=\r?\n/g, ""))) : bytesOf(part.body);
  return decodeText(bytes, param(part.headers.get("content-type") ?? "", "charset"));
}

function splitMultipart(body: string, boundary: string): string[] {
  const parts: string[] = [];
  const delimiter = `--${boundary}`;
  let current: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith(delimiter)) {
      if (current) parts.push(current.join("\r\n"));
      if (line.startsWith(`${delimiter}--`)) return parts;
      current = [];
      continue;
    }
    current?.push(line);
  }
  if (current) parts.push(current.join("\r\n"));
  return parts;
}

interface Found {
  plain: string | null;
  html: string | null;
  attachments: boolean;
}

function walk(part: Part, found: Found): void {
  const type = contentType(part);
  const ct = part.headers.get("content-type") ?? "";
  const disposition = part.headers.get("content-disposition") ?? "";
  const isAttachment = /^\s*attachment/i.test(disposition) || !!param(disposition, "filename") || !!param(ct, "name");
  if (type.startsWith("multipart/")) {
    const boundary = param(ct, "boundary");
    if (!boundary) return;
    const children = splitMultipart(part.body, boundary).map(parsePart);
    if (type === "multipart/alternative") {
      const pick =
        children.find((c) => contentType(c) === "text/plain") ??
        children.find((c) => contentType(c) === "text/html") ??
        children.find((c) => contentType(c).startsWith("multipart/"));
      if (pick) walk(pick, found);
      return;
    }
    for (const child of children) walk(child, found);
    return;
  }
  if (!isAttachment && type === "text/plain") {
    const text = decodeBody(part);
    found.plain = found.plain === null ? text : `${found.plain}\n\n${text}`;
  } else if (!isAttachment && type === "text/html") {
    if (found.html === null) found.html = decodeBody(part);
  } else found.attachments = true;
}

export function readEml(bytes: Uint8Array): Extracted {
  const top = parsePart(binaryString(bytes));
  const found: Found = { plain: null, html: null, attachments: false };
  walk(top, found);
  const body = found.plain ?? (found.html !== null ? htmlToText(found.html).text : "");
  const header = (key: string) => {
    const value = top.headers.get(key);
    return value === undefined ? undefined : decodeHeader(value);
  };
  const headers = { from: header("from"), to: header("to"), cc: header("cc"), subject: header("subject"), date: header("date") };
  return { text: mailText(headers, body), attachments: found.attachments };
}
```

In `src/reader/extract.ts`, add `import { readEml } from "./formats/eml.ts";` and replace the line `if (found.format === "eml") throw new ReadError("unsupported");` with:

```ts
      if (found.format === "eml") return { format: "eml", extracted: readEml(bytes) };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader src/ui/copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reader src/ui/copy.ts docs/COPY.md
git commit -m "Read saved emails (.eml): headers, the plain or HTML body, attachments left out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Excel (.xlsx)

Each visible sheet under its name, one row per line, cells by tab. Shared strings, inline strings, cached formula values.

**Files:**
- Create: `src/reader/formats/xlsx.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildXlsx`), `src/reader/extract.ts` (xlsx in the zip case)
- Test: `src/reader/formats/xlsx.test.ts`

**Interfaces:**
- Consumes: `Zip`, `xmlEvents`, `relationships`, `t("read.sheet", { name })` (Task 8), `REL`, `RELS_NS`, `buildZip`, `esc` (Task 3 builders).
- Produces: `readXlsx(zip: Zip): Promise<Extracted>` (sets `sheets`); `sharedStrings(xml: string): string[]`; `sheetText(xml: string, strings: string[]): string`; test helper `buildXlsx(sheets, opts?)`.

- [ ] **Step 1: Add the builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
type XlsxCell = string | number | null | { f: string; v: number } | { inline: string };
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Column letters for a 0-based index: 0 → A, 26 → AA. */
function columnName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** An .xlsx. Strings go to the shared string table; `null` leaves a cell out; `comment` adds a cell comment. */
export function buildXlsx(sheets: Array<{ name: string; rows: XlsxCell[][]; state?: "hidden" | "veryHidden" }>, opts: { comment?: string } = {}): Uint8Array {
  const strings: string[] = [];
  const sst = (s: string) => {
    const at = strings.indexOf(s);
    return at >= 0 ? at : strings.push(s) - 1;
  };
  const cellXml = (c: XlsxCell, ref: string) => {
    if (c === null) return "";
    if (typeof c === "string") return `<c r="${ref}" t="s"><v>${sst(c)}</v></c>`;
    if (typeof c === "number") return `<c r="${ref}"><v>${c}</v></c>`;
    if ("f" in c) return `<c r="${ref}"><f>${esc(c.f)}</f><v>${c.v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(c.inline)}</t></is></c>`;
  };
  const files: Record<string, string> = {};
  const rels: string[] = [];
  const entries: string[] = [];
  sheets.forEach((sheet, si) => {
    const rows = sheet.rows.map((cells, ri) => `<row r="${ri + 1}">${cells.map((c, ci) => cellXml(c, `${columnName(ci)}${ri + 1}`)).join("")}</row>`).join("");
    files[`xl/worksheets/sheet${si + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${SHEET_NS}"><sheetData>${rows}</sheetData></worksheet>`;
    rels.push(`<Relationship Id="rId${si + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${si + 1}.xml"/>`);
    entries.push(`<sheet name="${esc(sheet.name)}" sheetId="${si + 1}"${sheet.state ? ` state="${sheet.state}"` : ""} r:id="rId${si + 1}"/>`);
  });
  if (opts.comment) {
    files["xl/comments1.xml"] = `<comments xmlns="${SHEET_NS}"><commentList><comment ref="A1"><text><t>${esc(opts.comment)}</t></text></comment></commentList></comments>`;
  }
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${SHEET_NS}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;
  return buildZip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${SHEET_NS}" xmlns:r="${REL}"><sheets>${entries.join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${rels.join("")}</Relationships>`,
    "xl/sharedStrings.xml": sharedStringsXml,
    ...files,
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/xlsx.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readXlsx, sharedStrings } from "./xlsx.ts";

const read = (bytes: Uint8Array) => readXlsx(openZip(bytes));

describe("readXlsx", () => {
  it("reads visible sheets under their names, values not formulas, and leaves hidden sheets out", async () => {
    const xlsx = buildXlsx([
      { name: "Personal", rows: [["Namn", "Personnummer"], ["Anna Berg", "19850312-4471"]] },
      { name: "Löner", rows: [["Anna Berg", 42000, { f: "B1*2", v: 84000 }]] },
      { name: "Hemligt", state: "hidden", rows: [["Hemlig Person"]] },
    ]);
    expect(await read(xlsx)).toEqual({
      text: "Blad: Personal\nNamn\tPersonnummer\nAnna Berg\t19850312-4471\n\nBlad: Löner\nAnna Berg\t42000\t84000",
      hidden: true,
      sheets: 2,
    });
  });

  it("keeps empty cells as empty columns, skips empty rows, and reads inline strings", async () => {
    const xlsx = buildXlsx([{ name: "Lista", rows: [["Anna", null, "Umeå"], [], [{ inline: "Lisa Ek" }]] }]);
    expect(await read(xlsx)).toEqual({ text: "Blad: Lista\nAnna\t\tUmeå\nLisa Ek", hidden: false, sheets: 1 });
  });

  it("says a cell comment was left out", async () => {
    expect((await read(buildXlsx([{ name: "Lista", rows: [["Anna"]] }], { comment: "Ring Lisa Ek" }))).hidden).toBe(true);
  });

  it("reads Excel's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testEXCEL.xlsx")));
    expect(text).toContain("Sample Excel Worksheet - Numbers and their Squares");
    expect(text).toMatch(/^Blad: /m);
  });

  it("is reached through extract and counts sheets", async () => {
    expect(await extract(buildXlsx([{ name: "Lista", rows: [["Anna Berg"]] }]), "lista.xlsx")).toMatchObject({
      kind: "text",
      format: "xlsx",
      stats: { sheets: 1 },
    });
  });
});

describe("sharedStrings", () => {
  it("joins rich text runs and skips phonetic readings", () => {
    const xml = '<sst><si><r><t>Anna </t></r><r><t>Berg</t></r></si><si><t>Ek</t><rPh sb="0" eb="1"><t>エク</t></rPh><phoneticPr fontId="1"/></si></sst>';
    expect(sharedStrings(xml)).toEqual(["Anna Berg", "Ek"]);
  });
});
```

Run: `npx vitest run src/reader/formats/xlsx.test.ts`
Expected: FAIL, `Failed to resolve import "./xlsx.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/formats/xlsx.ts`:

```ts
// Excel (.xlsx): every visible sheet under its name, one row per line, cells
// by tab, shared strings resolved and the stored value of formulas. Hidden
// sheets and cell comments are left out, and we say so. Dates come out as
// Excel's serial numbers (see PLAN.md, Open questions).
import { t } from "../../ui/copy.ts";
import { relationships } from "../ooxml.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

const MAX_COLUMNS = 16384;

export function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  let current: string | null = null;
  let skip = 0;
  let inText = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "si") current = "";
      else if (ev.name === "rPh" || ev.name === "phoneticPr") skip = 1;
      else if (ev.name === "t") inText = true;
    } else if (ev.type === "close") {
      if (ev.name === "si") {
        out.push(current ?? "");
        current = null;
      } else if (ev.name === "t") inText = false;
    } else if (inText && current !== null) current += ev.text;
  }
  return out;
}

/** 0-based column of a cell reference: "A1" → 0, "AB3" → 27. */
function columnOf(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

interface Cell {
  column: number;
  type: string;
  value: string;
  inline: string;
}

function cellText(cell: Cell, strings: string[]): string {
  if (cell.type === "s") return strings[Number(cell.value)] ?? "";
  if (cell.type === "inlineStr") return cell.inline;
  if (cell.type === "b") return cell.value === "1" ? "TRUE" : "FALSE";
  return cell.value;
}

export function sheetText(xml: string, strings: string[]): string {
  const rows: string[] = [];
  let row: string[] | null = null;
  let cell: Cell | null = null;
  let next = 0;
  let inValue = false;
  let inText = false;
  let skip = 0;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "text") {
      if (cell && inValue) cell.value += ev.text;
      else if (cell && inText) cell.inline += ev.text;
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "row") {
        row = [];
        next = 0;
      } else if (ev.name === "c") cell = { column: ev.attrs.r ? columnOf(ev.attrs.r) : next, type: ev.attrs.t ?? "n", value: "", inline: "" };
      else if (ev.name === "v") inValue = true;
      else if (ev.name === "t") inText = true;
      else if (ev.name === "f" || ev.name === "rPh") skip = 1;
      continue;
    }
    if (ev.name === "v") inValue = false;
    else if (ev.name === "t") inText = false;
    else if (ev.name === "c" && cell) {
      if (row && cell.column >= 0 && cell.column < MAX_COLUMNS) row[cell.column] = cellText(cell, strings);
      next = cell.column + 1;
      cell = null;
    } else if (ev.name === "row" && row) {
      const line = Array.from(row, (v) => v ?? "")
        .join("\t")
        .replace(/\t+$/, "");
      if (line.trim()) rows.push(line);
      row = null;
    }
  }
  return rows.join("\n");
}

export async function readXlsx(zip: Zip): Promise<Extracted> {
  const workbook = await zip.text("xl/workbook.xml");
  if (workbook === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("xl/_rels/workbook.xml.rels")) ?? "", "xl/");
  const strings = sharedStrings((await zip.text("xl/sharedStrings.xml")) ?? "");
  let hidden = zip.names().some((n) => /^xl\/(comments\d*|threadedComments\/[^/]+)\.xml$/.test(n));
  const parts: string[] = [];
  let sheets = 0;
  for (const ev of xmlEvents(workbook)) {
    if (ev.type !== "open" || ev.name !== "sheet") continue;
    const target = rels.find((r) => r.id === ev.attrs["r:id"])?.target;
    const xml = target ? await zip.text(target) : null;
    if (xml === null) continue;
    const text = sheetText(xml, strings);
    if (ev.attrs.state === "hidden" || ev.attrs.state === "veryHidden") {
      if (text) hidden = true;
      continue;
    }
    sheets++;
    if (text) parts.push(`${t("read.sheet", { name: ev.attrs.name ?? String(sheets) })}\n${text}`);
  }
  return { text: parts.join("\n\n"), hidden, sheets };
}
```

In `src/reader/extract.ts`, add `import { readXlsx } from "./formats/xlsx.ts";` and, in the zip case:

```ts
      if (format === "xlsx") return { format, extracted: await readXlsx(zip) };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Read Excel files, one row per line, hidden sheets and comments left out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: PowerPoint (.pptx)

Visible slides in deck order, each under "Bild n", text in shape order, tables by tab.

**Files:**
- Create: `src/reader/formats/pptx.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildPptx`), `src/reader/extract.ts` (pptx in the zip case)
- Test: `src/reader/formats/pptx.test.ts`

**Interfaces:**
- Consumes: `Zip`, `xmlEvents`, `relationships`, `TextBuilder`, `t("read.slide", { n })`.
- Produces: `readPptx(zip: Zip): Promise<Extracted>` (sets `slides`); test helper `buildPptx(slides)`.

- [ ] **Step 1: Add the builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
const P_NS = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${REL}"`;
const aPara = (text: string) => `<a:p><a:r><a:t>${esc(text)}</a:t></a:r></a:p>`;

/** A .pptx: one text box per string, an optional table, hidden slides and speaker notes. */
export function buildPptx(slides: Array<{ texts: string[]; table?: string[][]; hidden?: boolean; notes?: string }>): Uint8Array {
  const files: Record<string, string> = {};
  const rels: string[] = [];
  const ids: string[] = [];
  slides.forEach((slide, i) => {
    const n = i + 1;
    const shapes = slide.texts.map((text) => `<p:sp><p:txBody>${aPara(text)}</p:txBody></p:sp>`).join("");
    const table = slide.table
      ? `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${slide.table
          .map((row) => `<a:tr>${row.map((c) => `<a:tc><a:txBody>${aPara(c)}</a:txBody></a:tc>`).join("")}</a:tr>`)
          .join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
      : "";
    files[`ppt/slides/slide${n}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><p:sld ${P_NS}${slide.hidden ? ' show="0"' : ""}><p:cSld><p:spTree>${shapes}${table}</p:spTree></p:cSld></p:sld>`;
    if (slide.notes) {
      files[`ppt/notesSlides/notesSlide${n}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><p:notes ${P_NS}><p:cSld><p:spTree><p:sp><p:txBody>${aPara(slide.notes)}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
    }
    rels.push(`<Relationship Id="rId${n}" Type="${REL}/slide" Target="slides/slide${n}.xml"/>`);
    ids.push(`<p:sldId id="${255 + n}" r:id="rId${n}"/>`);
  });
  return buildZip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    "ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${P_NS}><p:sldIdLst>${ids.join("")}</p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${RELS_NS}">${rels.join("")}</Relationships>`,
    ...files,
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/pptx.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPptx } from "../../../tests/fixtures/documents/build.ts";
import { extract } from "../extract.ts";
import { openZip } from "../zip.ts";
import { readPptx } from "./pptx.ts";

const read = (bytes: Uint8Array) => readPptx(openZip(bytes));

describe("readPptx", () => {
  it("reads visible slides in order with their tables, and leaves out hidden slides and notes", async () => {
    const pptx = buildPptx([
      { texts: ["Anställningsavtal", "Anna Berg"], notes: "Ring Lisa Ek" },
      { texts: ["Lön"], table: [["Namn", "Lön"], ["Anna Berg", "42 000"]] },
      { texts: ["Hemlig Person"], hidden: true },
    ]);
    expect(await read(pptx)).toEqual({
      text: "Bild 1\nAnställningsavtal\nAnna Berg\n\nBild 2\nLön\nNamn\tLön\nAnna Berg\t42 000",
      hidden: true,
      slides: 2,
    });
  });

  it("flags nothing in a plain deck", async () => {
    expect((await read(buildPptx([{ texts: ["Anna Berg"] }]))).hidden).toBe(false);
  });

  it("reads PowerPoint's own file", async () => {
    const { text } = await read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testPPT.pptx")));
    expect(text).toContain("Attachment Test");
    expect(text).toContain("Rajiv");
  });

  it("is reached through extract and counts slides", async () => {
    expect(await extract(buildPptx([{ texts: ["Anna Berg"] }]), "deck.pptx")).toMatchObject({ kind: "text", format: "pptx", stats: { slides: 1 } });
  });
});
```

Run: `npx vitest run src/reader/formats/pptx.test.ts`
Expected: FAIL, `Failed to resolve import "./pptx.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/formats/pptx.ts`:

```ts
// PowerPoint (.pptx): visible slides in deck order, each under "Bild n" (its
// place in the deck), text in shape order and tables by tab. Hidden slides,
// speaker notes and comments are left out, and we say so.
import { t } from "../../ui/copy.ts";
import { relationships } from "../ooxml.ts";
import { TextBuilder } from "../textBuilder.ts";
import { type Extracted, ReadError } from "../types.ts";
import { xmlEvents } from "../xml.ts";
import type { Zip } from "../zip.ts";

function slideText(xml: string): { text: string; hidden: boolean } {
  const out = new TextBuilder();
  let skip = 0;
  let inText = false;
  let hidden = false;
  for (const ev of xmlEvents(xml)) {
    if (skip) {
      if (ev.type === "open") skip++;
      else if (ev.type === "close") skip--;
      continue;
    }
    if (ev.type === "text") {
      if (inText) out.add(ev.text);
      continue;
    }
    if (ev.type === "open") {
      if (ev.name === "p:sld") hidden = ev.attrs.show === "0";
      else if (ev.name === "mc:Fallback") skip = 1;
      else if (ev.name === "a:t") inText = true;
      else if (ev.name === "a:br") out.add("\n");
      else if (ev.name === "a:tc") out.openCell();
      continue;
    }
    if (ev.name === "a:t") inText = false;
    else if (ev.name === "a:p") out.add("\n");
    else if (ev.name === "a:tc") out.closeCell();
    else if (ev.name === "a:tr") out.closeRow();
  }
  return { text: out.toString(), hidden };
}

export async function readPptx(zip: Zip): Promise<Extracted> {
  const presentation = await zip.text("ppt/presentation.xml");
  if (presentation === null) throw new ReadError("failed");
  const rels = relationships((await zip.text("ppt/_rels/presentation.xml.rels")) ?? "", "ppt/");
  let hidden = zip.names().some((n) => /^ppt\/comments\//.test(n) || /^ppt\/comments\d*\.xml$/.test(n));
  const parts: string[] = [];
  let slides = 0;
  let position = 0;
  for (const ev of xmlEvents(presentation)) {
    if (ev.type !== "open" || ev.name !== "p:sldId") continue;
    position++;
    const target = rels.find((r) => r.id === ev.attrs["r:id"])?.target;
    const xml = target ? await zip.text(target) : null;
    if (xml === null) continue;
    const slide = slideText(xml);
    if (slide.hidden) {
      if (slide.text) hidden = true;
      continue;
    }
    slides++;
    if (slide.text) parts.push(`${t("read.slide", { n: position })}\n${slide.text}`);
  }
  for (const name of zip.names()) {
    if (hidden) break;
    if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)) continue;
    // A notes page always has the slide number; only words count as notes.
    if (/\p{L}/u.test(slideText((await zip.text(name)) ?? "").text)) hidden = true;
  }
  return { text: parts.join("\n\n"), hidden, slides };
}
```

In `src/reader/extract.ts`, add `import { readPptx } from "./formats/pptx.ts";` and, in the zip case:

```ts
      if (format === "pptx") return { format, extracted: await readPptx(zip) };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Read PowerPoint files slide by slide, hidden slides and notes left out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The compound file reader (OLE)

The container of `.doc` and `.msg`, and of password-protected Office files (whose `EncryptedPackage` stream this task detects). The doc and msg readers come in Tasks 12 and 13.

**Files:**
- Create: `src/reader/cfb.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildCfb`), `src/reader/extract.ts` (ole case)
- Test: `src/reader/cfb.test.ts`

**Interfaces:**
- Consumes: `ReadError`.
- Produces: `interface Cfb { has(path: string): boolean; paths(): string[]; stream(path: string): Uint8Array | null }` (paths are `"Storage/Stream"`); `openCfb(data: Uint8Array): Cfb`; `oleFormat(cfb: Cfb): "doc" | "msg"` (throws `encrypted` or `unsupported`); test helper `buildCfb(streams)`.

- [ ] **Step 1: Add the builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
/**
 * A compound file (version 3, 512-byte sectors) holding the given streams;
 * "Storage/Stream" puts a stream in a storage. Layout: the FAT sectors first,
 * then the directory, then each stream's sectors in order. The mini stream
 * cutoff is set to 0, so every stream is in regular sectors (real files and
 * the mini stream are covered by the Tika .msg and .doc).
 */
export function buildCfb(streams: Record<string, Uint8Array>): Uint8Array {
  const SECTOR = 512;
  const FREE = 0xffffffff;
  const END = 0xfffffffe;
  const FATSECT = 0xfffffffd;
  const NONE = 0xffffffff;
  type Node = { name: string; type: 1 | 2 | 5; data?: Uint8Array; children: Node[] };
  const root: Node = { name: "Root Entry", type: 5, children: [] };
  for (const [path, data] of Object.entries(streams)) {
    const parts = path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.children.find((c) => c.name === part && c.type === 1);
      if (!next) {
        next = { name: part, type: 1, children: [] };
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ name: parts[parts.length - 1], type: 2, data, children: [] });
  }
  const nodes: Node[] = [];
  const parentOf = new Map<Node, Node>();
  const walk = (n: Node) => {
    nodes.push(n);
    for (const c of n.children) {
      parentOf.set(c, n);
      walk(c);
    }
  };
  walk(root);
  const sectorsFor = (bytes: number) => Math.ceil(bytes / SECTOR);
  const dirSectors = sectorsFor(nodes.length * 128);
  const dataSectors = nodes.reduce((sum, n) => sum + (n.data ? sectorsFor(n.data.length) : 0), 0);
  let fatSectors = 1;
  while (fatSectors * (SECTOR / 4) < fatSectors + dirSectors + dataSectors) fatSectors++;
  const total = fatSectors + dirSectors + dataSectors;
  const out = new Uint8Array(SECTOR * (1 + total));
  const dv = new DataView(out.buffer);

  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  dv.setUint16(0x18, 0x3e, true);
  dv.setUint16(0x1a, 3, true);
  dv.setUint16(0x1c, 0xfffe, true);
  dv.setUint16(0x1e, 9, true);
  dv.setUint16(0x20, 6, true);
  dv.setUint32(0x2c, fatSectors, true);
  dv.setUint32(0x30, fatSectors, true);
  dv.setUint32(0x38, 0, true);
  dv.setUint32(0x3c, END, true);
  dv.setUint32(0x44, END, true);
  for (let i = 0; i < 109; i++) dv.setUint32(0x4c + i * 4, i < fatSectors ? i : FREE, true);

  const fat = new Uint32Array(fatSectors * (SECTOR / 4)).fill(FREE);
  for (let i = 0; i < fatSectors; i++) fat[i] = FATSECT;
  const chain = (start: number, count: number) => {
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? END : start + i + 1;
  };
  chain(fatSectors, dirSectors);
  const starts = new Map<Node, number>();
  let next = fatSectors + dirSectors;
  for (const n of nodes) {
    if (!n.data || n.data.length === 0) continue;
    const count = sectorsFor(n.data.length);
    starts.set(n, next);
    chain(next, count);
    out.set(n.data, SECTOR * (1 + next));
    next += count;
  }
  fat.forEach((v, i) => dv.setUint32(SECTOR + i * 4, v, true));

  for (let i = 0; i < dirSectors * (SECTOR / 128); i++) {
    const at = SECTOR * (1 + fatSectors) + i * 128;
    dv.setUint32(at + 68, NONE, true);
    dv.setUint32(at + 72, NONE, true);
    dv.setUint32(at + 76, NONE, true);
    const n = nodes[i];
    if (!n) continue;
    const name = n.name.slice(0, 31);
    for (let j = 0; j < name.length; j++) dv.setUint16(at + j * 2, name.charCodeAt(j), true);
    dv.setUint16(at + 64, (name.length + 1) * 2, true);
    out[at + 66] = n.type;
    out[at + 67] = 1;
    const parent = parentOf.get(n);
    const sibling = parent ? parent.children[parent.children.indexOf(n) + 1] : undefined;
    if (sibling) dv.setUint32(at + 72, nodes.indexOf(sibling), true);
    if (n.children.length) dv.setUint32(at + 76, nodes.indexOf(n.children[0]), true);
    dv.setUint32(at + 116, starts.get(n) ?? END, true);
    dv.setUint32(at + 120, n.data?.length ?? 0, true);
  }
  return out;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/cfb.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCfb, errorReason } from "../../tests/fixtures/documents/build.ts";
import { openCfb } from "./cfb.ts";
import { extract } from "./extract.ts";

describe("openCfb", () => {
  it("reads streams across sectors and inside storages", () => {
    const big = Uint8Array.from({ length: 1500 }, (_, i) => i % 251);
    const cfb = openCfb(buildCfb({ WordDocument: big, "Mapp/Inre": new Uint8Array([1, 2, 3]) }));
    expect(cfb.stream("WordDocument")).toEqual(big);
    expect(cfb.stream("Mapp/Inre")).toEqual(new Uint8Array([1, 2, 3]));
    expect(cfb.stream("Saknas")).toBeNull();
    expect(cfb.stream("Mapp")).toBeNull();
    expect(cfb.paths().sort()).toEqual(["Mapp", "Mapp/Inre", "WordDocument"]);
  });

  it("reads small streams from the mini stream of a real Outlook file", () => {
    const cfb = openCfb(new Uint8Array(readFileSync("tests/fixtures/documents/tika/test-outlook.msg")));
    const texts = cfb
      .paths()
      .filter((p) => p.startsWith("__substg1.0_") && p.endsWith("001E"))
      .map((p) => new TextDecoder("windows-1252").decode(cfb.stream(p) ?? new Uint8Array(0)));
    expect(texts.some((s) => s.includes("Nouvel utilisateur de Outlook Express"))).toBe(true);
  });

  it("refuses a sector chain that loops", async () => {
    const bytes = buildCfb({ S: new Uint8Array(1500) });
    // Sector 0 is the FAT, sector 1 the directory, and the stream starts at sector 2: point it at itself.
    new DataView(bytes.buffer).setUint32(512 + 2 * 4, 2, true);
    expect(await errorReason(() => openCfb(bytes).stream("S"))).toBe("failed");
  });

  it("refuses bytes that are not a compound file", async () => {
    expect(await errorReason(() => openCfb(new Uint8Array(1024)))).toBe("failed");
    expect(await errorReason(() => openCfb(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])))).toBe("failed");
  });
});

describe("extract with compound files", () => {
  it("says a password-protected Word file is protected", async () => {
    const bytes = buildCfb({ EncryptionInfo: new Uint8Array(8), EncryptedPackage: new Uint8Array(8) });
    expect(await extract(bytes, "avtal.docx")).toEqual({ kind: "error", reason: "encrypted" });
  });

  it("refuses other compound files, such as old Excel", async () => {
    expect(await extract(buildCfb({ Workbook: new Uint8Array(8) }), "lista.xls")).toEqual({ kind: "error", reason: "unsupported" });
  });
});
```

Run: `npx vitest run src/reader/cfb.test.ts`
Expected: FAIL, `Failed to resolve import "./cfb.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/cfb.ts`:

```ts
// Microsoft's compound file format (OLE): the container of Word 97–2003
// documents, Outlook messages and password-protected Office files. Every
// sector chain is checked for loops and out-of-range sectors, and no stream
// may claim more bytes than the file has.
import { ReadError } from "./types.ts";

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END = 0xfffffffe;
const NONE = 0xffffffff;
const MAX_REGULAR = 0xfffffffa;

interface DirEntry {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  start: number;
  size: number;
}

export interface Cfb {
  has(path: string): boolean;
  paths(): string[];
  stream(path: string): Uint8Array | null;
}

const fail = () => new ReadError("failed");

export function openCfb(data: Uint8Array): Cfb {
  if (data.length < 512 || !SIGNATURE.every((b, i) => data[i] === b)) throw fail();
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (o: number) => {
    if (o + 2 > data.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o + 4 > data.length) throw fail();
    return dv.getUint32(o, true);
  };
  const shift = u16(0x1e);
  if ((shift !== 9 && shift !== 12) || u16(0x20) !== 6) throw fail();
  const size = 1 << shift;
  const perSector = size / 4;
  const miniSize = 64;
  const cutoff = u32(0x38);
  const sectorAt = (s: number) => {
    const o = (s + 1) * size;
    if (s > MAX_REGULAR || o >= data.length) throw fail();
    return o;
  };
  const readTable = (sectors: number[]) => {
    const table = new Uint32Array(sectors.length * perSector);
    sectors.forEach((s, k) => {
      const o = sectorAt(s);
      for (let i = 0; i < perSector; i++) table[k * perSector + i] = u32(o + i * 4);
    });
    return table;
  };

  const numFat = u32(0x2c);
  if (numFat > data.length / size + 1) throw fail();
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) fatSectors.push(u32(0x4c + i * 4));
  let difat = u32(0x44);
  for (let hops = 0; fatSectors.length < numFat; hops++) {
    if (difat > MAX_REGULAR || hops > u32(0x48)) throw fail();
    const o = sectorAt(difat);
    for (let i = 0; i < perSector - 1 && fatSectors.length < numFat; i++) fatSectors.push(u32(o + i * 4));
    difat = u32(o + size - 4);
  }
  const fat = readTable(fatSectors);

  const chain = (start: number, table: Uint32Array): number[] => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let s = start; s !== END; s = table[s]) {
      if (s >= table.length || seen.has(s)) throw fail();
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  const readRegular = (start: number, length: number): Uint8Array => {
    const out = new Uint8Array(length);
    let n = 0;
    for (const s of chain(start, fat)) {
      if (n >= length) break;
      const o = sectorAt(s);
      const piece = data.subarray(o, o + Math.min(size, length - n));
      out.set(piece, n);
      n += piece.length;
    }
    if (n < length) throw fail();
    return out;
  };

  const entries: DirEntry[] = [];
  for (const s of chain(u32(0x30), fat)) {
    const o = sectorAt(s);
    for (let k = 0; k < size / 128; k++) {
      const at = o + k * 128;
      if (at + 128 > data.length) break;
      const nameLen = Math.min(u16(at + 64), 64);
      entries.push({
        name: new TextDecoder("utf-16le").decode(data.subarray(at, at + Math.max(0, nameLen - 2))),
        type: data[at + 66],
        left: u32(at + 68),
        right: u32(at + 72),
        child: u32(at + 76),
        start: u32(at + 116),
        size: u32(at + 120),
      });
    }
  }
  const root = entries[0];
  if (!root || root.type !== 5) throw fail();
  if (root.size > data.length) throw fail();
  const miniStream = root.size > 0 ? readRegular(root.start, root.size) : new Uint8Array(0);
  const firstMini = u32(0x3c);
  const miniFat = firstMini === END || firstMini === NONE ? new Uint32Array(0) : readTable(chain(firstMini, fat));
  const readMini = (start: number, length: number): Uint8Array => {
    const out = new Uint8Array(length);
    let n = 0;
    for (const s of chain(start, miniFat)) {
      if (n >= length) break;
      const o = s * miniSize;
      if (o >= miniStream.length) throw fail();
      const piece = miniStream.subarray(o, o + Math.min(miniSize, length - n));
      out.set(piece, n);
      n += piece.length;
    }
    if (n < length) throw fail();
    return out;
  };

  const paths = new Map<string, DirEntry>();
  const visited = new Set<number>();
  const stack: Array<[number, string]> = [[root.child, ""]];
  while (stack.length) {
    const [i, prefix] = stack.pop() as [number, string];
    if (i === NONE) continue;
    if (i >= entries.length || visited.has(i)) throw fail();
    visited.add(i);
    const e = entries[i];
    stack.push([e.left, prefix], [e.right, prefix]);
    if (e.type !== 1 && e.type !== 2) continue;
    const path = prefix + e.name;
    paths.set(path, e);
    if (e.type === 1) stack.push([e.child, `${path}/`]);
  }

  return {
    has: (path) => paths.has(path),
    paths: () => [...paths.keys()],
    stream: (path) => {
      const e = paths.get(path);
      if (!e || e.type !== 2) return null;
      if (e.size === 0) return new Uint8Array(0);
      if (e.size > data.length) throw fail();
      return e.size < cutoff ? readMini(e.start, e.size) : readRegular(e.start, e.size);
    },
  };
}

/** Which format a compound file holds. Password-protected Office files are compound files too. */
export function oleFormat(cfb: Cfb): "doc" | "msg" {
  if (cfb.has("EncryptedPackage")) throw new ReadError("encrypted");
  if (cfb.has("WordDocument")) return "doc";
  if (cfb.has("__properties_version1.0")) return "msg";
  throw new ReadError("unsupported");
}
```

In `src/reader/extract.ts`, add `import { oleFormat, openCfb } from "./cfb.ts";` and, before `case "pdf":`:

```ts
    case "ole": {
      const cfb = openCfb(bytes);
      oleFormat(cfb);
      throw new ReadError("unsupported");
    }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Compound file reader, and a plain message for password-protected Office files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Word 97–2003 (.doc)

Text from the piece table in the table stream, split into the document's stories by the character counts in the FIB.

**Files:**
- Create: `src/reader/formats/doc.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildDoc`), `src/reader/extract.ts` (ole case)
- Test: `src/reader/formats/doc.test.ts`

**Interfaces:**
- Consumes: `Cfb`, `openCfb`, `oleFormat` (Task 11).
- Produces: `readDoc(cfb: Cfb): Extracted`; `cleanWordText(s: string): string`; test helper `buildDoc(opts)`.

- [ ] **Step 1: Add the builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
/**
 * A minimal Word 97 file: a FIB with the story lengths, the text after it,
 * and a table stream whose piece table has one piece covering all text, as
 * UTF-16 or (with `compressed`) as 8-bit windows-1252.
 */
export function buildDoc(o: { main: string; footnotes?: string; comments?: string; encrypted?: boolean; nFib?: number; compressed?: boolean }): Uint8Array {
  const footnotes = o.footnotes ?? "";
  const comments = o.comments ?? "";
  const text = o.main + footnotes + comments;
  const textAt = 0x800;
  const word = new Uint8Array(textAt + text.length * 2);
  const dv = new DataView(word.buffer);
  dv.setUint16(0, 0xa5ec, true); // wIdent
  dv.setUint16(2, o.nFib ?? 0x00c1, true);
  dv.setUint16(0x0a, 0x0200 | (o.encrypted ? 0x0100 : 0), true); // fWhichTblStm (1Table), fEncrypted
  dv.setUint16(32, 14, true); // csw
  dv.setUint16(62, 22, true); // cslw
  dv.setUint32(76, o.main.length, true); // ccpText
  dv.setUint32(80, footnotes.length, true); // ccpFtn
  dv.setUint32(92, comments.length, true); // ccpAtn
  dv.setUint16(152, 0x5d, true); // cbRgFcLcb
  if (o.compressed) word.set(latin1(text), textAt);
  else for (let i = 0; i < text.length; i++) dv.setUint16(textAt + i * 2, text.charCodeAt(i), true);
  const table = new Uint8Array(21);
  const tv = new DataView(table.buffer);
  table[0] = 0x02; // Pcdt
  tv.setUint32(1, 16, true); // lcb of the PlcPcd: two CPs and one PCD
  tv.setUint32(5, 0, true);
  tv.setUint32(9, text.length, true);
  tv.setUint32(15, o.compressed ? (textAt * 2) | 0x40000000 : textAt, true);
  dv.setUint32(418, 0, true); // fcClx
  dv.setUint32(422, table.length, true); // lcbClx
  return buildCfb({ WordDocument: word, "1Table": table });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/doc.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDoc, errorReason } from "../../../tests/fixtures/documents/build.ts";
import { openCfb } from "../cfb.ts";
import { extract } from "../extract.ts";
import { readDoc } from "./doc.ts";

const read = (bytes: Uint8Array) => readDoc(openCfb(bytes));

describe("readDoc", () => {
  it("reads the main text and footnotes, keeps field results, and leaves comments out", () => {
    const doc = buildDoc({
      main: 'Anna Berg \x13 HYPERLINK "https://example.se" \x14example.se\x15 bor i Umeå.\r',
      footnotes: "Enligt Erik Holm.\r",
      comments: "Ring Lisa Ek\r",
    });
    expect(read(doc)).toEqual({ text: "Anna Berg example.se bor i Umeå.\n\nEnligt Erik Holm.", hidden: true });
  });

  it("reads 8-bit text pieces", () => {
    expect(read(buildDoc({ main: "Räksmörgås\r", compressed: true }))).toEqual({ text: "Räksmörgås", hidden: false });
  });

  it("turns cell marks into tabs", () => {
    expect(read(buildDoc({ main: "Namn\x07Anna Berg\x07\x07" })).text).toBe("Namn\tAnna Berg");
  });

  it("says a password-protected file is protected, and refuses Word 6 and 95", async () => {
    expect(await errorReason(() => read(buildDoc({ main: "x\r", encrypted: true })))).toBe("encrypted");
    expect(await errorReason(() => read(buildDoc({ main: "x\r", nFib: 0x0065 })))).toBe("unsupported");
  });

  it("reads Word's own file without field instructions", () => {
    const { text } = read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/testWORD.doc")));
    expect(text).toContain("This is a sample Microsoft Word Document.");
    expect(text).toContain("Nested table");
    expect(text).toContain("http://tika.apache.org/");
    expect(text).not.toContain("HYPERLINK");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildDoc({ main: "Anna Berg\r" }), "avtal.doc")).toMatchObject({ kind: "text", format: "doc", text: "Anna Berg" });
  });
});
```

Run: `npx vitest run src/reader/formats/doc.test.ts`
Expected: FAIL, `Failed to resolve import "./doc.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/formats/doc.ts`:

```ts
// Word 97–2003 (.doc): the main text, footnotes, headers, endnotes and text
// boxes, from the piece table. Comments are left out and we say so; field
// instructions are dropped and their results kept. Not handled (see PLAN.md,
// Open questions): deleted revisions, which need the formatting tables, and
// table rows, which come out on one line with cells by tab.
import type { Cfb } from "../cfb.ts";
import { type Extracted, ReadError } from "../types.ts";

const fail = () => new ReadError("failed");

/** Word's special characters: paragraph, cell and page marks, fields, hyphens. */
export function cleanWordText(s: string): string {
  let out = "";
  const fields: Array<"code" | "result"> = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 0x13) {
      fields.push("code");
      continue;
    }
    if (c === 0x14) {
      if (fields.length) fields[fields.length - 1] = "result";
      continue;
    }
    if (c === 0x15) {
      fields.pop();
      continue;
    }
    if (fields.includes("code")) continue;
    if (c === 0x0d || c === 0x0b || c === 0x0c) out += "\n";
    else if (c === 0x07) out += "\t";
    else if (c === 0x1e) out += "-";
    else if (c === 0x09 || c >= 0x20) out += ch;
  }
  return out
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pieceText(word: Uint8Array, clx: Uint8Array): string {
  const dv = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);
  let p = 0;
  while (p < clx.length && clx[p] === 0x01) {
    if (p + 3 > clx.length) throw fail();
    p += 3 + dv.getUint16(p + 1, true);
  }
  if (clx[p] !== 0x02 || p + 5 > clx.length) throw fail();
  const lcb = dv.getUint32(p + 1, true);
  const plc = p + 5;
  if (plc + lcb > clx.length || lcb < 4 || (lcb - 4) % 12 !== 0) throw fail();
  const n = (lcb - 4) / 12;
  const cp1252 = new TextDecoder("windows-1252");
  const utf16 = new TextDecoder("utf-16le");
  let text = "";
  for (let i = 0; i < n; i++) {
    const start = dv.getUint32(plc + i * 4, true);
    const end = dv.getUint32(plc + (i + 1) * 4, true);
    if (end < start) throw fail();
    const length = end - start;
    const fcValue = dv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true);
    const fc = fcValue & 0x3fffffff;
    if (fcValue & 0x40000000) {
      const at = Math.floor(fc / 2);
      if (at + length > word.length) throw fail();
      text += cp1252.decode(word.subarray(at, at + length));
    } else {
      if (fc + length * 2 > word.length) throw fail();
      text += utf16.decode(word.subarray(fc, fc + length * 2));
    }
  }
  return text;
}

export function readDoc(cfb: Cfb): Extracted {
  const word = cfb.stream("WordDocument");
  if (!word || word.length < 0x200) throw fail();
  const dv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const u16 = (o: number) => {
    if (o + 2 > word.length) throw fail();
    return dv.getUint16(o, true);
  };
  const u32 = (o: number) => {
    if (o + 4 > word.length) throw fail();
    return dv.getUint32(o, true);
  };
  if (u16(0) !== 0xa5ec) throw fail();
  if (u16(2) < 0x00c1) throw new ReadError("unsupported"); // Word 6 and 95
  const flags = u16(0x0a);
  if (flags & 0x0100) throw new ReadError("encrypted");
  const table = cfb.stream(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw fail();
  const csw = u16(32);
  const lw = 36 + csw * 2; // FibRgLw97
  const cslw = u16(lw - 2);
  const fcLcb = lw + cslw * 4 + 2; // FibRgFcLcbBlob
  const ccp = (i: number) => u32(lw + i * 4);
  const fcClx = u32(fcLcb + 33 * 8);
  const lcbClx = u32(fcLcb + 33 * 8 + 4);
  if (fcClx + lcbClx > table.length) throw fail();
  const all = pieceText(word, table.subarray(fcClx, fcClx + lcbClx));
  let at = 0;
  const take = (count: number) => {
    const s = all.slice(at, at + count);
    at += count;
    return s;
  };
  // Stories in CP order: main, footnotes, headers, macro (unused), comments, endnotes, text boxes, header text boxes.
  const [main, footnotes, headers, , comments, endnotes, boxes, headerBoxes] = [3, 4, 5, 6, 7, 8, 9, 10].map((i) => take(ccp(i)));
  const parts = [main, footnotes, headers, endnotes, boxes, headerBoxes].map(cleanWordText).filter(Boolean);
  return { text: [...new Set(parts)].join("\n\n"), hidden: cleanWordText(comments) !== "" };
}
```

In `src/reader/extract.ts`, add `import { readDoc } from "./formats/doc.ts";` and replace the ole case with:

```ts
    case "ole": {
      const cfb = openCfb(bytes);
      const format = oleFormat(cfb);
      if (format === "doc") return { format, extracted: readDoc(cfb) };
      throw new ReadError("unsupported");
    }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS. If the Tika file fails on "Nested table" or the body text, print `JSON.stringify(text.slice(0, 400))` from the test to see what came out, check the FIB offsets against MS-DOC 2.5.1 (FibBase 32 bytes, then csw, FibRgW97, cslw, FibRgLw97, cbRgFcLcb, FibRgFcLcbBlob with fcClx at index 33), and fix the reader, not the expectation.

- [ ] **Step 5: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Read Word 97-2003 files from their piece table, comments left out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Outlook messages (.msg)

The message's property streams: sender, recipients, subject, submit time, plain or HTML body.

**Files:**
- Create: `src/reader/formats/msg.ts`
- Modify: `tests/fixtures/documents/build.ts` (add `buildMsg`), `src/reader/extract.ts` (ole case)
- Test: `src/reader/formats/msg.test.ts`

**Interfaces:**
- Consumes: `Cfb`, `openCfb`, `decodeText`, `labelForCodepage`, `htmlToText` (Task 7), `mailText` (Task 8).
- Produces: `readMsg(cfb: Cfb): Extracted`; `formatDate(d: Date): string` ("2026-10-13 09:30", local time); test helper `buildMsg(m)`.

- [ ] **Step 1: Add the builder**

Append to `tests/fixtures/documents/build.ts`:

```ts
/** An Outlook .msg: string properties as UTF-16 (or 8-bit with `ansi`), fixed properties for code page and submit time. */
export function buildMsg(m: {
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  to?: string;
  cc?: string;
  body?: string;
  html?: string;
  date?: Date;
  attachment?: string;
  ansi?: boolean;
  codepage?: number;
}): Uint8Array {
  const streams: Record<string, Uint8Array> = {};
  const put = (id: number, value: string | undefined) => {
    if (value === undefined) return;
    const tag = id.toString(16).toUpperCase().padStart(4, "0");
    if (m.ansi) streams[`__substg1.0_${tag}001E`] = latin1(`${value}\0`);
    else streams[`__substg1.0_${tag}001F`] = new Uint8Array(Buffer.from(`${value}\0`, "utf16le"));
  };
  put(0x0037, m.subject);
  put(0x0c1a, m.fromName);
  put(0x5d01, m.fromEmail);
  put(0x0e04, m.to);
  put(0x0e03, m.cc);
  put(0x1000, m.body);
  if (m.html !== undefined) streams["__substg1.0_10130102"] = new TextEncoder().encode(m.html);
  const fixed: Array<[number, bigint]> = [];
  if (m.codepage) fixed.push([0x3fde0003, BigInt(m.codepage)]);
  if (m.date) fixed.push([0x00390040, (BigInt(m.date.getTime()) + 11644473600000n) * 10000n]);
  const props = new Uint8Array(32 + fixed.length * 16);
  const dv = new DataView(props.buffer);
  fixed.forEach(([tag, value], i) => {
    dv.setUint32(32 + i * 16, tag, true);
    dv.setUint32(36 + i * 16, 6, true);
    dv.setBigUint64(40 + i * 16, value, true);
  });
  streams["__properties_version1.0"] = props;
  if (m.attachment) streams["__attach_version1.0_#00000000/__substg1.0_3707001F"] = new Uint8Array(Buffer.from(`${m.attachment}\0`, "utf16le"));
  return buildCfb(streams);
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/reader/formats/msg.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMsg } from "../../../tests/fixtures/documents/build.ts";
import { openCfb } from "../cfb.ts";
import { extract } from "../extract.ts";
import { formatDate, readMsg } from "./msg.ts";

const read = (bytes: Uint8Array) => readMsg(openCfb(bytes));

describe("readMsg", () => {
  it("reads sender, recipients, subject, date and body, and says the attachment was left out", () => {
    const date = new Date(2026, 9, 13, 9, 30);
    const msg = buildMsg({
      subject: "Sjukskrivning för Anna",
      fromName: "Anna Berg",
      fromEmail: "anna.berg@norrstrom.se",
      to: "Erik Holm",
      cc: "Lisa Ek",
      body: "Anna Berg är sjukskriven.",
      date,
      attachment: "intyg.pdf",
    });
    expect(read(msg)).toEqual({
      text: `Från: Anna Berg <anna.berg@norrstrom.se>\nTill: Erik Holm\nKopia: Lisa Ek\nÄmne: Sjukskrivning för Anna\nDatum: ${formatDate(date)}\n\nAnna Berg är sjukskriven.`,
      attachments: true,
    });
    expect(formatDate(date)).toBe("2026-10-13 09:30");
  });

  it("reads 8-bit strings in the message's code page", () => {
    expect(read(buildMsg({ subject: "Hej", body: "Hälsningar Erik", ansi: true, codepage: 1252 })).text).toBe("Ämne: Hej\n\nHälsningar Erik");
  });

  it("reads an HTML-only body as text", () => {
    expect(read(buildMsg({ subject: "Hej", html: "<p>Hej <b>Anna</b></p>" }))).toEqual({ text: "Ämne: Hej\n\nHej Anna", attachments: false });
  });

  it("reads Outlook's own file", () => {
    const { text } = read(new Uint8Array(readFileSync("tests/fixtures/documents/tika/test-outlook.msg")));
    expect(text).toContain("Nouvel utilisateur de Outlook Express");
    expect(text).toContain("Messagerie et groupes de discussion");
  });

  it("is reached through extract", async () => {
    expect(await extract(buildMsg({ subject: "Hej", body: "Anna Berg" }), "mejl.msg")).toMatchObject({ kind: "text", format: "msg" });
  });
});
```

Run: `npx vitest run src/reader/formats/msg.test.ts`
Expected: FAIL, `Failed to resolve import "./msg.ts"`.

- [ ] **Step 3: Write the reader and wire it in**

Create `src/reader/formats/msg.ts`:

```ts
// Outlook messages (.msg): sender, recipients, subject, date and body from
// the message's property streams; the plain body, else the HTML body.
// Attachments are left out, and we say so. A message whose only body is
// compressed RTF gives the headers alone (see PLAN.md, Open questions).
import type { Cfb } from "../cfb.ts";
import { decodeText, labelForCodepage } from "../decode.ts";
import type { Extracted } from "../types.ts";
import { htmlToText } from "./html.ts";
import { mailText } from "./mail.ts";

const PR = {
  subject: 0x0037,
  sentRepresentingName: 0x0042,
  sentRepresentingEmail: 0x0065,
  senderName: 0x0c1a,
  senderEmail: 0x0c1f,
  displayCc: 0x0e03,
  displayTo: 0x0e04,
  body: 0x1000,
  html: 0x1013,
  senderSmtp: 0x5d01,
};
const TAG_CODEPAGE = 0x3fde0003;
const TAG_SUBMIT_TIME = 0x00390040;
const TAG_DELIVERY_TIME = 0x0e060040;
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const trimNul = (b: Uint8Array) => {
  let end = b.length;
  while (end > 0 && b[end - 1] === 0) end--;
  return b.subarray(0, end);
};

/** The fixed-size properties of the message: tag → the 8-byte value as two 32-bit halves. */
function fixedProperties(stream: Uint8Array | null): Map<number, { lo: number; hi: number }> {
  const out = new Map<number, { lo: number; hi: number }>();
  if (!stream) return out;
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let at = 32; at + 16 <= stream.length; at += 16) out.set(dv.getUint32(at, true), { lo: dv.getUint32(at + 8, true), hi: dv.getUint32(at + 12, true) });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function readMsg(cfb: Cfb): Extracted {
  const fixed = fixedProperties(cfb.stream("__properties_version1.0"));
  const codepage = fixed.get(TAG_CODEPAGE)?.lo;
  const label = codepage ? labelForCodepage(codepage) : undefined;
  const str = (id: number): string | undefined => {
    const unicode = cfb.stream(`__substg1.0_${hex4(id)}001F`);
    if (unicode) return new TextDecoder("utf-16le").decode(unicode).replace(/\0+$/, "");
    const ansi = cfb.stream(`__substg1.0_${hex4(id)}001E`);
    if (ansi) return decodeText(trimNul(ansi), label);
    return undefined;
  };
  const time = fixed.get(TAG_SUBMIT_TIME) ?? fixed.get(TAG_DELIVERY_TIME);
  const date = time ? formatDate(new Date((time.hi * 2 ** 32 + time.lo) / 10000 - 11644473600000)) : undefined;
  const email = [str(PR.senderSmtp), str(PR.senderEmail), str(PR.sentRepresentingEmail)].find((e) => e?.includes("@"));
  const name = str(PR.senderName) ?? str(PR.sentRepresentingName);
  const from = name && email && name !== email ? `${name} <${email}>` : (name ?? email);
  const htmlBytes = cfb.stream(`__substg1.0_${hex4(PR.html)}0102`);
  const html = htmlBytes ? decodeText(trimNul(htmlBytes), label) : str(PR.html);
  const body = str(PR.body) ?? (html ? htmlToText(html).text : "");
  const attachments = cfb.paths().some((p) => p.startsWith("__attach_version1.0_"));
  return { text: mailText({ from, to: str(PR.displayTo), cc: str(PR.displayCc), subject: str(PR.subject), date }, body), attachments };
}
```

In `src/reader/extract.ts`, add `import { readMsg } from "./formats/msg.ts";` and replace the ole case's last line `throw new ReadError("unsupported");` with:

```ts
      return { format, extracted: readMsg(cfb) };
```

Run: `npm run typecheck`
Expected: passes (`format` is narrowed to `"msg"` there).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/reader`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reader tests/fixtures/documents/build.ts
git commit -m "Read Outlook messages: headers, the plain or HTML body, attachments left out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Every format in the browser, keyboard and accessibility

One end-to-end run per format (Chromium; docx and pdf already run in all three engines), the keyboard path, and axe on the window in both themes.

**Files:**
- Modify: `tests/e2e/file-import.spec.ts`, `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: every builder in `tests/fixtures/documents/build.ts`; `dropFile`, `fileWindow`, `openReady`, `editor`, `rows` from `tests/e2e/helpers.ts`.

- [ ] **Step 1: Write the per-format and keyboard tests**

Append to `tests/e2e/file-import.spec.ts` (extend the fixture import with `buildDoc, buildMsg, buildOdt, buildPptx, buildXlsx, latin1, SAMPLE_TEXT, tp`):

```ts
test.describe("every format", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "the readers are the same code in every engine; docx and pdf run in all three above");

  const rtf = (s: string) => `{\\rtf1\\ansi\\ansicpg1252 ${s.replace(/[^\x20-\x7e\n]/g, (c) => `\\'${c.charCodeAt(0).toString(16)}`).replace(/\n/g, "\\par ")}}`;
  const html = `<!doctype html><meta charset="utf-8"><h1>${SAMPLE.title}</h1>${SAMPLE.lines.map((l) => `<p>${l}</p>`).join("")}`;
  const eml = `Subject: ${SAMPLE.title}\r\nContent-Type: text/plain; charset=iso-8859-1\r\n\r\n${SAMPLE.lines.join("\r\n")}`;
  const cases: Array<[string, string, Uint8Array, string]> = [
    ["avtal.odt", "application/vnd.oasis.opendocument.text", buildOdt([SAMPLE.title, ...SAMPLE.lines].map(tp).join("")), "OpenDocument"],
    ["avtal.rtf", "application/rtf", latin1(rtf(SAMPLE_TEXT)), "RTF"],
    ["avtal.html", "text/html", new TextEncoder().encode(html), "Webbsida"],
    ["avtal.csv", "text/csv", latin1(SAMPLE_TEXT.replace(/\n/g, "\r\n")), "CSV"],
    ["avtal.eml", "message/rfc822", latin1(eml), "E-post"],
    ["avtal.msg", "application/vnd.ms-outlook", buildMsg({ subject: SAMPLE.title, body: SAMPLE.lines.join("\n") }), "Outlook-mejl"],
    ["avtal.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buildXlsx([{ name: "Avtal", rows: [[SAMPLE.title], ...SAMPLE.lines.map((l) => [l])] }]), "Excel"],
    ["avtal.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", buildPptx([{ texts: [SAMPLE.title, ...SAMPLE.lines] }]), "PowerPoint"],
    ["avtal.doc", "application/msword", buildDoc({ main: `${SAMPLE_TEXT.replace(/\n/g, "\r")}\r` }), "Word"],
  ];

  for (const [name, type, bytes, label] of cases) {
    test(`${name} is read and the name in it gets masked`, async ({ page }) => {
      await openReady(page);
      await dropFile(page, editor(page), name, type, bytes);
      const w = fileWindow(page);
      await expect(w).toContainText(`${label} · `);
      await w.getByRole("button", { name: "Använd texten" }).click();
      await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
    });
  }
});

test("the keyboard path: Välj fil, Använd texten, and focus back in Din text", async ({ page }) => {
  await openReady(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Välj fil" }).focus();
  await page.keyboard.press("Enter");
  await (await chooser).setFiles({ name: "avtal.txt", mimeType: "text/plain", buffer: Buffer.from(SAMPLE_TEXT) });
  const use = fileWindow(page).getByRole("button", { name: "Använd texten" });
  await expect(use).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(fileWindow(page)).toBeHidden();
  await expect(editor(page)).toBeFocused();
});
```

- [ ] **Step 2: Add the window to the accessibility checks**

In `tests/e2e/a11y.spec.ts`, add `dropFile, editor, fileWindow` to the helpers import and `import { SAMPLE_TEXT } from "../fixtures/documents/build.ts";`. Inside `test.describe(scheme, () => { … })`, after the existing tests, add:

```ts
      test("Läs in dokument, with the text read", async ({ page }) => {
        await openReady(page);
        await editor(page).fill("Min egen text.");
        await dropFile(page, editor(page), "avtal.txt", "text/plain", SAMPLE_TEXT);
        await expect(fileWindow(page).getByRole("button", { name: "Använd texten" })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

      test("Läs in dokument, with an error", async ({ page }) => {
        await openReady(page);
        await dropFile(page, editor(page), "bild.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
        await expect(fileWindow(page).getByRole("alert")).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
```

- [ ] **Step 3: Run them**

Run: `npx playwright test tests/e2e/file-import.spec.ts tests/e2e/a11y.spec.ts`
Expected: PASS. If axe reports `scrollable-region-focusable` or `aria-allowed-attr` on the preview, the `<pre>` needs `tabIndex={0}` and an `aria-label` (both are in Task 2); if it reports colour contrast on `.file-stats` or `.notice`, use the token the rest of the page uses for secondary text on `yta` (see `design/DESIGN.md`) rather than a new colour.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "Test every document format end to end, the keyboard path and the file window's accessibility

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Docs, changelog and the pull request

The scope change in `CLAUDE.md`, the new phase in `PLAN.md`, the reading flow in `docs/UX.md` and `docs/ARCHITECTURE.md`, one FAQ answer, the changelog, a full test run, and a draft PR. The release itself (version, tag, push to `main`) is the owner's, after merging, by `docs/DEPLOY.md`.

**Files:**
- Modify: `CLAUDE.md`, `PLAN.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/COPY.md`, `src/ui/copy.ts`, `CHANGELOG.md`, `README.md` (only if it lists what the app accepts)

- [ ] **Step 1: CLAUDE.md**

1. Under "## Hard rules (privacy)", change "All inference runs in a **Web Worker**. The main thread never blocks." to:
   "All inference runs in a **Web Worker**, and so does reading a document (a fresh worker per file, terminated after it). The main thread never blocks."
2. Under "## Stack", after the `maskera` line, add:
   "- `pdfjs-dist` (exact version, eval off, no fetching) for PDF, inside the reader worker. Every other document format is read by our own code in `src/reader/`."
3. Under "## Conventions", after the `src/engine/` line, add:
   "- Document reading behind `src/reader/` with a single entry, `readDocument`. Nothing outside imports pdf.js or a format reader. Every dropped or chosen file goes through the window Läs in dokument; text only comes out."
4. In "## Out of scope for v1", replace "File upload (docx/pdf; dropping a plain `.txt` or `.md` file is in), history of texts," with:
   "Saving a scrubbed document back as Word or PDF (documents are read as text only; see `docs/superpowers/specs/2026-10-14-document-import-design.md`), OCR of scanned PDFs, history of texts,"

- [ ] **Step 2: PLAN.md**

1. Before "## Later (not v1)", add:

```markdown
## Phase 6 – Documents (2026-10-14)

Owner's decision, 2026-10-14: read PDF, Word and other documents into text in the browser. Spec: `docs/superpowers/specs/2026-10-14-document-import-design.md`. Plan: `docs/superpowers/plans/2026-10-14-document-import.md`.

- [x] Reader module and worker, detection by bytes, limits (`src/reader/`)
- [x] The window Läs in dokument and Välj fil; every file goes through it
- [x] docx, pdf (pdf.js), odt, rtf, html, eml, xlsx, pptx, doc, msg; txt, md and csv now decoded as windows-1252 when not UTF-8
- [x] Hidden content (comments, deletions, hidden text, notes, hidden slides and sheets) and attachments left out, and the window says so
- [x] No request outside our origin and reading offline, proven in `no-egress.spec.ts` and `offline.spec.ts`
- [ ] Owner review of the Swedish copy (`file.*`, `read.*`, the new FAQ answer)
```

2. In "## Later (not v1)", replace "File upload (docx/pdf/xlsx)," with "OCR for scanned PDFs, saving a scrubbed document back as Word or PDF,".
3. Under "## Open questions", add:

```markdown
- Outlook messages whose only body is compressed RTF (`PR_RTF_COMPRESSED`) give the headers only. Decompressing it (MS-OXRTFCP) is about 80 lines; do it if users report it.
- `.doc`: deleted revisions are not detected (they need the character formatting tables), so their text comes along; table rows come out on one line.
- `.xlsx`: dates come out as Excel serial numbers (45943 rather than 2025-10-13). Dates are not masked, so this is about readability for the AI, not privacy.
```

- [ ] **Step 3: docs/UX.md**

Replace the section "## Dropping files" (its heading and its one paragraph) with:

```markdown
## Reading documents

Dropping a file on the left pane in either mode, or choosing one with "Välj fil" (next to "Visa exempel"), opens the window "Läs in dokument". Every file goes through it, plain text included, so it is always clear that something is happening and nothing changes behind the user's back. Owner's decision, 2026-10-14.

- **Reading.** The file name and "Läser dokumentet …", or "Läser sida 3 av 12 …" for a PDF. Avbryt, Stäng and Esc stop the read; the pane is untouched.
- **Done.** The file name, a line like "Word · 1 240 ord" or "PDF · 12 sidor · 4 300 ord", the notes (hidden parts or attachments left out, only the first of several files read, the text in the pane will be replaced), and the start of the text in a scrollable box. "Använd texten" has focus and puts the text in the pane; Avbryt leaves the pane as it was. In Skrubba this does not reset the kodnyckel, as pasting over the text does not.
- **Error.** One sentence on what happened and what to do, from `file.error.*`, and Stäng.

Formats: PDF, Word (.docx, .doc), OpenDocument (.odt), RTF, Excel (.xlsx), PowerPoint (.pptx), email (.eml, .msg), web pages (.html), CSV, text and Markdown. Comments, deleted text, hidden text, speaker notes, hidden slides and sheets, and attachments are not read. Scanned PDFs have no text and get `file.error.noText`. The text comes out as text; there is no scrubbed document to download.
```

In "Empty state", replace the quoted string with the new `editor.empty` text: "Klistra in text här eller släpp ett dokument. Det stannar i din webbläsare och inget laddas upp."

In the keyboard table, change the `Esc` row's description to "Close the Uppgifter, kodnyckel, Vanliga frågor, Så här funkar det or Läs in dokument window, or the toast".

- [ ] **Step 4: docs/ARCHITECTURE.md**

1. In the module tree, after the `src/engine/` block, add:

```
  reader/
    index.ts             readDocument(file): the only import for the UI
    readerWorker.ts      one worker per file, terminated after it
    extract.ts           detect → format reader → shared checks
    detect.ts            format by magic bytes; names only for plain text
    decode.ts            BOM, UTF-8, windows-1252 fallback
    limits.ts            50 MB file, zip caps, 30 s, 2 000 000 characters
    zip.ts xml.ts        zip via DecompressionStream; minimal XML tokenizer
    cfb.ts               OLE compound files (doc, msg, encrypted Office)
    ooxml.ts textBuilder.ts
    formats/             docx odt xlsx pptx doc msg eml html rtf text pdf (+ pdfLines)
```

2. Add a section "## Reading documents" with: the worker-per-file design and why (a large PDF never blocks masking, a hung parser can be killed, nothing lingers); detection by bytes; the limits and the zip bomb checks (declared sizes capped, ratio 200:1, inflated output never past the declared size); what each format reads and leaves out (copy the table from the spec); pdf.js settings (`isEvalSupported: false`, `disableFontFace: true`, `useSystemFonts: false`, `disableAutoFetch: true`, `disableStream: true`, bytes as `data`, no `cMapUrl` or `standardFontDataUrl`) and which worker variant shipped in Task 4 (pdf.js's code in the reader worker via `globalThis.pdfjsWorker`, or its own nested worker) and why; that the reader chunks and pdf.js are precached by the service worker, so reading works offline; that the CSP is unchanged and `no-egress.spec.ts` proves no request leaves the origin; the known limits from PLAN.md's open questions.

- [ ] **Step 5: The FAQ answer**

In `docs/COPY.md`, at the end of the "## Vanliga frågor" section (after the last answer), add:

```markdown
### Kan jag släppa in PDF och Word?

Ja. Släpp filen på rutan eller tryck Välj fil. Skrubba läser PDF, Word, OpenDocument, RTF, Excel, PowerPoint, mejl som .eml och .msg, webbsidor och text i din webbläsare och lägger texten i rutan. Filen laddas inte upp och sparas inte. Kommentarer, dolda delar och bilagor tas inte med. En skannad PDF utan text går inte att läsa.
```

In `src/ui/copy.ts`, append the same question and answer as the last item of `FAQ.items`:

```ts
    {
      q: "Kan jag släppa in PDF och Word?",
      a: "Ja. Släpp filen på rutan eller tryck Välj fil. Skrubba läser PDF, Word, OpenDocument, RTF, Excel, PowerPoint, mejl som .eml och .msg, webbsidor och text i din webbläsare och lägger texten i rutan. Filen laddas inte upp och sparas inte. Kommentarer, dolda delar och bilagor tas inte med. En skannad PDF utan text går inte att läsa.",
    },
```

If `docs/UX.md` or a test says the FAQ has four questions, update the count. Run: `npx vitest run src/ui/copy.test.ts && npx playwright test tests/e2e/faq.spec.ts`
Expected: PASS.

- [ ] **Step 6: CHANGELOG.md**

Under `## [Unreleased]`, add:

```markdown
### Added

- **Documents.** Drop a PDF, Word, OpenDocument, RTF, Excel, PowerPoint, email (.eml, .msg) or web page file on the text, or choose one with *Välj fil*. A window, *Läs in dokument*, shows that the file is being read, then what was read and the start of the text, and nothing changes until *Använd texten*. The file is read in the browser and never uploaded. Comments, hidden parts and attachments are left out, and the window says so.

### Changed

- Text and CSV files saved in the old Windows encoding (windows-1252) now keep their å, ä and ö.
```

- [ ] **Step 7: Re-record the demo video if the visible flow changed**

The pane head now has "Välj fil", which the video shows. Run `npm run build && npx vite preview --port 4174` in one terminal and `npm run demo-video` in another (needs ffmpeg: `which ffmpeg`). If ffmpeg is missing, do not install anything; note in the PR description that the video needs re-recording.

- [ ] **Step 8: Full verification**

Run: `npm run typecheck && npx vitest run && npx playwright test`
Expected: everything passes in Chromium, Firefox and WebKit. Paste the summary lines (test counts) into the PR description. If anything fails, fix it before going on; do not mark tests as skipped to get green.

Also check by hand once, in light and dark, at desktop width and at 360 px: drop a real PDF and a real Word file of your own (not committed) and read the window. Then open DevTools → Application → Storage and confirm nothing was written to local storage, session storage, IndexedDB or cookies.

- [ ] **Step 9: Commit, push the branch and open a draft PR**

```bash
git add CLAUDE.md PLAN.md docs CHANGELOG.md src/ui/copy.ts public/video README.md
git commit -m "Docs for reading documents: scope, plan, UX, architecture, FAQ and changelog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin worktree-document-import
gh pr create --draft --base main --title "Read PDF, Word and other documents in the browser" --body-file -
```

PR body (pass on stdin):

```markdown
Reads PDF, Word (.docx, .doc), OpenDocument, RTF, Excel, PowerPoint, email (.eml, .msg), web pages, CSV and text into Din text or Svar från AI, entirely in the browser, through a new window, *Läs in dokument*.

- Spec: `docs/superpowers/specs/2026-10-14-document-import-design.md`
- Plan: `docs/superpowers/plans/2026-10-14-document-import.md`
- One new dependency: `pdfjs-dist` 6.4.299 (exact). Every other format is our own code in `src/reader/`.
- CSP unchanged; `no-egress.spec.ts` covers reading a PDF and a Word file; reading works offline.
- Hidden content and attachments are left out and the window says so.

**For the owner to review:** the Swedish copy (`file.*`, `read.*` and the new FAQ answer in `docs/COPY.md`, marked as drafts), and the window in light and dark.

**Release:** after merging, release 1.2.0 by `docs/DEPLOY.md` (Releasing a version).

Test summary: <paste from Step 8>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

(`git add` of a path that has no changes, such as `public/video` when the video was not re-recorded, is harmless.)
