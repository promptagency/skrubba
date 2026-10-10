import type { ModelState } from "../state/session.ts";
import { t } from "./copy.ts";
import { followLink, HOW_PATH } from "./route.ts";

interface Props {
  model: ModelState;
  primary: { label: string; disabled: boolean; onClick(): void } | null;
}

// Figure spaces pad the percentage so the line keeps its width while loading.
const FIGURE_SPACE = "\u2007";

function modelText(model: ModelState): string {
  if (model.status === "loading") return t("status.loading", { pct: String(model.pct).padStart(3, FIGURE_SPACE) });
  if (model.status === "ready") return t("status.ready");
  return t("status.rulesOnly");
}

/** What screen readers hear: the same text, but loading only in quarters so it does not chatter. */
export function announcement(model: ModelState): string {
  if (model.status === "loading") return t("status.loading", { pct: Math.floor(model.pct / 25) * 25 });
  return model.status === "ready" ? t("status.ready") : t("status.rulesOnly");
}

export function StatusBar({ model, primary }: Props) {
  return (
    <footer className="statusbar">
      <p className="status" data-state={model.status}>
        <span className={`dot dot-model-${model.status}`} aria-hidden="true">
          ●
        </span>{" "}
        <span aria-hidden="true">{modelText(model)}</span>
        <span className="sr-only" role="status">
          {announcement(model)}
        </span>
        <span className="status-sep" aria-hidden="true">
          {" · "}
        </span>
        <a className="status-trust" href={HOW_PATH} onClick={followLink}>
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
