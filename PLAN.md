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
- [x] `src/engine/wordList.ts`: user-supplied terms (one per line), matched case-insensitively as whole words or, when four characters or more, as the start of a compound word, typed `ORD`, numbered like other entities. Applied before NER, wins over model spans.
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

- [x] Byt tillbaka: textarea for the LLM answer, button "Byt tillbaka". Restored spans highlighted. Unmatched placeholders listed with a suggestion and one-click accept.
- [x] Nyckel: table placeholder → value → type → count, plus the word list. "Ladda ner nyckel" (JSON, includes word list, with warning), "Ladda upp nyckel", "Rensa allt".
- [x] Key and word list in a React context, memory only. Test asserts no storage API is touched.
- [x] `beforeunload` warning if a key exists and has not been downloaded.

Done when: Phase 1 round trip works through the UI, including suggestions.

Status 2026-10-10: done. `tests/e2e/restore.spec.ts` runs scrub → copy → paste answer → restore with a suggestion (Ja/Nej) and an unknown placeholder, key download → upload in a fresh tab → restore, invalid file, Rensa allt, the unload warning, and a full session with a spy on localStorage, sessionStorage, indexedDB and cookies (none touched, nothing persisted). 153 Vitest tests; 57 Playwright tests green in Chromium, Firefox and WebKit.

Decisions from Phase 3:
- The key is built up from every copy (a placeholder keeps its first value) and is recorded before the clipboard write. "Inte nedladdad" means it has entries added since the last download.
- Uploading a key replaces the whole session (text, entities, word list, key) after `key.uploadConfirm`, and the numbering continues from the key, so a returning case keeps its placeholders. Merging two sessions' keys could give one placeholder two values, so it is not offered.
- Byt tillbaka always restores from the answer as pasted plus the suggestions accepted so far; editing the answer starts over. A restore made before the key had a value is redone when the key grows.
- In Nyckel mode the status bar has no primary button: the view has its own, with the download warning under it. Cmd+Enter still downloads.
- New strings approved and in `docs/COPY.md`: `restore.empty`, `key.empty`, `key.uploadError`, `key.uploadConfirm`; table headers moved there from UX.md.
- The browser shows its own text for the unload warning; `unload.warning` is set but most browsers ignore custom text.


## Phase 4 – Trust and polish

- [x] Status bar trust line "Inget lämnar din dator" → `/sa-funkar-det` page per `docs/COPY.md`.
- [x] PWA manifest and icons (installable). The offline service worker and its tests were done early, 2026-10-09 (see Phase 2 notes).
- [x] Accessibility: full keyboard, visible focus, ARIA live region for status, colour + label for types, contrast AA.
- [x] Performance: 10 000 chars masked in < 3 s after model load. Chunk with overlap, dedupe across boundaries.
- [x] Mobile: usable at 390 px; entity panel becomes a bottom sheet.

Done when: Lighthouse PWA + accessibility pass, offline works, Playwright suite green.

Status 2026-10-10: done. 161 Vitest tests; 94 Playwright tests green in Chromium, Firefox and WebKit (38 skips are Chromium-only checks). Lighthouse 12, mobile emulation, production build: performance 100, accessibility 100, best practices 100, CLS 0, TBT 0 ms.

Notes from Phase 4:
- Lighthouse removed its PWA category in v12, so "Lighthouse PWA" is replaced by Chrome's own manifest parse (`Page.getAppManifest`, no errors) plus a manifest test in all three browsers. Accessibility is checked on every view, light and dark, desktop and 390 px, with axe-core (WCAG 2.2 AA), the engine behind Lighthouse's score.
- Performance: 10 000 characters masked in about 1.4 s in Chromium, from 4.4 s, by turning on cross-origin isolation (COOP `same-origin`, COEP `require-corp`) so onnxruntime runs on several threads. Skrubba loads nothing cross-origin, so the headers block nothing. Set in `public/_headers` and the Vite servers.
- No own chunking: a 10 000-character test with ~200 different names through the real model leaks no name, so maskera's splitting is enough. Rules on 10 000 characters run in under 50 ms.
- The status line is read to screen readers in quarters while loading; the visible line shows every percent with fixed-width digits, and on narrow screens the trust link has its own line. Together that took layout shift to 0.
- Mobile: the entity panel is a bottom sheet behind an "{n} uppgifter" chip; Esc or a tap outside closes it.
- ~~The app icon is a placeholder.~~ Replaced by the Skrubba symbol from `design/logo/` (`scripts/make-icons.ts`).


## Phase 4b – Owner's layout (2026-10-10)

The owner's wireframe replaced the three modes with two cards and a key card. Done: large logotype; "Nyckel" + key button opening the key as a dialog; "?" top right; Skrubba and Avskrubba cards side by side (stacked on phones); item list under the Skrubba card with Kopiera beside its toggle; Avskrubba button that becomes Kopiera; `.txt`/`.md` drop on both cards; footer with credits and the trust link. 171 Vitest, 109 Playwright tests green.

- [x] Second round (2026-10-10): "Vanliga frågor" replaces "?" and the `/sa-funkar-det` page with a window; the kodnyckel window shares the same modal; "Nyckel" renamed "Kodnyckel" with an explainer so it is not mistaken for an encryption key.
- [x] Third round (2026-10-10): click a highlight to keep it (border in a darker shade per type). Skrubba and Avskrubba became two modes picked with a switch: input left, the button between the panes runs the mode, the result appears right and only then Kopiera. Any change clears the result. The kodnyckel is recorded on Skrubba, not on copy. Text with placeholders in Skrubba offers "Flytta till Avskrubba".
- [x] Fourth round (2026-10-10): the kodnyckel left the top bar. "Kodnyckel ({n})" sits beside Kopiera once the tab has one; Avskrubba in a tab without one offers "Ladda upp kodnyckel", and uploading keeps the pasted answer.
- [x] Owner reviews UX, branding and the strings under "Att granska" in `docs/COPY.md`. Approved 2026-10-12; the section is now "Ändringar".
- [ ] History of texts (wireframe): left out for now. If it comes back, decide memory-only (this tab) versus saved on the device, which would change a hard rule.
- [x] `CLAUDE.md` updated 2026-10-10 for the two-card layout and plain-text drop.

