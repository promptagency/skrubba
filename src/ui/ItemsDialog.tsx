import { t } from "./copy.ts";
import { EntityPanel, type EntityPanelProps } from "./EntityPanel.tsx";
import { Modal } from "./Modal.tsx";

/** The items found, in a window over the page, opened from the count under the pane. */
export function ItemsDialog({ open, onClose, ...panel }: EntityPanelProps & { open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={t("items.title")}>
      <EntityPanel {...panel} />
    </Modal>
  );
}
