// What reading a document gives: the text and what to tell the user about
// it, or why it could not be read. See docs/ARCHITECTURE.md, Reading documents.

export type Format = "txt" | "md" | "csv" | "html" | "rtf" | "eml" | "msg" | "docx" | "doc" | "odt" | "pptx" | "xlsx" | "pdf";
export type Note = "hiddenLeftOut" | "attachmentsLeftOut" | "imagesLeftOut" | "onlyFirstFile";
export type Stats = { words: number; pages?: number; slides?: number; sheets?: number };
export type ErrorReason = "unsupported" | "encrypted" | "empty" | "noText" | "tooLarge" | "timeout" | "failed";

export type ReadResult =
  | { kind: "text"; text: string; format: Format; stats: Stats; notes: Note[] }
  | { kind: "error"; reason: ErrorReason };

/** What a format reader returns, before the shared checks in extract.ts. */
export interface Extracted {
  text: string;
  /** Hidden content (comments, deletions, hidden text, notes, hidden slides or sheets) was present and left out. */
  hidden?: boolean;
  /** Attachments were present and left out. */
  attachments?: boolean;
  /** Images were present and left out, and any text in them. */
  images?: boolean;
  pages?: number;
  slides?: number;
  sheets?: number;
}

/** Thrown by a format reader when a file cannot be read. */
export class ReadError extends Error {
  readonly reason: ErrorReason;
  constructor(reason: ErrorReason) {
    super(reason);
    this.reason = reason;
  }
}

export type Progress = (page: number, pages: number) => void;