## Phase 5 – Ship

- [x] Fit the 25 MiB per-file cap on Cloudflare Pages. Done 2026-10-09: model gzipped in two parts, plain runtime gzipped, other variants and Vite's duplicate dropped, build fails on any file over 25 MiB. See ARCHITECTURE.md, Delivery and offline.
- [x] Cloudflare Pages deploy to `skrubba.promptagency.se` with `_headers` for CSP and caching. Live 2026-10-12, built from `main` (settings in `docs/DEPLOY.md`); `npm run smoke` passes against it in all three browsers.
- [x] Public `README.md`: what it is, what it is not (not a compliance guarantee), run locally, verify no network calls, credits to maskera and KBLab, MIT license. Done 2026-10-12, with logo and screenshots; deploy notes moved to `docs/DEPLOY.md`. `LICENSE` added 2026-10-12 (MIT, Prompt Agency).
- [x] Footer credits. Done 2026-10-12: byline, credits with links to maskera and KB-BERT, "Källkod till Skrubba finns på Github", version.

## Phase 6 – Documents (2026-10-14)

Owner's decision, 2026-10-14: read PDF, Word and other documents into text in the browser. Spec: `docs/superpowers/specs/2026-10-14-document-import-design.md`. Plan: `docs/superpowers/plans/2026-10-14-document-import.md`.

- [x] Reader module and worker, detection by bytes, limits (`src/reader/`)
- [x] The window Läs in dokument and Välj fil; every file goes through it
- [x] docx, pdf (pdf.js), odt, rtf, html, eml, xlsx, pptx, doc, msg; txt, md and csv now decoded as windows-1252 when not UTF-8
- [x] Hidden content (comments, deletions, hidden text, notes, hidden slides and sheets) and attachments left out, and the window says so
- [x] In Skrubba a document starts a new kodnyckel, asking first like Ny text (owner's decision, 2026-10-14); Avskrubba keeps the key
- [x] No request outside our origin and reading offline, proven in `no-egress.spec.ts` and `offline.spec.ts`
- [x] Owner review of the Swedish copy (`file.*`, `read.*`, the new FAQ answer). Approved 2026-10-15.

## Later (not v1)

OCR for scanned PDFs, saving a scrubbed document back as Word or PDF, fake replacement names preserving gender, role profiles (HR, socialtjänst, skola, vård, jurist), encrypted saved cases, browser extension, additional Swedish rule detectors (fastighetsbeteckning, diarienummer, ärendenummer) contributed upstream to maskera, standalone domain (skrubba.nu / skrubba.app registered but unused).

## Open questions

- ~~Model dtype after spike (q4 vs q8).~~ q8, provisional until the spike runs on real texts (see Phase 0).
- Should the word list support simple patterns (e.g. `Projekt *`)? Default: no, plain terms only in v1.
- ~~First name linked to full name.~~ Decided 2026-10-09: link. See the Phase 1 task.
- ~~Same value, different types.~~ Decided 2026-10-09: merge by value regardless of type, keep the first type seen.
- ~~Split spans.~~ Decided 2026-10-09: merge adjacent model spans separated only by a space or apostrophe. Does not fix "Volvo Personvagnar", where the model left "Personvagnar" unmasked.
- ~~Display names for maskera's extra types.~~ Added to `docs/COPY.md` 2026-10-09.
- ~~Enable maskera's `regnummer` rule?~~ Decided 2026-10-12: on. Off by default upstream (plate shape = booking-code shape), but a miss is worse than over-masking. No false hits in the owner's spike texts.
- ~~Org.nr with a bad check digit is not masked.~~ Decided 2026-10-09: our own context rule masks any NNNNNN-NNNN right after "org.nr", "orgnr" or "organisationsnummer", checksum or not. Not reported upstream.
- ~~**Flaky test.**~~ Fixed 2026-10-11. The deploy tests failed about one run in eight under load. Cause, seen through DevTools: Chromium drops a `skipWaiting()` handover when the old worker, stopped to make way, is started again by a request from the page. The new build then waits until every tab closes, so real visitors could get a deploy a load late too. The page now asks a still-waiting build to take over every second (`retryWaitingActivation` in `src/ui/serviceWorker.ts`), and both `sw.ts` and the kill switch answer that message.
- ~~Copy strings not in `docs/COPY.md`.~~ Decided 2026-10-12: `toast.copyFailed` when copying fails, `entity.tip.scrub`/`entity.tip.keep` for the hover label, `entity.row` and friends for the screen-reader row label. Owner approved the drafts.
- ~~Repo URL.~~ Done 2026-10-12: the repo is public and `REPO_URL` is set, so "Github" in the credits links to it.
- ~~Mask dates?~~ Decided 2026-10-12: no "Dölj datum" option. Dates are often harmless and the AI needs them; *Egna ord* and selection cover the ones that are sensitive.
- Outlook messages whose only body is compressed RTF (`PR_RTF_COMPRESSED`) give the headers only. Decompressing it (MS-OXRTFCP) is about 80 lines; do it if users report it.
- `.doc`: deleted revisions are not detected (they need the character formatting tables), so their text comes along; table rows come out on one line.
- `.xlsx`: dates come out as Excel serial numbers (45943 rather than 2025-10-13). Dates are not masked, so this is about readability for the AI, not privacy.
