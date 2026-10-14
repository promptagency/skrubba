import type { ReadResult } from "./types.ts";

/** Page → reader worker: the file, transferred. */
export type ToReader = { bytes: ArrayBuffer; name: string };
/** Reader worker → page. */
export type FromReader = { type: "progress"; page: number; pages: number } | { type: "result"; result: ReadResult };
