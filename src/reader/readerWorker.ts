// Web Worker: reads one dropped or chosen file into text. The page starts a
// fresh one per file and terminates it when the result arrives, on cancel
// and on timeout, so nothing from the file outlives the read.
import { extract } from "./extract.ts";
import type { FromReader, ToReader } from "./protocol.ts";

const post = (msg: FromReader) => postMessage(msg);

self.onmessage = async (e: MessageEvent<ToReader>) => {
  const result = await extract(new Uint8Array(e.data.bytes), e.data.name, (page, pages) => post({ type: "progress", page, pages }));
  post({ type: "result", result });
};
