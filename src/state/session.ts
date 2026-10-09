// Session state. Memory only: never localStorage, sessionStorage, IndexedDB,
// cookies or the URL (see CLAUDE.md).
import type { Entity } from "../engine/index.ts";

export type Mode = "scrub" | "restore" | "key";

export type ModelState = { status: "loading"; pct: number } | { status: "ready" } | { status: "rulesOnly" };

export interface SessionState {
  mode: Mode;
  text: string;
  wordListRaw: string;
  manual: string[];
  /** Placeholders the user set to Behåll. Survives recomputation. */
  kept: ReadonlySet<string>;
  entities: Entity[];
  /** The text `entities` were computed for. */
  entitiesText: string;
  model: ModelState;
  toast: string | null;
}

export type SessionAction =
  | { type: "mode"; mode: Mode }
  | { type: "setText"; text: string }
  | { type: "setWordList"; raw: string }
  | { type: "addManual"; term: string }
  | { type: "setEntities"; text: string; entities: Entity[] }
  | { type: "toggleKeep"; placeholder: string }
  | { type: "keepAll" }
  | { type: "scrubAll" }
  | { type: "loadExample"; text: string; wordList: string[] }
  | { type: "model"; model: ModelState }
  | { type: "toast"; message: string | null };

export const initialSession: SessionState = {
  mode: "scrub",
  text: "",
  wordListRaw: "",
  manual: [],
  kept: new Set(),
  entities: [],
  entitiesText: "",
  model: { status: "loading", pct: 0 },
  toast: null,
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode };
    case "setText":
      return { ...state, text: action.text };
    case "setWordList":
      return { ...state, wordListRaw: action.raw };
    case "addManual": {
      const term = action.term.trim();
      if (!term || state.manual.some((m) => m.toLowerCase() === term.toLowerCase())) return state;
      return { ...state, manual: [...state.manual, term] };
    }
    case "setEntities":
      if (action.text !== state.text) return state;
      return { ...state, entities: action.entities, entitiesText: action.text };
    case "toggleKeep": {
      const kept = new Set(state.kept);
      if (kept.has(action.placeholder)) kept.delete(action.placeholder);
      else kept.add(action.placeholder);
      return { ...state, kept };
    }
    case "keepAll":
      return { ...state, kept: new Set([...state.kept, ...state.entities.map((e) => e.placeholder)]) };
    case "scrubAll": {
      const current = new Set(state.entities.map((e) => e.placeholder));
      return { ...state, kept: new Set([...state.kept].filter((p) => !current.has(p))) };
    }
    case "loadExample":
      return { ...state, mode: "scrub", text: action.text, wordListRaw: action.wordList.join("\n") };
    case "model":
      return { ...state, model: action.model };
    case "toast":
      return { ...state, toast: action.message };
  }
}

const withKept = (state: SessionState, entities: Entity[]) =>
  entities.map((e) => ({ ...e, active: !state.kept.has(e.placeholder) }));

/** Entities for the panel: the latest computed, even while a recompute is pending. */
export function panelEntities(state: SessionState): Entity[] {
  return withKept(state, state.entities);
}

/** Entities whose offsets match the current text, for highlighting. */
export function freshEntities(state: SessionState): Entity[] {
  return state.entitiesText === state.text ? withKept(state, state.entities) : [];
}
