import { forwardRef, useImperativeHandle, useRef } from "react";
import type { EntityType } from "../engine/index.ts";
import { typeGroup } from "./copy.ts";
import { type Mark, segments } from "./segments.ts";

export interface TextPaneHandle {
  focus(): void;
}

interface Props {
  label: string;
  placeholder: string;
  value: string;
  /** Highlighted runs, coloured by type. */
  marks: Mark<EntityType>[];
  /** Results are read-only; the AI answer is editable. */
  onChange?(text: string): void;
}

/** A text box with a highlight layer behind it, like the Skrubba editor without the editing tools. */
export const TextPane = forwardRef<TextPaneHandle, Props>(function TextPane(
  { label, placeholder, value, marks, onChange },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }));

  function syncScroll() {
    if (!area.current || !overlay.current) return;
    overlay.current.scrollTop = area.current.scrollTop;
    overlay.current.scrollLeft = area.current.scrollLeft;
  }

  return (
    <div className={`editor ${onChange ? "" : "editor-result"}`}>
      <div className="editor-overlay" ref={overlay} aria-hidden="true">
        {segments(value, marks).map((s) =>
          s.data ? (
            <mark key={s.start} className={`hl hl-${typeGroup(s.data)}`}>
              {s.text}
            </mark>
          ) : (
            <span key={s.start}>{s.text}</span>
          ),
        )}
        {value.endsWith("\n") ? " " : null}
      </div>
      <textarea
        ref={area}
        className="editor-input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        readOnly={!onChange}
        spellCheck={false}
        onChange={onChange && ((e) => onChange(e.target.value))}
        onScroll={syncScroll}
      />
    </div>
  );
});
