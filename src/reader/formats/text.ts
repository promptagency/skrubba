import { decodeText } from "../decode.ts";
import type { Extracted } from "../types.ts";

/** txt, md and csv: the decoded text as it is. */
export function readText(bytes: Uint8Array): Extracted {
  return { text: decodeText(bytes) };
}
