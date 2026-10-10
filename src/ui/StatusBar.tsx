import type { ModelState } from "../state/session.ts";
import { t } from "./copy.ts";
import { followLink, HOW_PATH } from "./route.ts";

interface Props {
  model: ModelState;
  primary: { label: string; disabled: boolean; onClick(): void } | null;
}

function modelText(model: ModelState): string {
  if (model.status === "loading") return t("status.loading", { pct: model.pct });
  if (model.status === "ready") return t("status.ready");
  return t("status.rulesOnly");
}

export function StatusBar({ model, primary }: Props) {
  return (
    <footer className="statusbar">
      <p className="status" role="status" data-state={model.status}>
        <span className={`dot dot-model-${model.status}`} aria-hidden="true">
          ●
        </span>{" "}
        {modelText(model)} ·{" "}
        <a href={HOW_PATH} onClick={followLink}>
          {t("status.trust")}
        </a>
      </p>
      {primary && (
        <button type="button" className="primary" onClick={primary.onClick} disabled={primary.disabled}>
          {primary.label}
        </button>
      )}
    </footer>
  );
}
