import { type ReactNode, useEffect, useRef } from "react";
import { t } from "./copy.ts";

interface Props {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
}

/** A window over the page (native modal dialog): focus is trapped, Esc and "Stäng" close it. */
export function Modal({ open, onClose, title, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `modal-${title.toLowerCase().replace(/\W+/g, "-")}`;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // The dialog's close event is fired in a later task. When the window has
  // been reopened in between (a second file dropped right after Använd
  // texten), that stale event must not close the new one.
  const closed = () => {
    if (!dialog.current?.open) onClose();
  };

  return (
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} onClose={closed}>
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose}>
          {t("key.close")}
        </button>
      </div>
      {children}
    </dialog>
  );
}
