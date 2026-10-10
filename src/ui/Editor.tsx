import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { Entity } from "../engine/index.ts";
import { t, TYPE_LABEL, typeGroup } from "./copy.ts";
import { entityAt, entityMarks, segments } from "./segments.ts";

export interface EditorHandle {
  /** Scroll the first occurrence of an entity into view. */
  reveal(placeholder: string): void;
  focus(): void;
}

interface Props {
  text: string;
  entities: Entity[]; // fresh only: offsets match `text`
  flash: string | null;
  onChange(text: string, pasted: boolean): void;
  onScrubSelection(term: string): void;
  onToggleKeep(placeholder: string): void;
}

interface Tip {
  label: string;
  x: number;
  y: number;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { text, entities, flash, onChange, onScrubSelection, onToggleKeep },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const pasted = useRef(false);
  const [selection, setSelection] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);

  useImperativeHandle(ref, () => ({
    reveal(placeholder) {
      const mark = overlay.current?.querySelector<HTMLElement>(`[data-ph="${CSS.escape(placeholder)}"]`);
      if (!mark || !area.current) return;
      area.current.scrollTop = Math.max(0, mark.offsetTop - area.current.clientHeight / 3);
      syncScroll();
    },
    focus() {
      area.current?.focus();
    },
  }));

  function syncScroll() {
    if (!area.current || !overlay.current) return;
    overlay.current.scrollTop = area.current.scrollTop;
    overlay.current.scrollLeft = area.current.scrollLeft;
  }

  function readSelection() {
    const el = area.current;
    if (!el) return;
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd).trim());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    if (start === end) return;
    const key = e.key.toLowerCase();
    if (key === "m") {
      const term = el.value.slice(start, end).trim();
      if (!term) return;
      e.preventDefault();
      onScrubSelection(term);
    } else if (key === "b") {
      const hit = entityAt(entities, start, end);
      if (!hit) return;
      e.preventDefault();
      onToggleKeep(hit.placeholder);
    }
  }

  // The overlay sits under the textarea, so find the mark under the pointer
  // through the whole element stack.
  function onMouseMove(e: React.MouseEvent) {
    const mark = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.ph !== undefined);
    if (!mark) return setTip(null);
    const entity = entities.find((x) => x.placeholder === mark.dataset.ph);
    if (!entity) return setTip(null);
    const box = e.currentTarget.getBoundingClientRect();
    const state = entity.active ? t("entity.scrub") : t("entity.keep");
    setTip({ label: `${TYPE_LABEL[entity.type]} · ${entity.placeholder} · ${state}`, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  return (
    <div className="editor" onMouseMove={onMouseMove} onMouseLeave={() => setTip(null)}>
      <div className="editor-overlay" ref={overlay} aria-hidden="true">
        {segments(text, entityMarks(entities)).map((s) =>
          s.data ? (
            <mark
              key={s.start}
              data-ph={s.data.placeholder}
              className={[
                "hl",
                `hl-${typeGroup(s.data.type)}`,
                s.data.active ? "" : "hl-kept",
                flash === s.data.placeholder ? "hl-flash" : "",
              ].join(" ")}
            >
              {s.text}
            </mark>
          ) : (
            <span key={s.start}>{s.text}</span>
          ),
        )}
        {/* A trailing newline needs a character after it to take up a line. */}
        {text.endsWith("\n") ? " " : null}
      </div>
      <textarea
        ref={area}
        className="editor-input"
        aria-label={t("mode.scrub")}
        placeholder={t("editor.empty")}
        value={text}
        spellCheck={false}
        autoFocus
        onChange={(e) => {
          onChange(e.target.value, pasted.current);
          pasted.current = false;
        }}
        onPaste={() => {
          pasted.current = true;
        }}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        onSelect={readSelection}
        onBlur={() => setSelection("")}
      />
      {selection && (
        <button
          type="button"
          className="selection-scrub"
          // Keep the textarea selection: act on mousedown, before focus moves.
          onMouseDown={(e) => {
            e.preventDefault();
            onScrubSelection(selection);
          }}
          tabIndex={-1}
        >
          {t("selection.scrub")} <kbd>M</kbd>
        </button>
      )}
      {tip && (
        <div className="tip" role="tooltip" style={{ left: tip.x + 12, top: tip.y + 16 }}>
          {tip.label}
        </div>
      )}
    </div>
  );
});
