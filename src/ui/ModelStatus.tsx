import type { ModelState } from "../state/session.ts";
import { t } from "./copy.ts";

/** What screen readers hear: loading only in quarters so it does not chatter. */
export function announcement(model: ModelState): string {
  if (model.status === "loading") return t("status.loading", { pct: Math.floor(model.pct / 25) * 25 });
  return model.status === "ready" ? t("status.ready") : t("status.rulesOnly");
}

/**
 * Model state for screen readers, plus the rules-only notice on screen. The
 * visible loading progress lives in the Skrubba card (Gate).
 */
export function ModelStatus({ model }: { model: ModelState }) {
  return (
    <>
      <p className="sr-only model-status" role="status" data-state={model.status}>
        {announcement(model)}
      </p>
      {model.status === "rulesOnly" && (
        <p className="notice" aria-hidden="true">
          {t("status.rulesOnly")}
        </p>
      )}
    </>
  );
}
