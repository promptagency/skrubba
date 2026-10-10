import { useEffect, useRef, useState } from "react";
import type { Entity } from "../engine/index.ts";
import { countLabel, t, TYPE_LABEL, typeGroup } from "./copy.ts";

interface Props {
  /** Whether the item rows are shown; the toggle sits in the row under the card. */
  open: boolean;
  entities: Entity[];
  wordListRaw: string;
  wordCount: number;
  onReveal(placeholder: string): void;
  onToggleKeep(placeholder: string): void;
  onKeep(placeholder: string): void;
  onScrubAll(): void;
  onKeepAll(): void;
  onWordList(raw: string): void;
}

export function EntityPanel(props: Props) {
  const { entities } = props;
  const list = useRef<HTMLUListElement>(null);
  const [wordsOpen, setWordsOpen] = useState(false);
  const hadWords = useRef(props.wordCount > 0);

  // Open "Egna ord" when words arrive from outside (the example), not on every edit.
  useEffect(() => {
    if (props.wordCount > 0 && !hadWords.current) setWordsOpen(true);
    hadWords.current = props.wordCount > 0;
  }, [props.wordCount]);

  function moveFocus(from: HTMLElement, step: number) {
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>(".row-main") ?? [])];
    const next = rows[rows.indexOf(from as HTMLButtonElement) + step];
    next?.focus();
  }

  function onRowKey(e: React.KeyboardEvent<HTMLButtonElement>, entity: Entity) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(e.currentTarget, e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === " ") {
      e.preventDefault();
      props.onToggleKeep(entity.placeholder);
    } else if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      props.onKeep(entity.placeholder);
    }
  }

  return (
    <section className="panel" aria-label={countLabel(entities.length)}>
      <ul className="rows" id="entity-rows" ref={list} hidden={!props.open}>
        {entities.map((e, i) => (
          <li key={e.placeholder} className={`row ${e.active ? "" : "row-kept"}`}>
            <button
              type="button"
              className="row-main"
              tabIndex={i === 0 ? 0 : -1}
              onFocus={(ev) => {
                for (const b of list.current?.querySelectorAll<HTMLButtonElement>(".row-main") ?? []) b.tabIndex = -1;
                ev.currentTarget.tabIndex = 0;
              }}
              onClick={() => props.onReveal(e.placeholder)}
              onKeyDown={(ev) => onRowKey(ev, e)}
              aria-label={`${e.value}, ${TYPE_LABEL[e.type]}, ${e.occurrences.length}, ${e.active ? t("entity.scrub") : t("entity.keep")}`}
            >
              <span className={`dot dot-${typeGroup(e.type)}`} aria-hidden="true">
                {e.active ? "●" : "○"}
              </span>
              <span className="row-text">
                <span className="row-value">{e.value}</span>
                <span className="row-type">{TYPE_LABEL[e.type]}</span>
              </span>
              <span className="row-count">×{e.occurrences.length}</span>
            </button>
            <button
              type="button"
              className="row-toggle"
              tabIndex={-1}
              aria-pressed={!e.active}
              onClick={() => props.onToggleKeep(e.placeholder)}
            >
              {e.active ? t("entity.scrub") : t("entity.keep")}
            </button>
          </li>
        ))}
      </ul>
      <details className="words" open={wordsOpen} onToggle={(e) => setWordsOpen(e.currentTarget.open)}>
        <summary>
          {t("panel.words")} ({props.wordCount})
        </summary>
        <textarea
          aria-label={t("panel.words")}
          placeholder={t("panel.wordsPlaceholder")}
          value={props.wordListRaw}
          onChange={(e) => props.onWordList(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      </details>
      <div className="panel-actions" hidden={!props.open}>
        <button type="button" onClick={props.onScrubAll} disabled={entities.length === 0}>
          {t("panel.scrubAll")}
        </button>
        <button type="button" onClick={props.onKeepAll} disabled={entities.length === 0}>
          {t("panel.keepAll")}
        </button>
      </div>
    </section>
  );
}
