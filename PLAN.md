# PLAN.md

Phased plan for Skrubba. Each phase ends in something runnable. Do not start a phase before the previous one's definition of done is met.

## Phase 0 – Spike (half a day)

Goal: prove the engine works on real-looking texts before any UI exists.

- [ ] Scaffold Vite + React + TS. Install `maskera`, `@huggingface/transformers`.
- [ ] `scripts/spike.ts` (Node): run `redactWithNer` on texts in `spike/texts/*.txt` (owner supplies 3–5 texts, see `spike/README.md`). Print masked text, leaks against `*.expected.txt`, over-masking, timings.
- [ ] Record results in `spike/RESULTS.md`.
- [ ] Decision gate: if leaks on names are unacceptable, evaluate `dtype: "q8"` and, as fallback, KBLab's `bert-base-swedish-lowermix-reallysimple-ner` (475 MB). Record the decision.

Done when: `spike/RESULTS.md` exists with a go/no-go and the chosen dtype.

## Phase 1 – Engine wrapper + self-hosted model

- [ ] `src/engine/Masker.ts` interface: `init(onProgress)`, `maskRules(text)`, `mask(text)`, `applyMask`, `restore`, types `Entity`, `Key`, `WordList`.
- [ ] `src/engine/maskeraMasker.ts` implementing it. Rules sync on main thread; NER in `src/engine/worker.ts`.
- [ ] `src/engine/wordList.ts`: user-supplied terms (one per line), matched case-insensitively as whole words, typed `ORD`, numbered like other entities. Applied before NER, wins over model spans.
- [ ] Self-host model + ONNX runtime in `public/models/` and `public/runtime/`; configure transformers.js `env` per maskera `docs/PRODUCTION.md`.
- [ ] Strict CSP in `index.html`. No `unsafe-inline` scripts.
- [ ] Vitest: round trip on 20 fixture sentences; same value → same placeholder; word list wins over model; restore tolerant of casing/dash/space variants.

Done when: `mask` → `restore` round trip passes and a Playwright test confirms zero requests to non-same-origin hosts.

## Phase 2 – The one screen (Skrubba mode)

Follow `docs/UX.md` exactly.

- [ ] Layout: textarea left, entity panel right, status bar bottom. Mode switch top (Skrubba / Byt tillbaka / Nyckel).
- [ ] On paste or typing (debounced 300 ms): rules + word list immediately, NER when ready. Highlight overlay behind an editable textarea.
- [ ] Entity panel: one row per unique value with type, count, toggle Skrubba / Behåll. Click row → scroll and flash occurrences. Organisations active by default.
- [ ] Manual masking: select text → `M` or floating "Skrubba markering". All occurrences become one `ORD` entity.
- [ ] Word list: collapsible field in the panel, "Egna ord", one term per line. Changes re-run matching live.
- [ ] "Kopiera" button + counter ("14 uppgifter skrubbade"). Clipboard API with fallback.
- [ ] Model loading state in status bar; rules work meanwhile.
- [ ] "Visa exempel" loads the example text from `docs/COPY.md`.
- [ ] Keyboard shortcuts per `docs/UX.md`.

Done when: a user can paste, review, adjust, add a word, and copy in under 30 seconds without the mouse.

## Phase 3 – Byt tillbaka and Nyckel modes

- [ ] Byt tillbaka: textarea for the LLM answer, button "Byt tillbaka". Restored spans highlighted. Unmatched placeholders listed with a suggestion and one-click accept.
- [ ] Nyckel: table placeholder → value → type → count, plus the word list. "Ladda ner nyckel" (JSON, includes word list, with warning), "Ladda upp nyckel", "Rensa allt".
- [ ] Key and word list in a React context, memory only. Test asserts no storage API is touched.
- [ ] `beforeunload` warning if a key exists and has not been downloaded.

Done when: Phase 1 round trip works through the UI, including suggestions.

## Phase 4 – Trust and polish

- [ ] Status bar trust line "Inget lämnar din dator" → `/sa-funkar-det` page per `docs/COPY.md`.
- [ ] PWA: manifest, service worker precaching app + model + runtime. Offline test.
- [ ] Accessibility: full keyboard, visible focus, ARIA live region for status, colour + label for types, contrast AA.
- [ ] Performance: 10 000 chars masked in < 3 s after model load. Chunk with overlap, dedupe across boundaries.
- [ ] Mobile: usable at 390 px; entity panel becomes a bottom sheet.

Done when: Lighthouse PWA + accessibility pass, offline works, Playwright suite green.

## Phase 5 – Ship

- [ ] Cloudflare Pages deploy to `skrubba.promptagency.se` with `_headers` for CSP and caching.
- [ ] Public `README.md`: what it is, what it is not (not a compliance guarantee), run locally, verify no network calls, credits to maskera and KBLab, MIT license.
- [ ] Footer: "Bygger på maskera (MIT) och KB-BERT (CC0). Öppen källkod."

## Later (not v1)

File upload (docx/pdf/xlsx), fake replacement names preserving gender, role profiles (HR, socialtjänst, skola, vård, jurist), encrypted saved cases, browser extension, additional Swedish rule detectors (fastighetsbeteckning, diarienummer, ärendenummer) contributed upstream to maskera, standalone domain (skrubba.nu / skrubba.app registered but unused).

## Open questions

- Model dtype after spike (q4 vs q8).
- Should the word list support simple patterns (e.g. `Projekt *`)? Default: no, plain terms only in v1.
