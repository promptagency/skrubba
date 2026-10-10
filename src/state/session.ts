// Session state. Memory only: never localStorage, sessionStorage, IndexedDB,
// cookies or the URL (see CLAUDE.md).
import { type Entity, type Key, type KeyEntry, mergeEntries, parseWordList, type RestoreResult } from "../engine/index.ts";

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
  /** Placeholder → value for everything copied so far, or loaded from a key file. */
  keyEntries: KeyEntry[];
  keyCreatedAt: string | null;
  /** False once the key has entries the user has not downloaded. */
  keyDownloaded: boolean;
  /** Byt tillbaka: the text in the answer box. */
  answer: string;
  /** The last restore of `original` (the answer as pasted), or null if the answer changed since. */
  restore: RestoreState | null;
}

export interface RestoreState {
  original: string;
  result: RestoreResult;
  accepted: string[];
  rejected: string[];
}

export type SessionAction =
  | { type: "mode"; mode: Mode }
  | { type: "setText"; text: string }
  | { type: "setWordList"; raw: string }
  | { type: "addManual"; term: string }
  | { type: "setEntities"; text: string; entities: Entity[] }
  | { type: "toggleKeep"; placeholder: string }
  | { type: "keep"; placeholder: string }
  | { type: "keepAll" }
  | { type: "scrubAll" }
  | { type: "loadExample"; text: string; wordList: string[] }
  | { type: "model"; model: ModelState }
  | { type: "toast"; message: string | null }
  | { type: "copied"; entries: KeyEntry[]; at: string }
  | { type: "keyDownloaded" }
  | { type: "loadKey"; key: Key }
  | { type: "clearAll" }
  | { type: "setAnswer"; text: string }
  | { type: "restored"; original: string; result: RestoreResult }
  | { type: "suggestion"; found: string; accept: boolean };

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
  keyEntries: [],
  keyCreatedAt: null,
  keyDownloaded: true,
  answer: "",
  restore: null,
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
    case "keep":
      return state.kept.has(action.placeholder) ? state : { ...state, kept: new Set([...state.kept, action.placeholder]) };
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
    case "copied": {
      const keyEntries = mergeEntries(state.keyEntries, action.entries);
      const grew = keyEntries.length > state.keyEntries.length;
      return {
        ...state,
        keyEntries,
        keyCreatedAt: state.keyCreatedAt ?? action.at,
        keyDownloaded: state.keyDownloaded && !grew,
      };
    }
    case "keyDownloaded":
      return { ...state, keyDownloaded: true };
    case "loadKey":
      return {
        ...initialSession,
        mode: state.mode,
        model: state.model,
        wordListRaw: action.key.wordList.join("\n"),
        keyEntries: action.key.entries,
        keyCreatedAt: action.key.createdAt,
      };
    case "clearAll":
      return { ...initialSession, mode: state.mode, model: state.model };
    case "setAnswer":
      return { ...state, answer: action.text, restore: null };
    case "restored": {
      const same = state.restore?.original === action.original;
      return {
        ...state,
        answer: action.result.text,
        restore: {
          original: action.original,
          result: action.result,
          accepted: same ? state.restore!.accepted : [],
          rejected: same ? state.restore!.rejected : [],
        },
      };
    }
    case "suggestion": {
      if (!state.restore) return state;
      const list = action.accept ? "accepted" : "rejected";
      if (state.restore[list].includes(action.found)) return state;
      return { ...state, restore: { ...state.restore, [list]: [...state.restore[list], action.found] } };
    }
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

/** The key as it is downloaded and used for Byt tillbaka. */
export function currentKey(state: SessionState): Key {
  return {
    entries: state.keyEntries,
    wordList: parseWordList(state.wordListRaw),
    createdAt: state.keyCreatedAt ?? new Date().toISOString(),
    app: "skrubba",
    version: 1,
  };
}
