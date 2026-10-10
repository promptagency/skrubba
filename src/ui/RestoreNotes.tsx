import type { RestoreState } from "../state/session.ts";
import { t } from "./copy.ts";

interface Props {
  restore: RestoreState | null;
  onAnswer(found: string, accept: boolean): void;
}

/** Under Avskrubba's result: near-miss placeholders to confirm and unknown ones to check. */
export function RestoreNotes({ restore, onAnswer }: Props) {
  const suggestions = (restore?.result.suggestions ?? []).filter((s) => !restore?.rejected.includes(s.found));
  const unknown = restore?.result.unknown ?? [];
  if (suggestions.length === 0 && unknown.length === 0) return null;

  return (
    <ul className="restore-notes">
      {suggestions.map((s) => (
        <li key={`s-${s.start}`}>
          <span>{t("restore.unmatched", { found: s.found, placeholder: s.placeholder, value: s.value })}</span>
          <button type="button" onClick={() => onAnswer(s.found, true)}>
            {t("restore.accept")}
          </button>
          <button type="button" onClick={() => onAnswer(s.found, false)}>
            {t("restore.reject")}
          </button>
        </li>
      ))}
      {unknown.map((u) => (
        <li key={`u-${u.start}`} className="restore-unknown">
          {t("restore.unknown", { found: u.found })}
        </li>
      ))}
    </ul>
  );
}
