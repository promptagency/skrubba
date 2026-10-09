import type { Span } from "./Masker.ts";

export type ToWorker = { type: "init"; browserCache: boolean } | { type: "ner"; id: number; text: string };

export type FromWorker =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "ner-result"; id: number; spans: Span[] }
  | { type: "error"; id?: number; message: string };
