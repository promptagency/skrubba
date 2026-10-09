import type { ModelState } from "../state/session.ts";
import { t } from "./copy.ts";

interface Props {
  model: ModelState;
  copyDisabled: boolean;
  onCopy(): void;
}

function modelText(model: ModelState): string {
  if (model.status === "loading") return t("status.loading", { pct: model.pct });
  if (model.status === "ready") return t("status.ready");
  return t("status.rulesOnly");
}

export function StatusBar({ model, copyDisabled, onCopy }: Props) {
  return (
    <footer className="statusbar">
      <p className="status" role="status" data-state={model.status}>
        <span className={`dot dot-model-${model.status}`} aria-hidden="true">
          ●
        </span>{" "}
        {modelText(model)} · {t("status.trust")}
      </p>
      <button type="button" className="primary" onClick={onCopy} disabled={copyDisabled}>
        {t("action.copy")}
      </button>
    </footer>
  );
}
