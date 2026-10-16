# Masking progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While the language model reads a long text, Skrubba shows how far it has come ("Letar efter namn och platser … 40 %", and "Skrubbar … 40 %" on the button), and pressing Skrubba reuses the background run instead of starting over.

**Architecture:** A pure splitter (`src/engine/parts.ts`) cuts the text into parts of at most 1 200 characters at paragraph, sentence or (with a 200-character overlap) word boundaries. `MaskeraMasker` keeps one model run for the latest text, sends the parts to the unchanged `NerBackend.detect` one by one, reports progress after each, lets later callers for the same text join the run, and stops a superseded run between parts. `App.tsx` turns the progress into a status line and a button label, shown only after 400 ms.

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly`), React 19, Vitest 5 (Node 26), Playwright (Chromium, Firefox, WebKit), maskera via the existing `NerBackend`.

**Spec:** `docs/superpowers/specs/2026-10-16-masking-progress-design.md`

## Global Constraints

- `PART_CHARS = 1200`, `OVERLAP_CHARS = 200`, `SHOW_AFTER_MS = 400` (verbatim from the spec).
- The worker protocol and `NerBackend` do not change. Nothing outside `src/engine/` imports maskera.
- The model run and its spans live only in memory; nothing is stored.
- A missed entity is worse than an over-masked one: a part boundary must never make the model miss a name it finds today.
- NER on 10 000 characters stays under 3 s (6 s on CI), `tests/e2e/perf.spec.ts`.
- New Swedish strings go into `docs/COPY.md` first (marked as drafts not yet reviewed by the owner), then `src/ui/copy.ts`; `src/ui/copy.test.ts` compares them. No colons or dashes in running text.
- CSS uses only existing classes and tokens; check light and dark.
- Commit messages: one plain sentence, ending with the attribution lines `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017Ncpxg7duTwu42iJV9xZ5G`.
- Branch `worktree-masking-progress`; never push to `main` without the owner saying so.

## Review Focus

1. **A transcript with no full stops at all** (the owner's case): every cut is a whitespace cut, so every boundary has an overlap, and names across those boundaries are still masked once, not twice and not half. Pinned in Task 1 (`parts.test.ts`), Task 2 (masker overlap test) and Task 3 (real model, run-on fixture).
2. **Editing a long text while the model is halfway**: the old run stops at the next part and its result never lands on the new text; the line follows the new text. Pinned in Task 2 (stale run test) and Task 4 (existing guard in `scrub`, plus the `scan.text === state.text` check).
3. **Pressing Skrubba, or Kopiera with the shortcut, before the background run has even started** (within the 300 ms debounce): Skrubba starts the run, the background effect joins it, and the model runs once. Pinned in Task 2 (join test) and Task 4 (e2e).
4. **The model failing mid-run** (worker error): the run is not cached, the rule marks stay, and the next attempt starts afresh. Pinned in Task 2.
5. **Ny text, Rensa allt or a new document during a run**: `reset()` drops the run, so nothing from the old text comes back. Pinned in Task 2.

---

### Task 1: The splitter

**Files:**
- Create: `src/engine/parts.ts`, `src/engine/parts.test.ts`

**Interfaces:**
- Produces: `PART_CHARS = 1200`, `OVERLAP_CHARS = 200`; `interface Part { start: number; end: number }`; `splitForModel(text: string): Part[]` (parts in order; `parts[0].start === 0`, last `end === text.length`; a part after a whitespace cut starts before the previous part's `end`, otherwise exactly at it).

- [ ] **Step 1: Write the failing tests**

Create `src/engine/parts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OVERLAP_CHARS, PART_CHARS, splitForModel } from "./parts.ts";

const words = (n: number) => "ord ".repeat(n);

