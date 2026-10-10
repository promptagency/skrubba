import { t } from "./copy.ts";
import { KeyView, type KeyViewProps } from "./KeyView.tsx";
import { Modal } from "./Modal.tsx";

/** The kodnyckel in a window over the page, opened from the link beside Kopiera. */
export function KeyDialog({ open, onClose, ...view }: KeyViewProps & { open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={t("mode.key")}>
      <p className="modal-lead">{t("key.explainer")}</p>
      <KeyView {...view} />
    </Modal>
  );
}
