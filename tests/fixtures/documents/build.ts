// Test documents, built by code so they are reproducible and reviewable.
// Every builder makes the same Swedish sample where it can, so tests compare
// against one expected text. Real-application files are in ./tika/.

/** The shared sample: a name, an organisation, a personnummer, an address and a phone number. */
export const SAMPLE = {
  title: "Anställningsavtal",
  lines: [
    "Mellan Norrström Media AB och Anna Berg, personnummer 19850312-4471.",
    "Anna bor på Storgatan 12 i Umeå och nås på 070-1740612.",
  ],
};
export const SAMPLE_TEXT = [SAMPLE.title, ...SAMPLE.lines].join("\n");

/** Escape text for XML and HTML. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One byte per character, for text in the latin-1 range (windows-1252 for å, ä, ö, é). */
export function latin1(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => {
    const code = c.charCodeAt(0);
    if (code > 0xff) throw new Error(`not latin-1: ${c}`);
    return code;
  });
}

/** The ReadError reason a call throws or rejects with, or "none". */
export async function errorReason(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    return (e as { reason?: string }).reason ?? "not a ReadError";
  }
  return "none";
}
