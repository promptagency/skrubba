# ARCHITECTURE.md

## Modules

```
src/
  config.ts              product name, slug, model paths, version
  engine/
    Masker.ts            interface + types (Entity, Key, MaskResult)
    maskeraMasker.ts     implementation on top of `maskera`
    worker.ts            Web Worker: loads model, runs NER
    tolerantRestore.ts   placeholder normalisation + suggestions
    wordList.ts          user terms → ORD entities, whole-word, case-insensitive
    chunk.ts             long-text chunking with overlap
  state/
    session.tsx          React context: text, entities, key (memory only)
  ui/
    App.tsx, ModeTabs, Editor (textarea + overlay), EntityPanel,
    RestoreView, KeyView, StatusBar, Toast
  pages/
    HowItWorks.tsx       /sa-funkar-det
public/
  models/<model-id>/...  self-hosted ONNX + tokenizer + config
  runtime/               onnxruntime-web wasm files
  _headers               Cloudflare Pages headers (CSP, cache)
```

Only `engine/maskeraMasker.ts` and `engine/worker.ts` import `maskera` or `@huggingface/transformers`.

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

Priority on overlap: manual > word list > rules > model. Lower-priority spans that partially overlap a higher-priority span are dropped. Organisations from the model are active by default.

Values are merged across surface forms: case-insensitive, trailing genitive `s` stripped for NAMN/PLATS/ORGANISATION, whitespace normalised. "Anna Berg", "anna berg" and "Anna Bergs" share one placeholder.

First names are linked to full names. A single-word NAMN whose normalised form (as above) equals the first word of exactly one multi-word NAMN in the same text joins that entity: "Johan" and "Johans" get the placeholder of "Johan Lindqvist". If two or more full names share the first name ("Anna Berg", "Anna Ek"), a lone "Anna" is not linked and gets its own placeholder, because a wrong link restores the wrong person. Surnames alone are not linked in v1.

A linked entity has one `value`, the full name, and restore writes that for every occurrence: an answer that said "[NAMN_1]" where the original said "Johan" comes back as "Johan Lindqvist". Each occurrence keeps its own `surface`, so the entity panel can show the linked forms.

## Long texts

KB-BERT max 512 tokens. `chunk.ts` splits on paragraph boundaries into ≤ 400-token windows with 50-token overlap, runs NER per chunk in the worker, and merges spans; a span found in the overlap by either chunk counts once.

## Tolerant restore

LLMs mangle placeholders. `tolerantRestore.ts` normalises candidates before matching:

1. Strip brackets, quotes and backticks: `[NAMN_1]`, `NAMN_1`, `"NAMN_1"`.
2. Case-fold: `namn_1`, `Namn_1`.
3. Separator variants: `NAMN 1`, `NAMN-1`, `NAMN1`, `NAMN_01`.
4. Inflected or translated forms: `NAMN_1s`, `NAMN_1:s`, `NAME_1`, `PERSON_1` → map via a small alias table to the Swedish type.
5. Everything matched with rules 1–2 is restored silently. Rules 3–5 produce a **suggestion** the user confirms.

Never restore a placeholder number that does not exist in the key. Report it.

## Privacy enforcement

- `index.html` CSP: `default-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; img-src 'self' data:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`.
- transformers.js env: `allowRemoteModels = false`, `allowLocalModels = true`, `localModelPath = "/models/"`, `backends.onnx.wasm.wasmPaths = "/runtime/"`.
- Playwright test `no-egress.spec.ts`: records every request during a full mask → restore session and asserts all URLs share the app origin.
- Unit test `no-storage.spec.ts`: proxies `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` and asserts no access during a session.
- Service worker caches only same-origin assets.

## Worker protocol

```
main → worker: { type: "init" }
worker → main: { type: "progress", loaded, total } ... { type: "ready" }
main → worker: { type: "ner", id, text }
worker → main: { type: "ner-result", id, spans: [{start,end,label,score}] }
worker → main: { type: "error", id?, message }
```

If the worker fails to initialise (old browser, blocked WASM), the app continues in rules-only mode and says so in the status bar. It never silently degrades.

## Performance budgets

- Rules on 10 000 chars: < 50 ms main thread.
- NER on 10 000 chars after load: < 3 s.
- First paint: < 1 s on 3G. Model loads lazily after first paint.
