import { t } from "./copy.ts";

interface Props {
  raw: string;
  count: number;
  onChange(raw: string): void;
}

/** Egna ord: folded under the pane, there before any text so terms can be added first. */
export function WordList({ raw, count, onChange }: Props) {
  return (
    <details className="words">
      <summary>
        {t("panel.words")} ({count})
      </summary>
      <textarea
        aria-label={t("panel.words")}
        placeholder={t("panel.wordsPlaceholder")}
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        spellCheck={false}
      />
    </details>
  );
}
