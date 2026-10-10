import { useEffect, useRef } from "react";
import { t } from "./copy.ts";
import { KeyView, type KeyViewProps } from "./KeyView.tsx";

/** The key as a card over the page, opened from the key button. Esc closes it. */
export function KeyDialog({ open, onClose, ...view }: KeyViewProps & { open: boolean; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="key-dialog" aria-labelledby="key-title" onClose={onClose}>
      <div className="key-dialog-head">
        <h2 id="key-title">{t("mode.key")}</h2>
        <button type="button" onClick={onClose}>
          {t("key.close")}
        </button>
      </div>
      <KeyView {...view} />
    </dialog>
  );
}
