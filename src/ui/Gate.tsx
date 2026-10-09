import { t } from "./copy.ts";

/** Shown in place of the editor until the model is ready. Not a modal. */
export function Gate({ pct }: { pct: number }) {
  return (
    <div className="gate">
      <p className="gate-lead">{t("gate.lead")}</p>
      <p>{t("gate.body")}</p>
      <progress max={100} value={pct} aria-label={t("status.loading", { pct })} />
      <p className="gate-progress" aria-hidden="true">
        {t("status.loading", { pct })}
      </p>
    </div>
  );
}
