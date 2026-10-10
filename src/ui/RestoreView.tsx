import { useRef } from "react";
import type { RestoreState } from "../state/session.ts";
import { t } from "./copy.ts";
import { segments } from "./segments.ts";

interface Props {
  answer: string;
  restore: RestoreState | null;
  onChange(text: string): void;
  onAnswer(found: string, accept: boolean): void;
  onCopy(): void;
}

/** Byt tillbaka: paste the AI's answer, get the real values back. */
export function RestoreView({ answer, restore, onChange, onAnswer, onCopy }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const marks = (restore?.result.restored ?? []).map((r) => ({ start: r.start, end: r.end, data: r.placeholder }));
  const suggestions = (restore?.result.suggestions ?? []).filter((s) => !restore?.rejected.includes(s.found));
  const unknown = restore?.result.unknown ?? [];

  function syncScroll() {
    if (area.current && overlay.current) overlay.current.scrollTop = area.current.scrollTop;
  }

  return (
    <div className="restore">
      <div className="editor">
        <div className="editor-overlay" ref={overlay} aria-hidden="true">
          {segments(answer, marks).map((s) =>
            s.data ? (
              <mark key={s.start} className="hl hl-restored" title={s.data}>
                {s.text}
              </mark>
            ) : (
              <span key={s.start}>{s.text}</span>
            ),
          )}
          {answer.endsWith("\n") ? " " : null}
        </div>
        <textarea
          ref={area}
          className="editor-input"
          aria-label={t("mode.restore")}
          placeholder={t("restore.empty")}
          value={answer}
          spellCheck={false}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
        />
      </div>

      {(suggestions.length > 0 || unknown.length > 0) && (
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
      )}

      <div className="restore-actions">
        <button type="button" onClick={onCopy} disabled={!answer}>
          {t("action.copy")}
        </button>
      </div>
    </div>
  );
}
