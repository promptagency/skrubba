// Dropping a file on a card reads it in the browser. Only plain text: Word
// and PDF need parsing libraries and are out of scope for v1 (CLAUDE.md).

const TEXT_EXTENSIONS = /\.(txt|md)$/i;
const TEXT_TYPES = new Set(["", "text/plain", "text/markdown", "text/x-markdown"]);

export function isTextFile(file: { name: string; type: string }): boolean {
  return TEXT_EXTENSIONS.test(file.name) && TEXT_TYPES.has(file.type);
}

export type DropResult = { kind: "text"; text: string } | { kind: "unsupported" } | { kind: "none" };

/** The first file dropped, read as text if it is a text file. */
export async function readDrop(data: DataTransfer | null): Promise<DropResult> {
  const file = data?.files[0];
  if (!file) return { kind: "none" };
  if (!isTextFile(file)) return { kind: "unsupported" };
  return { kind: "text", text: await file.text() };
}
