import { applyMask } from "./applyMask.ts";
import { buildEntities, EntityRegistry } from "./entities.ts";
import type { Entity, Key, Masker, MaskInput, Progress, RestoreResult, Span } from "./Masker.ts";
import type { NerBackend } from "./ner.ts";
import { ruleSpans } from "./rules.ts";
import { resolveSpans } from "./spans.ts";
import { tolerantRestore } from "./tolerantRestore.ts";
import { findTerms } from "./wordList.ts";

export class MaskeraMasker implements Masker {
  private readonly registry = new EntityRegistry();
  private readonly ner: NerBackend;

  constructor(ner: NerBackend) {
    this.ner = ner;
  }

  init(onProgress: (p: Progress) => void): Promise<void> {
    return this.ner.init(onProgress);
  }

  maskRules(text: string, input: MaskInput): Entity[] {
    return this.entities(text, input, []);
  }

  async mask(text: string, input: MaskInput): Promise<Entity[]> {
    return this.entities(text, input, await this.ner.detect(text));
  }

  applyMask(text: string, entities: Entity[], wordList: string[]): { masked: string; key: Key } {
    return applyMask(text, entities, wordList);
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
    return buildEntities(text, resolveSpans(text, spans), this.registry);
  }
}
