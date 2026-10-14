# CLAUDE.md

Product name: **Skrubba**. Free, open source (MIT), launched at `skrubba.promptagency.se`. Name and URL live in `src/config.ts` only.

## What this is

A static web app that makes Swedish text safe to paste into an LLM, entirely in the browser. It replaces personal data (names, personnummer, addresses, phone numbers, …) and confidential terms (client names, project names, unreleased products) with stable placeholders, and swaps the real values back into the LLM's answer afterwards. Nothing leaves the user's device.

Engine: the open source `maskera` library (MIT) with its 43 MB Swedish NER model, wrapped behind our own thin interface so it can be swapped.

## Audience

People who work with other people's personal data or confidential material and want to use AI tools without leaking it. Two overlapping groups:

1. **Other people's personal data**: HR, recruiters, finance, customer service, healthcare admin. What the NER model and rules are good at.
2. **Other people's secrets**: agencies, consultants, sales, freelancers. Client names, campaign names, numbers, unreleased products. What organisation masking, manual masking and the word list are for.

Both must feel equally easy. Sector does not matter; an HR person at an ad agency is in both groups at once. Public sector staff are welcome but are not the design target (they are usually blocked by IT policy, not by the tool). See `docs/COPY.md` for tone.

## Read before coding

1. `PLAN.md` – phases and definition of done
2. `docs/UX.md` – the one-screen flow, states, keyboard shortcuts
3. `docs/ARCHITECTURE.md` – module boundaries, worker, privacy constraints
4. `docs/COPY.md` – Swedish copy rules and the exact strings
5. maskera docs: https://github.com/joelhagvall/maskera (README, `docs/PRODUCTION.md` for self-hosting the model). Fetch them; do not guess the API.

## Hard rules (privacy)

- **The browser talks to our own origin only.** After first load, the only requests are our self-hosted model/runtime files and one anonymous page view per load to `/api/event`, which a Cloudflare Function (`functions/api/event.ts`) passes on to Prompt Agency's self-hosted Plausible (owner's decision, 2026-10-12). It carries the page address (utm_* only), the referrer's origin and path and the site name, never text, entities, word list or key, and is skipped for Do Not Track, Global Privacy Control and automated browsers. No other analytics, no CDN fonts, no error reporting. Enforce with a strict CSP (`connect-src 'self'`) and verify in a test that lists every request.
- Text, entities, word list and the restore key live **only in memory**. Never `localStorage`, `sessionStorage`, IndexedDB, cookies or URL params. The only persistence is an explicit user-triggered download.
- Model weights and the ONNX/WASM runtime are served from **our own origin** (`/models/`, `/runtime/`).
- All inference runs in a **Web Worker**, and so does reading a document (a fresh worker per file, terminated after it). The main thread never blocks.
- A missed entity is worse than an over-masked one. When in doubt, mask and let the user keep.
- Organisations are masked **by default**. The user can keep them per entity.

## Stack

- Vite + React + TypeScript, no UI framework, plain CSS with custom properties. Minimal, audited dependencies.
- `maskera` + `@huggingface/transformers`. Rules-only (`@maskera/core`) runs instantly; the NER model loads in the background.
- `pdfjs-dist` (exact version, nothing fetched) for PDF, in a worker of its own inside the reader worker. Every other document format is read by our own code in `src/reader/`.
- PWA (service worker) so the app works offline after first visit.
- Deploy: static build to Cloudflare Pages at `skrubba.promptagency.se`.
- Tests: Vitest for logic, Playwright for the mask/restore round trip and the "no external requests" check.

## Conventions

- Code, commits and docs under `docs/` except `COPY.md`: English. UI: Swedish, per `docs/COPY.md`.
- Engine behind `src/engine/` with a single interface (`Masker`). Nothing outside imports `maskera` directly.
- Document reading behind `src/reader/` with a single entry, `readDocument`. Nothing outside imports pdf.js or a format reader. Every dropped or chosen file goes through the window Läs in dokument; only text comes out. In Skrubba a document starts a new kodnyckel, as Ny text does.
- Placeholders follow maskera's format `[NAMN_1]`, `[PLATS_1]`, `[ORGANISATION_1]`, `[ADRESS_1]`, `[PERSONNUMMER_1]`; manual and word-list entries use `[ORD_1]`; a first name standing alone for a full name uses `[FÖRNAMN_1]`, numbered like that name's `[NAMN_1]`. Restore must be tolerant (see `docs/ARCHITECTURE.md`).
- One page, two operations picked with a switch: Skrubba (mask) and Avskrubba (restore). Input on the left, the button between the panes runs it, the result on the right, then Kopiera. The items found (Uppgifter), the kodnyckel (placeholder → real value list, not an encryption key), Vanliga frågor and Så här funkar det (a captioned video, re-recorded with `npm run demo-video` after visible changes) are windows on top. No wizard. See `docs/UX.md`.
- Commit small, one feature per commit, with the test that proves it.

## Out of scope for v1

Saving a scrubbed document back as Word or PDF (documents are read as text only; see `docs/superpowers/specs/2026-10-14-document-import-design.md`), OCR of scanned PDFs, history of texts, fake replacement names, role profiles, saved cases, accounts, browser extension. Do not build toward them unless `PLAN.md` says so.

## When unsure

Add a note under "Open questions" in `PLAN.md` rather than guessing on anything that touches privacy, copy or restore logic.

## Design

- The visual identity is defined in `design/DESIGN.md`. Read it before any change to the interface.
- Colours, fonts, spacing and radii come from `design/tokens.css`. Never write a hex value, an `rgb()` value or a font name in component CSS. Use the variables.
- Both themes must work. Check every interface change in light and in dark.
- Masking colours follow `typeGroup()` in `src/ui/copy.ts`. Fill is `--mask-<group>`, outline on a kept item and the list dot are `--mask-<group>-stark`. Colour is never the only cue, the type name is always shown in text.
- The logo files in `design/logo/` are used as they are. Never retype, recolour or redraw the logo.
- `design/reference/` is illustration, not source. The copy and the key format shown there are placeholders.
- Fonts are served from the repo. Never add a font CDN or any other third-party request for styling.
- If a design decision is not covered by `DESIGN.md`, ask instead of inventing one.

