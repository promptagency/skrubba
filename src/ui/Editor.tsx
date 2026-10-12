import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { type Entity, firstNamePlaceholder } from "../engine/index.ts";
import { t, TYPE_LABEL, typeGroup } from "./copy.ts";
import { cleanPaste } from "./pasteCleanup.ts";
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
  /** After a paste whose lines were joined: the text now, and as it would have been pasted. Null otherwise. */
  onPasteJoined(undo: PasteUndo | null): void;
  onScrubSelection(term: string): void;
  onToggleKeep(placeholder: string): void;
}

export interface PasteUndo {
  cleaned: string;
  original: string;
}

interface Tip {
  label: string;
  x: number;
  y: number;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { text, entities, flash, onChange, onPasteJoined, onScrubSelection, onToggleKeep },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const pasted = useRef(false);
  const clickToggled = useRef<string | null>(null);
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
  function markUnder(e: React.MouseEvent): HTMLElement | undefined {
    return document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.ph !== undefined);
  }

  function entityUnder(e: React.MouseEvent): Entity | undefined {
    const mark = markUnder(e);
    return mark && entities.find((x) => x.placeholder === mark.dataset.ph);
  }

  // A plain click on a highlight switches Skrubba / Behåll. Dragging out a
  // selection or a modifier key leaves it alone, and the second click of a
  // double-click (selecting the word) undoes the first.
  function onClick(e: React.MouseEvent) {
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.detail === 2 && clickToggled.current) {
      onToggleKeep(clickToggled.current);
      clickToggled.current = null;
      return;
    }
    clickToggled.current = null;
    const el = area.current;
    if (e.detail !== 1 || !el || el.selectionStart !== el.selectionEnd) return;
    const entity = entityUnder(e);
    if (!entity) return;
    onToggleKeep(entity.placeholder);
    clickToggled.current = entity.placeholder;
    setTip(null);
  }

  function onMouseMove(e: React.MouseEvent) {
    const entity = entityUnder(e);
    if (area.current) area.current.style.cursor = entity ? "pointer" : "";
    if (!entity) return setTip(null);
    const box = e.currentTarget.getBoundingClientRect();
    const state = entity.active ? t("entity.scrub") : t("entity.keep");
    const [type, placeholder] =
      markUnder(e)?.dataset.first === undefined
        ? [entity.type, entity.placeholder]
        : (["FÖRNAMN", firstNamePlaceholder(entity.placeholder)] as const);
    setTip({ label: `${TYPE_LABEL[type]} · ${placeholder} · ${state}`, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  return (
    <div className="editor" onMouseMove={onMouseMove} onMouseLeave={() => setTip(null)} onClick={onClick}>
      <div className="editor-overlay" ref={overlay} aria-hidden="true">
        {segments(text, entityMarks(entities)).map((s) =>
          s.data ? (
            <mark
              key={s.start}
              data-ph={s.data.placeholder}
              data-first={s.data.occurrences.some((o) => o.start === s.start && o.firstName) ? "" : undefined}
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
        aria-label={t("pane.scrubIn")}
        placeholder={t("editor.empty")}
        value={text}
        spellCheck={false}
        autoFocus
        onChange={(e) => {
          onChange(e.target.value, pasted.current);
          pasted.current = false;
        }}
        onPaste={(e) => {
          pasted.current = true;
          const raw = e.clipboardData.getData("text/plain");
          if (!raw) return;
          e.preventDefault();
          const el = e.currentTarget;
          const { text: clean, joined } = cleanPaste(raw);
          const before = el.value.slice(0, el.selectionStart);
          const after = el.value.slice(el.selectionEnd);
          // insertText keeps the browser's own undo; it fires onChange.
          if (!document.execCommand("insertText", false, clean)) {
            onChange(before + clean + after, true);
            pasted.current = false;
            const caret = before.length + clean.length;
            requestAnimationFrame(() => el.setSelectionRange(caret, caret));
          }
          onPasteJoined(joined ? { cleaned: before + clean + after, original: before + raw + after } : null);
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
