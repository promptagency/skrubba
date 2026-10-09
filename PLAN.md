# PLAN.md

Phased plan for Skrubba. Each phase ends in something runnable. Do not start a phase before the previous one's definition of done is met.

## Phase 0 – Spike (half a day)

Goal: prove the engine works on real-looking texts before any UI exists.

- [x] Scaffold Vite + React + TS. Install `maskera`, `@huggingface/transformers`.
- [x] `scripts/spike.ts` (Node): run `redactWithNer` on texts in `spike/texts/*.txt` (owner supplies 3–5 texts, see `spike/README.md`). Print masked text, leaks against `*.expected.txt`, over-masking, timings.
- [x] Record results in `spike/RESULTS.md`.
- [x] Decision gate: if leaks on names are unacceptable, evaluate `dtype: "q8"` and, as fallback, KBLab's `bert-base-swedish-lowermix-reallysimple-ner` (475 MB). Record the decision.
- [ ] Re-run `npm run spike` on the owner's real texts and confirm the decision below.

Decision (2026-10-09, on five stand-in texts written by Claude): **go, dtype q8 (provisional).** Leaks out of 76 expected values: q4 3, q8 1, rules only 57. Zero NAMN and PERSONNUMMER leaks with either dtype, so KBLab was not evaluated. q8 is chosen because a miss is worse than over-masking and it ran faster on Node CPU; the cost is +16 MB once. maskera's published benchmarks are on q4, so re-check browser WASM speed for both in Phase 1. Full numbers and findings in `spike/RESULTS.md` (gitignored).

Done when: `spike/RESULTS.md` exists with a go/no-go and the chosen dtype.

## Phase 1 – Engine wrapper + self-hosted model

- [x] `src/engine/Masker.ts` interface: `init(onProgress)`, `maskRules(text)`, `mask(text)`, `applyMask`, `restore`, types `Entity`, `Key`, `WordList`.
- [x] `src/engine/maskeraMasker.ts` implementing it. Rules sync on main thread; NER in `src/engine/worker.ts`.
- [x] `src/engine/wordList.ts`: user-supplied terms (one per line), matched case-insensitively as whole words, typed `ORD`, numbered like other entities. Applied before NER, wins over model spans.
- [x] First-name linking (decided 2026-10-09). A lone single-word NAMN whose case-folded, genitive-stripped form equals the first word of exactly one multi-word NAMN in the same text gets that entity's placeholder ("Johan", "Johans" → the [NAMN_n] of "Johan Lindqvist"). If two or more full names share that first name ("Anna Berg", "Anna Ek"), do not link; "Anna" gets its own placeholder, since a wrong link restores the wrong person. Restore writes the full name ("Johan Lindqvist") for every occurrence; each occurrence keeps its surface form so the UI can show which forms were linked. Surnames alone are not linked in v1. Tests: link, genitive link, ambiguous first name stays separate, link survives text edits without renumbering.
- [x] Merging (decided 2026-10-09): same value with different types shares one entity, typed by the first type seen; adjacent model spans separated only by a space or apostrophe are joined; org.nr context rule. Tests for each.
- [x] Self-host model + ONNX runtime in `public/models/` and `public/runtime/`; configure transformers.js `env` per maskera `docs/PRODUCTION.md`.
- [x] Strict CSP in `index.html`. No `unsafe-inline` scripts.
- [x] Vitest: round trip on 20 fixture sentences; same value → same placeholder; word list wins over model; restore tolerant of casing/dash/space variants.

Done when: `mask` → `restore` round trip passes and a Playwright test confirms zero requests to non-same-origin hosts.

Status 2026-10-09: done. 97 Vitest tests (20 sentences round-trip through the real q8 model with zero leaks), Playwright `no-egress` green and shown to fail when the runtime points at a CDN. `src/ui/App.tsx` is a throwaway harness until Phase 2.

Notes from Phase 1:
- `Masker` gained a `MaskInput` (`wordList`, `manual`) argument; manual terms are ORD spans with top priority.
- No `chunk.ts`: maskera already splits long text (see ARCHITECTURE.md, Long texts).
- Model load progress is coarse (start, done) for self-hosted files. `status.loading` wants a percentage; Phase 2 needs either a byte-level progress source or a different string.
- Placeholder numbers are claimed as the user types (debounced), so a half-typed name can use up a number. Stable, but numbers may have gaps.


## Phase 2 – The one screen (Skrubba mode)

Follow `docs/UX.md` exactly.

- [x] Layout: textarea left, entity panel right, status bar bottom. Mode switch top (Skrubba / Byt tillbaka / Nyckel).
- [x] On paste or typing (debounced 300 ms): rules + word list immediately, NER when ready. Highlight overlay behind an editable textarea.
- [x] Entity panel: one row per unique value with type, count, toggle Skrubba / Behåll. Click row → scroll and flash occurrences. Organisations active by default.
- [x] Manual masking: select text → `M` or floating "Skrubba markering". All occurrences become one `ORD` entity.
- [x] Word list: collapsible field in the panel, "Egna ord", one term per line. Changes re-run matching live.
- [x] "Kopiera" button + counter ("14 uppgifter skrubbade"). Clipboard API with fallback.
- [x] Model loading state in status bar; rules work meanwhile.
- [x] "Visa exempel" loads the example text from `docs/COPY.md`.
- [x] Keyboard shortcuts per `docs/UX.md`.

