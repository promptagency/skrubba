# Masking progress: design

Date: 2026-10-16. Status: approved in conversation, awaiting review of this spec.

## Problem

Working with a long transcribed text, the owner had no idea whether Skrubba was still working. Today:

- After a paste, the rule marks appear at once, then the language model runs over the whole text in the background with nothing on screen. On a long text that takes a while: about 1.4 s per 10 000 characters in Chromium with threads, slower in Firefox and WebKit.
- Pressing Skrubba runs the model again from the start on the same text (`scrub` in `src/ui/App.tsx` calls `masker.mask` afresh), even when the background run has just finished or is halfway. The button gives no sign of work. On a long text the user waits twice, in silence.
- maskera reports progress only while the model downloads (`NerOptions.onProgress`), not while it analyses text. It splits text over 480 tokens internally and returns only at the end.

## Decisions (owner, 2026-10-16)

1. **A percentage**, not just a busy indicator: the text is split into parts and progress is reported after each part.
2. Skrubba **reuses** the background model run instead of starting over, and shows progress while it waits.
3. The new strings go into `docs/COPY.md` as marked drafts for the owner's review.

## Design

### Splitting (new `src/engine/parts.ts`)

`splitForModel(text: string): Array<{ start: number; end: number }>` covers the whole text with consecutive parts of at most `PART_CHARS = 1200` characters. That is below the length at which maskera splits on its own (480 KB-BERT tokens, roughly 1 600 to 1 900 characters of Swedish), so each part is one model call and the model sees the same kind of chunks as today. The number is a constant, settled with the perf test.

Where a part ends, in order of preference:

1. The last paragraph break (`\n\n`) in the last 40 % of the window.
2. Otherwise the last sentence end (`.`, `!` or `?` followed by whitespace) in the last 40 % of the window.
3. Otherwise the last whitespace in the window. A cut here could split a name ("Anna | Berg"), which the model would then miss. So when a part ends this way, the next part starts `OVERLAP_CHARS = 200` characters earlier and the model spans of the two parts are merged. Transcribed speech often has long stretches without full stops, which is exactly the owner's case.
4. A run of more than 1 200 characters with no whitespace is cut hard; no name is that long.

Spans from each part are offset by the part's `start`. Overlapping spans from the overlap are merged: identical spans are kept once, and the existing `resolveSpans` handles the rest, as it does today for rule and model spans. Name spreading (`spreadModelValues`) still runs over the whole text afterwards, unchanged.

### The masker (`src/engine/maskeraMasker.ts`, `src/engine/Masker.ts`)

- `mask(text, input, opts?: { onProgress?(done: number, total: number): void })`. `done` and `total` are characters (the end of the last finished part, and `text.length`), so the percentage reflects text read, not parts counted.
- The masker keeps **one model run**, for the latest text: `{ text, done, total, listeners, spans: Promise<Span[]> }`, in memory only, like the text itself.
  - `mask` for the same text joins that run, whether it is in flight or finished. A caller that joins mid-run gets the current progress at once, then every update. When it has finished, the result is immediate.
  - `mask` for a different text starts a new run and marks the old one stale. The old run stops before its next part, and its promise is rejected with an `AbortError`, which the callers already ignore.
  - The word list and selected words are applied after the model (`entities()`), so changing them reuses the run.
  - `reset()` (Ny text, Rensa allt, a new document) and `loadKey` drop the run.
- `NerBackend.detect` is unchanged: the masker calls it once per part. The worker protocol does not change.

### The UI

- **Under Din text,** in the space where the rules-only notice appears today: `status.scanning`, "Letar efter namn och platser … 40 %", while the model runs on the current text. It goes away when the run finishes or the text changes. It is shown only when a run has gone on for more than `SHOW_AFTER_MS = 400` ms, so short texts look as they do now.
- **The Skrubba button,** while `scrub` waits for the model: disabled, with `action.scrubbing`, "Skrubbar … 40 %", as its label, after the same 400 ms. If the background run already finished, Skrubba is immediate and shows nothing new.
- **Screen readers:** a polite live region says `status.scanningStart` ("Letar efter namn och platser") once when a shown run starts, and the existing item count (for example "13 uppgifter") when it ends. Not every percent.
- The percentage is `Math.floor(done / total * 100)` and never goes down within a run.
- Styling: the line uses the existing `.notice` look; the button keeps its size so the layout does not jump. Colours, spacing and type come from the existing tokens only. Checked in light and dark.
- Avskrubba, restore and the model download (Gate) are unchanged.

### Copy (drafts in `docs/COPY.md`, marked as not yet reviewed)

| Key | Draft |
|---|---|
| status.scanning | Letar efter namn och platser … {pct} % |
| status.scanningStart | Letar efter namn och platser |
| action.scrubbing | Skrubbar … {pct} % |

## Testing

- **`parts.test.ts`:** parts cover the text with no gaps; no part is over 1 200 characters; a paragraph break is preferred over a sentence end, and a sentence end over whitespace; a cut is never inside a word; the overlap follows only a whitespace cut; a 3 000-character run without whitespace is cut hard; empty and short texts give one part.
- **Masker, with a fake backend that records calls:** a long text is sent in parts and progress rises to `total`; `mask` twice on the same text makes one set of calls (in flight and after); a different text makes the old run stop between parts and reject; changing the word list makes no new calls; `reset` drops the run.
- **Real model** (`longtext.model.test.ts`, extended): on the 10 000-character fixture, every name is still masked; on a transcript-like fixture without full stops, with names placed where whitespace cuts fall, every name is still masked.
- **Perf** (`perf.spec.ts`): NER on 10 000 characters stays within the 3 s budget with the parts.
- **Browser** (`tests/e2e`): pasting a long text shows "Letar efter namn och platser … N %" with N rising, then the line goes away and the names are marked. Pressing Skrubba mid-run shows "Skrubbar … N %" and then the result, and the model ran once. A short text shows neither. axe on the page while the line shows, light and dark.

## Out of scope

- Showing model marks part by part as they finish. The marks appear when the run ends, as today.
- A cancel button. Editing the text already stops a stale run.
- Progress for rules, restore or reading documents (each is fast, or has its own window).
