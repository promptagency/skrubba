# ARCHITECTURE.md

## Modules

```
src/
  config.ts              product name, URL, pinned model (revision, dtype, sha256), paths
  engine/
    Masker.ts            interface + types (Entity, Span, Key, RestoreResult)
    index.ts             createBrowserMasker()
    maskeraMasker.ts     Masker implementation: merges all span sources
    rules.ts             rule layer (@maskera/core detectors + our context rules)
    contextRules.ts      our own rules, e.g. labelled org.nr with a bad checksum
    wordList.ts          manual and word-list terms → ORD spans, whole word, case-insensitive
    spans.ts             priority, clipping, joining split model spans
    entities.ts          session numbering, value merging, first-name linking
    applyMask.ts         masked text + key
    tolerantRestore.ts   placeholder normalisation + suggestions
    ner.ts               NerBackend interface
    nerModel.ts          maskera recognizer on our files + model spans
    worker.ts            Web Worker: loads model, verifies sha256, runs NER
    workerBackend.ts     main-thread side of the worker protocol
    protocol.ts          worker message types
  state/
    session.tsx          React context: text, entities, key (memory only)
  ui/
    App.tsx, ModeTabs, Editor (textarea + overlay), EntityPanel,
    RestoreView, KeyView, StatusBar, Toast
  pages/
    HowItWorks.tsx       /sa-funkar-det
scripts/
  fetch-model.ts         downloads the pinned model (sha256-checked), copies the runtime
public/
  models/<model-dir>/... self-hosted ONNX + tokenizer + config (gitignored)
  runtime/               onnxruntime-web wasm files (gitignored)
  _headers               Cloudflare Pages headers (CSP, cache)
```

Only `engine/rules.ts` (`@maskera/core`), `engine/nerModel.ts` (`maskera`) and `engine/worker.ts` (`@huggingface/transformers`) import the engine libraries. `nerModel.ts` is reached only from the worker and from Node tests, so the main bundle never contains the model package.

## Masker interface

```ts
export type EntityType =   // maskera's labels verbatim, so placeholders match its format
  | "NAMN" | "PLATS" | "ORGANISATION" | "ADRESS"
  | "PERSONNUMMER" | "SAMORDNINGSNUMMER" | "ORGANISATIONSNUMMER"
  | "TELEFON" | "EPOST" | "POSTNUMMER" | "LAGENHETSNUMMER"
  | "BANKGIRO" | "PLUSGIRO" | "IBAN" | "KORTNUMMER" | "KONTONUMMER"
  | "IP_ADRESS" | "URL" | "JOURNALNUMMER" | "REGNUMMER"
  | "ORD";   // manual selection or word list

export interface Entity {
  id: string;            // stable within session
  value: string;         // canonical surface form
  type: EntityType;
  placeholder: string;   // "[NAMN_1]"
  occurrences: Array<{ start: number; end: number; surface: string }>;
  active: boolean;       // false = Behåll
  source: "rule" | "model" | "manual" | "wordlist";
  confidence?: number;
}

export interface Key {
  entries: Array<{ placeholder: string; value: string; type: EntityType }>;
  wordList: string[];
  createdAt: string;
  app: "skrubba";
  version: 1;
}

export interface Masker {
  init(onProgress: (p: { loaded: number; total: number }) => void): Promise<void>;
  maskRules(text: string, wordList: string[]): Entity[]; // sync, instant
  mask(text: string, wordList: string[]): Promise<Entity[]>; // + NER, merged
  applyMask(text: string, entities: Entity[]): { masked: string; key: Key };
  restore(text: string, key: Key): RestoreResult;
}
```

## Placeholder numbering

Numbering is assigned once per session per unique value and never reused. If the user edits the text and an entity disappears, its number is retired, not recycled. This keeps the key stable across edits.

## Merging rules and model

Priority on overlap: manual > word list > rules > model. A lower-priority span wholly inside a higher-priority one is dropped. One that partially overlaps is clipped to its uncovered part, as maskera does, so that part stays masked. Organisations from the model are active by default.