Done when: a user can paste, review, adjust, add a word, and copy in under 30 seconds without the mouse.

Status 2026-10-09: done. Playwright `scrub.spec.ts` does it keyboard-only in about 5 s after model load; 121 Vitest tests, 6 Playwright tests green.

Decisions and notes from Phase 2:
- "Kopiera" is disabled while the model loads, so rules-only text with unmasked names cannot be copied by accident. Once the model fails (rules-only state) copying is allowed again; the status line tells the user to mark names themselves.
- Copy re-masks the current text instead of trusting highlights that may be 300 ms old.
- The loading percentage is real: the worker counts weight bytes through transformers.js `env.fetch`.
- Byt tillbaka and Nyckel tabs are visible but disabled until Phase 3. The "?" link and the "Inget lämnar din dator" link to `/sa-funkar-det` wait for Phase 4.
- The model tags months as places ("maj" → Plats) in the example. Over-masking, fixable with Behåll.

Follow-up 2026-10-09: model before work (owner's decision).
- The editor is locked with `gate.lead`, `gate.body` and the percentage until the model is ready; rules-only unlocks it if the model fails.
- First-visit download cut from 86 MB to 53 MB (packed model, plain runtime only).
- Offline service worker: the model is downloaded once and served from the cache afterwards, offline included. q4 stays off the table until real timings say 53 MB is too slow.
- Playwright now runs in Chromium, Firefox and WebKit (30 tests; clipboard and service-worker network checks are Chromium-only).


## Phase 3 – Byt tillbaka and Nyckel modes

- [ ] Byt tillbaka: textarea for the LLM answer, button "Byt tillbaka". Restored spans highlighted. Unmatched placeholders listed with a suggestion and one-click accept.
- [ ] Nyckel: table placeholder → value → type → count, plus the word list. "Ladda ner nyckel" (JSON, includes word list, with warning), "Ladda upp nyckel", "Rensa allt".
- [ ] Key and word list in a React context, memory only. Test asserts no storage API is touched.
- [ ] `beforeunload` warning if a key exists and has not been downloaded.

Done when: Phase 1 round trip works through the UI, including suggestions.

## Phase 4 – Trust and polish

- [ ] Status bar trust line "Inget lämnar din dator" → `/sa-funkar-det` page per `docs/COPY.md`.
- [ ] PWA manifest and icons (installable). The offline service worker and its tests were done early, 2026-10-09 (see Phase 2 notes).
- [ ] Accessibility: full keyboard, visible focus, ARIA live region for status, colour + label for types, contrast AA.
- [ ] Performance: 10 000 chars masked in < 3 s after model load. Chunk with overlap, dedupe across boundaries.
- [ ] Mobile: usable at 390 px; entity panel becomes a bottom sheet.

Done when: Lighthouse PWA + accessibility pass, offline works, Playwright suite green.

## Phase 5 – Ship

- [x] Fit the 25 MiB per-file cap on Cloudflare Pages. Done 2026-10-09: model gzipped in two parts, plain runtime gzipped, other variants and Vite's duplicate dropped, build fails on any file over 25 MiB. See ARCHITECTURE.md, Delivery and offline.
- [ ] Cloudflare Pages deploy to `skrubba.promptagency.se` with `_headers` for CSP and caching.
- [ ] Public `README.md`: what it is, what it is not (not a compliance guarantee), run locally, verify no network calls, credits to maskera and KBLab, MIT license.
- [ ] Footer: "Bygger på maskera (MIT) och KB-BERT (CC0). Öppen källkod."

## Later (not v1)

File upload (docx/pdf/xlsx), fake replacement names preserving gender, role profiles (HR, socialtjänst, skola, vård, jurist), encrypted saved cases, browser extension, additional Swedish rule detectors (fastighetsbeteckning, diarienummer, ärendenummer) contributed upstream to maskera, standalone domain (skrubba.nu / skrubba.app registered but unused).

## Open questions

- ~~Model dtype after spike (q4 vs q8).~~ q8, provisional until the spike runs on real texts (see Phase 0).
- Should the word list support simple patterns (e.g. `Projekt *`)? Default: no, plain terms only in v1.
- ~~First name linked to full name.~~ Decided 2026-10-09: link. See the Phase 1 task.
- ~~Same value, different types.~~ Decided 2026-10-09: merge by value regardless of type, keep the first type seen.
- ~~Split spans.~~ Decided 2026-10-09: merge adjacent model spans separated only by a space or apostrophe. Does not fix "Volvo Personvagnar", where the model left "Personvagnar" unmasked.
- ~~Display names for maskera's extra types.~~ Added to `docs/COPY.md` 2026-10-09.
- **Enable maskera's `regnummer` rule?** Off by default upstream (plate shape = booking-code shape). Leaning on: a miss is worse than over-masking. Decide in Phase 1.
- ~~Org.nr with a bad check digit is not masked.~~ Decided 2026-10-09: our own context rule masks any NNNNNN-NNNN right after "org.nr", "orgnr" or "organisationsnummer", checksum or not. Not reported upstream.
- **Copy strings not in `docs/COPY.md`.** (1) What to show when copying fails (clipboard blocked); today nothing is shown. (2) The hover label on a highlight is composed as "Namn · [NAMN_1] · Skrubba". (3) Screen-reader label of a panel row is "value, type, count, Skrubba/Behåll". Owner's copy call.
