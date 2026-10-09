import type { Progress, Span } from "./Masker.ts";

/** Where model spans come from: a Web Worker in the browser, maskera directly in Node tests. */
export interface NerBackend {
  init(onProgress: (p: Progress) => void): Promise<void>;
  /** Model spans only (source "model"), already clipped against rule spans. */
  detect(text: string): Promise<Span[]>;
}
