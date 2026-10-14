// Caps that keep a hostile or broken file from hanging the reader or eating
// memory. Exceeding one gives a plain error in the file window.
export const LIMITS = {
  fileBytes: 50 * 1024 * 1024,
  zipEntries: 2000,
  zipTotalBytes: 100 * 1024 * 1024,
  zipEntryBytes: 50 * 1024 * 1024,
  zipRatio: 200,
  timeoutMs: 30_000,
  textChars: 2_000_000,
} as const;
