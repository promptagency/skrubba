import { applyMask } from "./applyMask.ts";
import { buildEntities, EntityRegistry } from "./entities.ts";
import type { Entity, InitOptions, Key, Masker, MaskInput, MaskOptions, Progress, RestoreResult, Span } from "./Masker.ts";
import type { NerBackend } from "./ner.ts";
import { splitForModel } from "./parts.ts";
import { ruleSpans } from "./rules.ts";
import { resolveSpans, spreadModelValues } from "./spans.ts";
import { tolerantRestore } from "./tolerantRestore.ts";
import { findTerms } from "./wordList.ts";

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

export class MaskeraMasker implements Masker {
  private registry = new EntityRegistry();
  private readonly ner: NerBackend;
  private run: ModelRun | null = null;

  constructor(ner: NerBackend) {
    this.ner = ner;
  }

  init(onProgress: (p: Progress) => void, options?: InitOptions): Promise<void> {
    return this.ner.init(onProgress, options);
  }

  maskRules(text: string, input: MaskInput): Entity[] {
    return this.entities(text, input, []);
  }

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

  applyMask(text: string, entities: Entity[], wordList: string[]): { masked: string; key: Key } {
    return applyMask(text, entities, wordList);
  }

  loadKey(key: Key): void {
    this.dropRun();
    this.registry = new EntityRegistry();
    this.registry.seed(key.entries);
  }

  reset(): void {
    this.dropRun();
    this.registry = new EntityRegistry();
  }

  restore(text: string, key: Key, accepted?: ReadonlySet<string>): RestoreResult {
    return tolerantRestore(text, key, accepted);
  }

  private entities(text: string, input: MaskInput, modelSpans: Span[]): Entity[] {
    const spans = [
      ...findTerms(text, input.manual, "manual"),
      ...findTerms(text, input.wordList, "wordlist"),
      ...ruleSpans(text),
      ...modelSpans,
    ];
    const spread = spreadModelValues(text, resolveSpans(text, spans));
    return buildEntities(text, resolveSpans(text, [...spans, ...spread]), this.registry);
  }
}
