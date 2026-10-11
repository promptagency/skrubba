import type { EntityType } from "../engine/index.ts";
import { t, typeGroup } from "./copy.ts";

const GROUPS = ["name", "place", "org", "number", "word"] as const;

interface Props {
  /** The types found; one dot per colour group present, in a fixed order. */
  types: EntityType[];
  label: string;
  onOpen(): void;
}

/** A summary strip that opens a window: the kinds found as dots, a count, and "Visa ›". */
export function Summary({ types, label, onOpen }: Props) {
  const present = new Set(types.map(typeGroup));
  return (
    <button type="button" className="summary" aria-haspopup="dialog" onClick={onOpen}>
      <span className="summary-dots" aria-hidden="true">
        {GROUPS.filter((g) => present.has(g)).map((g) => (
          <span key={g} className={`summary-dot dot-${g}`} />
        ))}
      </span>{" "}
      <span className="summary-label">{label}</span>{" "}
      <span className="summary-show">
        {t("summary.show")}
        <span aria-hidden="true"> ›</span>
      </span>
    </button>
  );
}