describe("splitForModel", () => {
  it("gives one part for an empty or short text", () => {
    expect(splitForModel("")).toEqual([]);
    expect(splitForModel("Anna Berg ringde.")).toEqual([{ start: 0, end: 17 }]);
  });

  it("covers the whole text, in order, with no part over the limit", () => {
    const text = `${"Anna Berg ringde om avtalet. ".repeat(200)}\n\n${words(800)}`;
    const parts = splitForModel(text);
    expect(parts[0].start).toBe(0);
    expect(parts.at(-1)?.end).toBe(text.length);
    for (const [i, p] of parts.entries()) {
      expect(p.end - p.start).toBeLessThanOrEqual(PART_CHARS);
      if (i > 0) {
        expect(p.start).toBeLessThanOrEqual(parts[i - 1].end);
        expect(p.start).toBeGreaterThan(parts[i - 1].start);
      }
    }
  });

  it("prefers a paragraph break, then a sentence end", () => {
    const paragraph = `${"Ett stycke om avtalet. ".repeat(40)}\n\n${"Nästa stycke. ".repeat(80)}`;
    const first = splitForModel(paragraph)[0];
    expect(paragraph.slice(first.end - 2, first.end)).toBe("\n\n");

    const sentences = "Anna Berg ringde om avtalet igen. ".repeat(80);
    const cut = splitForModel(sentences)[0].end;
    expect(sentences.slice(cut - 2, cut)).toBe(". ");
    expect(splitForModel(sentences)[1].start).toBe(cut);
  });

  it("cuts a run without full stops between words, and overlaps the next part", () => {
    const text = words(1000);
    const [first, second] = splitForModel(text);
    expect(text[first.end - 1]).toBe(" ");
    expect(second.start).toBeLessThan(first.end);
    expect(first.end - second.start).toBeLessThanOrEqual(OVERLAP_CHARS);
    expect(text[second.start - 1]).toBe(" ");
  });

  it("never cuts inside a word", () => {
    const text = `${words(297)}Anna Berg ${words(400)}`;
    for (const p of splitForModel(text)) {
      expect(/\S/.test(text[p.start - 1] ?? " ") && /\S/.test(text[p.start])).toBe(false);
      expect(/\S/.test(text[p.end - 1]) && /\S/.test(text[p.end] ?? " ")).toBe(false);
    }
  });

  it("cuts a run with no whitespace at the limit, without overlap", () => {
    const text = "x".repeat(3000);
    expect(splitForModel(text)).toEqual([
      { start: 0, end: 1200 },
      { start: 1200, end: 2400 },
      { start: 2400, end: 3000 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/engine/parts.test.ts`
Expected: FAIL, `Cannot find module './parts.ts'`.

- [ ] **Step 3: Write the splitter**

Create `src/engine/parts.ts`:

```ts
// Long texts go to the model in parts, so the masker can say how far it has
// come. Parts stay below the length at which maskera splits on its own (480
// KB-BERT tokens), so the model sees the same kind of chunks as before. A
// part ends at a paragraph break, else a sentence end, else between words;
// a cut between words could split a name, so the next part then starts a
// little earlier and the overlap is read twice.

export const PART_CHARS = 1200;
export const OVERLAP_CHARS = 200;
/** A cut is looked for in the last 40 % of a part, so parts stay reasonably long. */
const SEARCH_FROM = Math.floor(PART_CHARS * 0.6);

export interface Part {
  start: number;
  end: number;
}

/** The end of the last match of `re` in `window` that ends at or after `from`, or -1. */
function lastEnd(window: string, re: RegExp, from: number): number {
  let end = -1;
  for (const m of window.matchAll(re)) {
    const e = (m.index ?? 0) + m[0].length;
    if (e >= from) end = e;
  }
  return end;
}

export function splitForModel(text: string): Part[] {
  const parts: Part[] = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= PART_CHARS) {
      parts.push({ start, end: text.length });
      break;
    }
    const window = text.slice(start, start + PART_CHARS);
    let cut = lastEnd(window, /\n\s*\n/g, SEARCH_FROM);
    if (cut < 0) cut = lastEnd(window, /[.!?]\s+/g, SEARCH_FROM);
    let overlap = false;
    if (cut < 0) {
      cut = lastEnd(window, /\s+/g, 1);
      overlap = cut > 0;
    }
    if (cut <= 0) cut = PART_CHARS;
    const end = start + cut;
    parts.push({ start, end });
    if (!overlap) {
      start = end;
      continue;
    }
    // Start the next part up to OVERLAP_CHARS earlier, at the start of a word.
    const from = Math.max(start + 1, end - OVERLAP_CHARS);
    const gap = text.slice(from, end).search(/\s\S/);
    start = gap >= 0 ? from + gap + 1 : end;
  }
  return parts;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/parts.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/parts.ts src/engine/parts.test.ts
git commit -m "Split long texts into parts for the model at paragraph, sentence or word boundaries"
```
(with the attribution lines from Global Constraints)

---

### Task 2: The masker runs the model in parts, reports progress, and reuses the run

**Files:**
- Modify: `src/engine/Masker.ts` (the `mask` signature and a `MaskOptions` type), `src/engine/maskeraMasker.ts`
- Test: `src/engine/maskeraMasker.test.ts`

**Interfaces:**
- Consumes: `splitForModel`, `Part` (Task 1); `NerBackend.detect(text): Promise<Span[]>` (unchanged).
- Produces:
  - `interface MaskOptions { onProgress?(done: number, total: number): void }` exported from `Masker.ts`.
  - `Masker.mask(text: string, input: MaskInput, opts?: MaskOptions): Promise<Entity[]>`. `done` and `total` are characters; `onProgress` is called at once with the run's current progress, then after each part. A superseded run rejects with a `DOMException` named `AbortError`.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/maskeraMasker.test.ts`:

```ts
// Stands in for the model and records every call, so a test can count runs.
function countingNer(marks: Array<[string, EntityType]>) {
  const calls: string[] = [];
  let failNext = false;
  const backend: NerBackend = {
    init: async () => {},
    detect: async (text) => {
      calls.push(text);
      await new Promise((r) => setTimeout(r, 1));
      if (failNext) {
        failNext = false;
        throw new Error("worker died");
      }
      return fakeNer(marks).detect(text);
    },
  };
  return { backend, calls, failOnce: () => (failNext = true) };
}

const longText = (n: number) => "Anna Berg ringde om avtalet. ".repeat(n);

describe("MaskeraMasker.mask on a long text", () => {
  it("sends the text in parts and reports progress up to the whole text", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = longText(150);
    const seen: number[] = [];
    const entities = await masker.mask(text, none, { onProgress: (done, total) => seen.push(done / total) });
    expect(calls.length).toBeGreaterThan(2);
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(entities.find((e) => e.value === "Anna Berg")?.occurrences).toHaveLength(150);
  });

  it("finds a name that a cut between words splits, once", async () => {
    const { backend } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = `${"ord ".repeat(298)}Anna Berg ${"ord ".repeat(400)}`;
    const entities = await masker.mask(text, none);
    expect(entities.map((e) => e.value)).toEqual(["Anna Berg"]);
    expect(entities[0].occurrences).toHaveLength(1);
  });

  it("runs the model once for the same text, during and after the run", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const text = longText(150);
    const first = masker.mask(text, none);
    const joined: number[] = [];
    const second = masker.mask(text, none, { onProgress: (done) => joined.push(done) });
    await Promise.all([first, second]);
    const after = calls.length;
    await masker.mask(text, { wordList: ["avtalet"], manual: [] });
    expect(calls.length).toBe(after);
    expect(joined.length).toBeGreaterThan(1);
    expect(joined[0]).toBe(0);
  });

  it("stops a run when a different text comes, and rejects it", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    const old = masker.mask(longText(150), none);
    await new Promise((r) => setTimeout(r, 2));
    const fresh = masker.mask("Erik Holm ringde.", none);
    await expect(old).rejects.toMatchObject({ name: "AbortError" });
    await fresh;
    expect(calls.filter((c) => c.startsWith("Anna")).length).toBeLessThan(splitCount(longText(150)));
  });

  it("does not keep a run that failed, so the next call tries again", async () => {
    const { backend, calls, failOnce } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    failOnce();
    await expect(masker.mask("Anna Berg ringde.", none)).rejects.toThrow("worker died");
    const entities = await masker.mask("Anna Berg ringde.", none);
    expect(entities.map((e) => e.value)).toEqual(["Anna Berg"]);
    expect(calls).toHaveLength(2);
  });

  it("drops the run on reset, so the next call runs the model again", async () => {
    const { backend, calls } = countingNer([["Anna Berg", "NAMN"]]);
    const masker = new MaskeraMasker(backend);
    await masker.mask("Anna Berg ringde.", none);
    masker.reset();
    await masker.mask("Anna Berg ringde.", none);
    expect(calls).toHaveLength(2);
  });
});
```

Add at the top of the file, after the existing imports: `import { splitForModel } from "./parts.ts";` and, after `none`, the helper:

```ts
const splitCount = (text: string) => splitForModel(text).length;
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/engine/maskeraMasker.test.ts`
Expected: three FAIL and three PASS.
- FAIL: "sends the text in parts" (one call, no progress), "runs the model once" (a second run is made), "stops a run" (the old run resolves instead of rejecting).
- PASS today, and they must still pass after Step 4: "finds a name that a cut between words splits" (today the whole text goes in one call; after splitting it holds only thanks to the overlap), "does not keep a run that failed" and "drops the run on reset" (today nothing is kept at all). They guard what the new code must not break.

- [ ] **Step 3: Add MaskOptions to the interface**

In `src/engine/Masker.ts`, above `export interface Masker`, add:

```ts
export interface MaskOptions {
  /**
   * How far the model has read, in characters. Called at once with the run's
   * current progress, then after each part. A caller that joins a run already
   * under way gets its progress from there on.
   */
  onProgress?(done: number, total: number): void;
}
```

and change the `mask` line in `Masker` to:

```ts
  /**
   * maskRules plus NER, merged. The model runs once per text: a call for the
   * same text joins the run, and a call for a new text stops the old run,
   * whose promise then rejects with an AbortError.
   */
  mask(text: string, input: MaskInput, opts?: MaskOptions): Promise<Entity[]>;
```

- [ ] **Step 4: Run the model in parts in the masker**

In `src/engine/maskeraMasker.ts`:

1. Add `MaskOptions` to the type import from `./Masker.ts`, and add `import { splitForModel } from "./parts.ts";`.
2. Above the class, add:

```ts
/** The model's reading of one text: shared by every caller for that text. */
interface ModelRun {
  text: string;
  done: number;
  stale: boolean;
  listeners: Set<(done: number, total: number) => void>;
  spans: Promise<Span[]>;
}

/** Spans from overlapping parts: each once, and none inside another. */
function mergeModelSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s.start >= last.start && s.end <= last.end) continue;
    out.push(s);
  }
  return out;
}
```

3. In the class, add the field `private run: ModelRun | null = null;` and replace `mask` with:

```ts
  async mask(text: string, input: MaskInput, opts: MaskOptions = {}): Promise<Entity[]> {
    const run = this.modelRun(text);
    const { onProgress } = opts;
    if (onProgress) {
      onProgress(run.done, text.length);
      run.listeners.add(onProgress);
    }
    try {
      return this.entities(text, input, await run.spans);
    } finally {
      if (onProgress) run.listeners.delete(onProgress);
    }
  }

  private modelRun(text: string): ModelRun {
    if (this.run?.text === text) return this.run;
    this.dropRun();
    const run: ModelRun = { text, done: 0, stale: false, listeners: new Set(), spans: Promise.resolve([]) };
    run.spans = this.readInParts(run);
    // A failed run is not kept, so the next call tries again.
    run.spans.catch(() => {
      if (this.run === run) this.run = null;
    });
    this.run = run;
    return run;
  }

  private async readInParts(run: ModelRun): Promise<Span[]> {
    const spans: Span[] = [];
    for (const part of splitForModel(run.text)) {
      if (run.stale) throw new DOMException("A newer text replaced this one", "AbortError");
      for (const s of await this.ner.detect(run.text.slice(part.start, part.end))) {
        spans.push({ ...s, start: s.start + part.start, end: s.end + part.start });
      }
      run.done = Math.max(run.done, part.end);
      for (const listener of run.listeners) listener(run.done, run.text.length);
    }
    return mergeModelSpans(spans);
  }

  private dropRun(): void {
    if (this.run) this.run.stale = true;
    this.run = null;
  }
```

4. In `reset()` and `loadKey()`, add `this.dropRun();` as the first line.

Run: `npm run typecheck`
Expected: passes. (`App.tsx` calls `mask(text, input)`, which still type-checks.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/engine`
Expected: PASS, the existing masker tests included.

- [ ] **Step 6: Commit**

```bash
git add src/engine
git commit -m "Run the model in parts with progress, once per text, and stop a run the text has outgrown"
```

---

### Task 3: The real model on long and run-on texts, and the perf budget

**Files:**
- Modify: `src/engine/longtext.model.test.ts`

**Interfaces:**
- Consumes: `MaskeraMasker` with the real `backend` from `./modelForTests.ts` (existing).

- [ ] **Step 1: Make sure the model is there**

Run: `npm run fetch-model`
Expected: the model is in `.cache/model-src/` (downloads about 50 MB the first time in this worktree).

- [ ] **Step 2: Add a run-on transcript test**

In `src/engine/longtext.model.test.ts`, add after `longText()`:

```ts
// Transcribed speech: no full stops, so every part ends between words and
// overlaps the next. One full name every few words, until 6 000 characters.
function runOnText(): { text: string; names: string[] } {
  const names: string[] = [];
  let text = "";
  for (let i = 0; text.length < 6_000; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    names.push(name);
    text += `och sen sa ${name} att vi skulle ta det på mötet med ekonomin `;
  }
  return { text, names: [...new Set(names)] };
}
```

and inside the `describe`, after the existing "masks every name" test:

```ts
  it("masks every name in a transcript without full stops, where every part ends between words", async () => {
    const { text, names } = runOnText();
    const masker = new MaskeraMasker(backend);
    const entities = await masker.mask(text, { wordList: [], manual: [] });
    const { masked } = masker.applyMask(text, entities, []);
    const leaked = names.filter((n) => masked.includes(n.split(" ")[1]));
    expect(leaked).toEqual([]);
  }, 120_000);
```

- [ ] **Step 3: Run the model tests**

Run: `npx vitest run src/engine/longtext.model.test.ts`
Expected: PASS, both "masks every name" tests. If a surname leaks at a boundary, print the parts around it (`splitForModel(text)`), and fix the splitter or the overlap, not the test.

- [ ] **Step 4: Commit**

```bash
git add src/engine/longtext.model.test.ts
git commit -m "Model test: every name masked in a run-on transcript split between words"
```

---

### Task 4: The UI: status line, button label, and the copy

**Files:**
- Modify: `docs/COPY.md`, `src/ui/copy.ts`, `src/ui/App.tsx`
- Create: `src/ui/useShownAfter.ts`, `tests/e2e/progress.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: `Masker.mask(text, input, { onProgress })` (Task 2).
- Produces: copy keys `status.scanning` (`{pct}`), `status.scanningStart`, `action.scrubbing` (`{pct}`); `useShownAfter(active: boolean, ms: number): boolean`; CSS class `scan-progress` on the line (uses `.notice` styling).

- [ ] **Step 1: The copy**

In `docs/COPY.md`, in the "Fasta strängar" table after the `status.trust` row, add:

```
| status.scanning | Letar efter namn och platser … {pct} % |
| status.scanningStart | Letar efter namn och platser |
| action.scrubbing | Skrubbar … {pct} % |
```

At the end of "## Ändringar", add:

```
**Utkast 2026-10-16, inte granskade av ägaren än.** Medan språkmodellen läser en lång text visas hur långt den har kommit.

- `status.scanning`: raden under Din text medan modellen läser, till exempel "Letar efter namn och platser … 40 %". Visas bara om det tar mer än en halv sekund.
- `status.scanningStart`: det skärmläsare hör när en sådan läsning börjar. När den är klar hör de antalet uppgifter (`panel.count`).
- `action.scrubbing`: knappen Skrubba medan den väntar på modellen, till exempel "Skrubbar … 40 %".
```

In `src/ui/copy.ts`, after `"status.trust"`, add:

```ts
  "status.scanning": "Letar efter namn och platser … {pct} %",
  "status.scanningStart": "Letar efter namn och platser",
  "action.scrubbing": "Skrubbar … {pct} %",
```

Run: `npx vitest run src/ui/copy.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing browser tests**

Create `tests/e2e/progress.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { editor, openReady, rows, runButton, scrubbedBox } from "./helpers.ts";

const FIRST = ["Anna", "Erik", "Sara", "Johan", "Maria", "Lars", "Karin", "Nils"];
const LAST = ["Berg", "Lindqvist", "Holm", "Ekström", "Sundberg", "Nyberg", "Wallin", "Strand"];

// Long enough that the model takes well over half a second in every engine.
function longText(chars = 40_000): string {
  let text = "";
  for (let i = 0; text.length < chars; i++) text += `och sen sa ${FIRST[i % 8]} ${LAST[(i * 3) % 8]} att vi skulle ta det på mötet `;
  return text;
}

const scanLine = (page: import("@playwright/test").Page) => page.locator(".scan-progress");
const pct = async (page: import("@playwright/test").Page) => Number(/(\d+) %/.exec((await scanLine(page).textContent()) ?? "")?.[1] ?? -1);

test("a long text shows how far the model has read, then the names", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toHaveText(/^Letar efter namn och platser … \d+ %$/, { timeout: 10_000 });
  const first = await pct(page);
  await expect.poll(() => pct(page), { timeout: 60_000 }).toBeGreaterThan(first);
  await expect(scanLine(page)).toHaveCount(0, { timeout: 120_000 });
  await expect(rows(page).filter({ hasText: "Anna Berg" })).toContainText("Namn");
});

test("Skrubba during the run shows its progress and then the result", async ({ page }) => {
  await openReady(page);
  await editor(page).fill(longText());
  await expect(scanLine(page)).toBeVisible({ timeout: 10_000 });
  await runButton(page).click();
  await expect(runButton(page)).toHaveText(/^Skrubbar … \d+ %/);
  await expect(runButton(page)).toBeDisabled();
  await expect(scrubbedBox(page)).not.toHaveValue("", { timeout: 120_000 });
  await expect(runButton(page)).toHaveText(/^Skrubba/);
  await expect(scrubbedBox(page)).not.toHaveValue(/Anna Berg/);
});

test("a short text shows neither", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Anna Berg ringde om avtalet.");
  await runButton(page).click();
  await expect(scrubbedBox(page)).not.toHaveValue("");
  await page.waitForTimeout(800);
  await expect(scanLine(page)).toHaveCount(0);
  await expect(runButton(page)).toHaveText(/^Skrubba/);
});
```

Run: `npx playwright test tests/e2e/progress.spec.ts --project=chromium`
Expected: FAIL on the first two tests (no `.scan-progress`, no "Skrubbar"); the third passes.

- [ ] **Step 3: The delay hook**

Create `src/ui/useShownAfter.ts`:

```ts
import { useEffect, useState } from "react";

/** True once `active` has stayed true for `ms`, false again at once when it is not. */
export function useShownAfter(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && shown;
}
```

- [ ] **Step 4: Wire it into App.tsx**

In `src/ui/App.tsx`:

1. Add `import { useShownAfter } from "./useShownAfter.ts";`, and below `const DEBOUNCE_MS = 300;` add `const SHOW_AFTER_MS = 400;`.
2. Next to the other `useState` calls, add:

```ts
  // How far the model has read the current text, and whether Skrubba is waiting for it.
  const [scan, setScan] = useState<{ text: string; pct: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scanning = scan !== null && scan.text === state.text;
  const showScan = useShownAfter(scanning, SHOW_AFTER_MS);
  const [announcedScan, setAnnouncedScan] = useState(false);
  useEffect(() => {
    if (showScan) setAnnouncedScan(true);
  }, [showScan]);
```

3. Add this helper inside the component, above the debounced masking effect:

```ts
  /** Progress for a model run on `text`: starts the line at 0 % and only ever moves it forward. */
  const trackScan = useCallback((text: string) => {
    setScan((s) => (s?.text === text ? s : { text, pct: 0 }));
    return (done: number, total: number) => {
      const pct = total ? Math.floor((done / total) * 100) : 100;
      setScan((s) => (s?.text === text ? { text, pct: Math.max(s.pct, pct) } : s));
    };
  }, []);
  const endScan = useCallback((text: string) => setScan((s) => (s?.text === text ? null : s)), []);
```

4. In the debounced masking effect, replace

```ts
        masker.mask(text, input).then(
          (entities) => dispatch({ type: "setEntities", text, entities }),
          () => {}, // a failed NER run keeps the rule entities on screen
        );
```

with

```ts
        masker
          .mask(text, input, { onProgress: trackScan(text) })
          .then(
            (entities) => dispatch({ type: "setEntities", text, entities }),
            () => {}, // a failed or outgrown NER run keeps the rule entities on screen
          )
          .finally(() => endScan(text));
```

and add `trackScan, endScan` to that effect's dependency array.

5. In `scrub`, replace

```ts
    const entities = s.model.status === "ready" ? await masker.mask(s.text, input) : masker.maskRules(s.text, input);
```

with

```ts
    let entities: Entity[];
    if (s.model.status === "ready") {
      setScrubbing(true);
      try {
        entities = await masker.mask(s.text, input, { onProgress: trackScan(s.text) });
      } catch {
        return null; // the text changed and its run was stopped, or the model failed
      } finally {
        setScrubbing(false);
        endScan(s.text);
      }
    } else entities = masker.maskRules(s.text, input);
```

add `type Entity` to the import from `../engine/index.ts` (it is exported as a type there), and add `trackScan, endScan` to `scrub`'s dependency array.

6. Right after `<ModelStatus model={state.model} />`, add:

```tsx
          {mode === "scrub" && showScan && (
            <p className="notice scan-progress" aria-hidden="true">
              {t("status.scanning", { pct: scan?.pct ?? 0 })}
            </p>
          )}
          <p className="sr-only" role="status">
            {showScan ? t("status.scanningStart") : announcedScan ? countLabel(entities.length) : ""}
          </p>
```

7. On the run button, change `disabled={…}` to

```tsx
            disabled={mode === "scrub" ? state.model.status === "loading" || !state.text || scrubbing : !state.answer}
```

and its label line to

```tsx
            {mode === "scrub" ? (scrubbing && showScan ? t("action.scrubbing", { pct: scan?.pct ?? 0 }) : t("action.scrub")) : t("action.restore")}
```

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Run the browser tests**

Run: `npx playwright test tests/e2e/progress.spec.ts tests/e2e/flow.spec.ts tests/e2e/newtext.spec.ts`
Expected: PASS in Chromium, Firefox and WebKit. If the first test finishes before the line is seen in Chromium, raise `longText` to 80 000 characters rather than shortening `SHOW_AFTER_MS`.

- [ ] **Step 6: Accessibility while the line shows**

In `tests/e2e/a11y.spec.ts` (which already imports `editor` and `openReady` from `./helpers.ts`), inside `test.describe(scheme, …)`, add:

```ts
      test("while the model reads a long text", async ({ page }) => {
        await openReady(page);
        await editor(page).fill("och sen sa Anna Berg att vi skulle ta det på mötet ".repeat(800));
        await expect(page.locator(".scan-progress")).toBeVisible({ timeout: 10_000 });
        expect(await violations(page)).toEqual([]);
      });
```

Run: `npx playwright test tests/e2e/a11y.spec.ts -g "long text"`
Expected: PASS in light and dark.

- [ ] **Step 7: Look at it in light and dark**

Build and serve (`npm run build && npx vite preview --port 4175`), paste a 40 000-character text, and screenshot the page in light and dark at 1280 px and 360 px while the line shows and while Skrubba says "Skrubbar … N %". Check the button keeps its width and the line uses the notice colour. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add docs/COPY.md src/ui tests/e2e
git commit -m "Show how far the model has read a long text, under Din text and on the Skrubba button"
```

---

### Task 5: Docs, perf and the full run

**Files:**
- Modify: `docs/ARCHITECTURE.md` ("Long texts", the `Masker` interface section if it lists `mask`), `docs/UX.md`, `CHANGELOG.md`

- [ ] **Step 1: ARCHITECTURE.md**

Replace the "## Long texts" paragraph with:

```markdown
## Long texts

KB-BERT takes at most 512 tokens. The masker sends the model the text in parts (`src/engine/parts.ts`): at most 1 200 characters each, below the 480 tokens at which maskera would split on its own. A part ends at a paragraph break, else a sentence end, else between words; after a cut between words the next part starts up to 200 characters earlier, so a name across the cut is read whole, and model spans inside another are dropped when the parts are merged. Name spreading then runs over the whole text as before. Owner's decision, 2026-10-16 (spec: `docs/superpowers/specs/2026-10-16-masking-progress-design.md`).

The masker keeps one model run, for the latest text, in memory: a call for the same text joins it (Skrubba and Kopiera reuse the background run), a call for another text stops the old run at its next part (its promise rejects with an `AbortError`), and `reset()` and `loadKey()` drop it. Progress is reported in characters after each part (`MaskOptions.onProgress`); the UI shows it after 400 ms as `status.scanning` under Din text and `action.scrubbing` on the button.
```

- [ ] **Step 2: UX.md**

After the paragraph on Ny text (or with the other status lines), add:

```markdown
**Reading a long text.** While the language model reads the text, the line under Din text says "Letar efter namn och platser … 40 %", and the Skrubba button, if pressed, says "Skrubbar … 40 %" and waits. Both appear only when a run takes more than 0.4 s, so short texts look as before. Screen readers hear "Letar efter namn och platser" when it starts and the item count when it is done. Skrubba reuses the reading already under way, and editing the text stops it. Owner's request, 2026-10-16.
```

- [ ] **Step 3: CHANGELOG.md**

Under `## [Unreleased]`, add:

```markdown
### Added

- **Progress on long texts.** While the language model reads a long text, *Letar efter namn och platser … 40 %* shows under the text, and *Skrubba* shows *Skrubbar … 40 %* while it waits, so it is clear the work goes on.

### Changed

- **Skrubba is faster on long texts.** It reuses the reading the model already did after the paste instead of starting over, and editing the text stops a reading that is no longer needed.
```

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npx vitest run && npx playwright test`
Expected: all pass; `perf.spec.ts` included (10 000 characters within budget). Paste the summary lines into the PR description.

- [ ] **Step 5: Commit, push the branch, open a draft PR**

```bash
git add docs CHANGELOG.md
git commit -m "Docs for progress on long texts"
git push
gh pr create --draft --base main --title "Show progress while the model reads a long text" --body-file <file>
```

The PR body lists what changed, the test summary, the three draft strings for the owner's review, and ends with the Claude Code line from the attribution rules.
