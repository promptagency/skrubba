import { useRef } from "react";
import { t } from "./copy.ts";

interface Props {
  raw: string;
  count: number;
  onChange(raw: string): void;
  onSave(): void;
  onLoad(file: File): void;
}

/** Egna ord: folded under the pane, there before any text so terms can be added first. Saved and fetched as a text file, since nothing is stored in the browser. */
export function WordList({ raw, count, onChange, onSave, onLoad }: Props) {
  const file = useRef<HTMLInputElement>(null);
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
      <div className="words-actions">
        <button type="button" disabled={count === 0} onClick={onSave}>
          {t("words.save")}
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          {t("words.load")}
        </button>
        <input
          ref={file}
          type="file"
          accept="text/plain,.txt"
          className="offscreen"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onLoad(f);
          }}
        />
      </div>
      <p className="words-hint">{t("words.hint")}</p>
    </details>
  );
}
