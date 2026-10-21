import { useEffect, useState } from "react";
import { type ErrorReason, type Note, readDocument, type ReadResult } from "../reader/index.ts";
import { type CopyKey, t } from "./copy.ts";
import { preview, statsLine } from "./fileText.ts";
import { Modal } from "./Modal.tsx";

/** A file to read and the pane its text goes to. */
export interface FileJob {
  file: File;
  target: "text" | "answer";
  /** More than one file was dropped; only `file` is read. */
  multiple: boolean;
  /** The target pane has text that "Använd texten" replaces. */
  replaces: boolean;
}

type TextResult = Extract<ReadResult, { kind: "text" }>;
type State = { step: "reading"; page?: number; pages?: number } | { step: "done"; result: TextResult } | { step: "error"; reason: ErrorReason };

const ERROR_KEY: Record<ErrorReason, CopyKey> = {
  unsupported: "file.error.unsupported",
  encrypted: "file.error.encrypted",
  empty: "file.error.empty",
  noText: "file.error.noText",
  tooLarge: "file.error.tooLarge",
  timeout: "file.error.timeout",
  failed: "file.error.failed",
};
const NOTE_KEY: Record<Note, CopyKey> = {
  hiddenLeftOut: "file.note.hidden",
  attachmentsLeftOut: "file.note.attachments",
  imagesLeftOut: "file.note.images",
  onlyFirstFile: "file.note.firstOnly",
};

/**
 * Läs in dokument: every dropped or chosen file is read here, in a worker,
 * while the window says so. The pane changes only on "Använd texten".
 * Closing the window (Avbryt, Stäng, Esc) stops the read.
 */
export function FileWindow({ job, onUse, onClose }: { job: FileJob | null; onUse(text: string): void; onClose(): void }) {
  const [state, setState] = useState<State>({ step: "reading" });

  useEffect(() => {
    if (!job) return;
    setState({ step: "reading" });
    const reading = new AbortController();
    readDocument(job.file, { signal: reading.signal, onProgress: (page, pages) => setState({ step: "reading", page, pages }) }).then(
      (result) => setState(result.kind === "text" ? { step: "done", result } : { step: "error", reason: result.reason }),
      () => {}, // aborted: the window is closing
    );
    return () => reading.abort();
  }, [job]);

  const notes: Note[] = state.step === "done" ? [...(job?.multiple ? (["onlyFirstFile"] as Note[]) : []), ...state.result.notes] : [];

  return (
    <Modal open={job !== null} onClose={onClose} title={t("file.title")}>
      {job && (
        <div className="file-window">
          <p className="file-name">{job.file.name}</p>
          {state.step === "reading" && (
            <>
              <p className="file-progress" role="status">
                {state.pages ? t("file.readingPage", { page: state.page ?? 1, pages: state.pages }) : t("file.reading")}
              </p>
              <div className="file-actions">
                <button type="button" onClick={onClose}>
                  {t("file.cancel")}
                </button>
              </div>
            </>
          )}
          {state.step === "done" && (
            <>
              <p className="file-stats">{statsLine(state.result)}</p>
              {notes.map((note) => (
                <p className="notice" key={note}>
                  {t(NOTE_KEY[note])}
                </p>
              ))}
              {job.replaces && <p className="notice">{t("file.replaces")}</p>}
              {/* Focusable so the scrollable preview can be read with the keyboard. */}
              <pre className="file-preview" tabIndex={0} aria-label={t("file.preview")}>
                {preview(state.result.text)}
              </pre>
              <div className="file-actions">
                <button type="button" className="primary" autoFocus onClick={() => onUse(state.result.text)}>
                  {t("file.use")}
                </button>
                <button type="button" onClick={onClose}>
                  {t("file.cancel")}
                </button>
              </div>
            </>
          )}
          {state.step === "error" && (
            <p className="notice" role="alert">
              {t(ERROR_KEY[state.reason])}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