Adjacent model spans separated only by a space or an apostrophe are joined into one span ("Arc'teryx" came back as ORGANISATION + NAMN). The joined span is ORGANISATION if either part was, otherwise the first part's type.

Our own context rule masks NNNNNN-NNNN right after "org.nr", "orgnr" or "organisationsnummer" as ORGANISATIONSNUMMER even when the checksum fails. maskera only masks Luhn-valid org.nr.

Values are merged across surface forms: case-insensitive, trailing genitive `s` stripped for NAMN/PLATS/ORGANISATION, whitespace normalised. "Anna Berg", "anna berg" and "Anna Bergs" share one placeholder. The merge ignores type: the same value found as PLATS and as ORGANISATION ("Göteborg") is one entity, typed by the first type seen in the session.

First names are linked to full names. A single-word NAMN whose normalised form (as above) equals the first word of exactly one multi-word NAMN in the same text joins that entity: "Johan" and "Johans" get the placeholder of "Johan Lindqvist". If two or more full names share the first name ("Anna Berg", "Anna Ek"), a lone "Anna" is not linked and gets its own placeholder, because a wrong link restores the wrong person. Surnames alone are not linked in v1.

A linked entity has one `value`, the full name, and restore writes that for every occurrence: an answer that said "[NAMN_1]" where the original said "Johan" comes back as "Johan Lindqvist". Each occurrence keeps its own `surface`, so the entity panel can show the linked forms.

## Long texts

KB-BERT max 512 tokens. maskera's recognizer already splits text over 480 tokens at a boundary it picks (`splitPoint`) and runs each part, so there is no `chunk.ts` for now. Phase 4 measures 10 000 chars and revisits this if boundaries cut entities.

## Tolerant restore

LLMs mangle placeholders. `tolerantRestore.ts` normalises candidates before matching:

1. Strip brackets, quotes and backticks: `[NAMN_1]`, `NAMN_1`, `"NAMN_1"`.
2. Case-fold: `namn_1`, `Namn_1`.
3. Separator variants: `NAMN 1`, `NAMN-1`, `NAMN1`, `NAMN_01`.
4. Inflected or translated forms: `NAMN_1s`, `NAMN_1:s`, `NAME_1`, `PERSON_1` → map via a small alias table to the Swedish type.
5. Everything matched with rules 1–2 is restored silently. Rules 3–5 produce a **suggestion** the user confirms.

Never restore a placeholder number that does not exist in the key. Report it.

## Privacy enforcement

- CSP meta tag, added at build time by `vite.config.ts` (the dev server needs inline scripts): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self' blob:; img-src 'self' data:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. `'wasm-unsafe-eval'` is required for onnxruntime to compile WASM; it does not allow JavaScript eval.
- transformers.js env: `allowRemoteModels = false`, `allowLocalModels = true`, `localModelPath = "/models/"`, `backends.onnx.wasm.wasmPaths = "/runtime/"`. The worker also sha256-checks the ONNX weights against `config.ts` before reporting ready.
- Playwright test `no-egress.spec.ts`: records every request during a full mask → restore session and asserts all URLs share the app origin.
- Unit test `no-storage.spec.ts`: proxies `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` and asserts no access during a session.
- Service worker caches only same-origin assets.

## Worker protocol

```
main → worker: { type: "init" }
worker → main: { type: "progress", loaded, total } ... { type: "ready" }
main → worker: { type: "ner", id, text }
worker → main: { type: "ner-result", id, spans: [{start,end,type,source:"model"}] }
worker → main: { type: "error", id?, message }
```

If the worker fails to initialise (old browser, blocked WASM), the app continues in rules-only mode and says so in the status bar. It never silently degrades.

## Performance budgets

- Rules on 10 000 chars: < 50 ms main thread.
- NER on 10 000 chars after load: < 3 s.
- First paint: < 1 s on 3G. Model loads lazily after first paint.
