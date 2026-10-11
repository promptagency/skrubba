// Session state. Memory only: never localStorage, sessionStorage, IndexedDB,
// cookies or the URL (see CLAUDE.md).
import { type Entity, type Key, type KeyEntry, mergeEntries, parseWordList, type RestoreResult } from "../engine/index.ts";

export type ModelState = { status: "loading"; pct: number } | { status: "ready" } | { status: "rulesOnly" };

export interface SessionState {
  text: string;
  wordListRaw: string;
  manual: string[];
  /** Placeholders the user set to Behåll. Survives recomputation. */
  kept: ReadonlySet<string>;
  entities: Entity[];
  /** The text `entities` were computed for. */
  entitiesText: string;
  model: ModelState;
  /** Skrubba's result: the text as it will be copied, or null until Skrubba is pressed again. */
  scrubbed: string | null;
  toast: string | null;
  /** Placeholder → value for everything scrubbed so far, or loaded from a key file. */
  keyEntries: KeyEntry[];
  keyCreatedAt: string | null;
  /** False once the key has entries the user has not downloaded. */
  keyDownloaded: boolean;
  /** Avskrubba: the AI's answer as pasted. */
  answer: string;
  /** Avskrubba's result for `answer`, or null until Avskrubba is pressed again. */
  restore: RestoreState | null;
}

export interface RestoreState {
  result: RestoreResult;
  accepted: string[];
  rejected: string[];
}

export type SessionAction =
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
  | { type: "scrubbed"; masked: string; entries: KeyEntry[]; at: string }
  | { type: "keyDownloaded" }
  | { type: "loadKey"; key: Key }
  | { type: "clearAll" }
  | { type: "newText"; mode: "scrub" | "restore" }
  | { type: "setAnswer"; text: string }
  | { type: "restored"; result: RestoreResult }
  | { type: "moveToRestore" }
  | { type: "suggestion"; found: string; accept: boolean };

export const initialSession: SessionState = {
  text: "",
  wordListRaw: "",
  manual: [],
  kept: new Set(),
  entities: [],
  entitiesText: "",
  model: { status: "loading", pct: 0 },
  scrubbed: null,
  toast: null,
  keyEntries: [],
  keyCreatedAt: null,
  keyDownloaded: true,
  answer: "",
  restore: null,
};

// Actions that change what Skrubba would produce. Its result is then out of
// date and is cleared, so nothing stale can be copied.
const CHANGES_SCRUB = new Set<SessionAction["type"]>([
  "setText",
  "setWordList",
  "addManual",
  "toggleKeep",
  "keep",
  "keepAll",
  "scrubAll",
  "loadExample",
]);

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const next = reduce(state, action);
  return next !== state && CHANGES_SCRUB.has(action.type) && next.scrubbed !== null ? { ...next, scrubbed: null } : next;
}

function reduce(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "setText":
      return action.text === state.text ? state : { ...state, text: action.text };
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
      return { ...state, text: action.text, wordListRaw: action.wordList.join("\n") };
    case "model":
      return { ...state, model: action.model };
    case "toast":
      return { ...state, toast: action.message };
    case "scrubbed": {
      const keyEntries = mergeEntries(state.keyEntries, action.entries);
      const grew = keyEntries.length > state.keyEntries.length;
      return {
        ...state,
        scrubbed: action.masked,
        keyEntries,
        keyCreatedAt: state.keyCreatedAt ?? action.at,
        keyDownloaded: state.keyDownloaded && !grew,
      };
    }
    case "keyDownloaded":
      return { ...state, keyDownloaded: true };
    case "loadKey":
      // The AI answer stays: it is often pasted first, then the key it needs.
      return {
        ...initialSession,
        model: state.model,
        answer: state.answer,
        wordListRaw: action.key.wordList.join("\n"),
        keyEntries: action.key.entries,
        keyCreatedAt: action.key.createdAt,
      };
    case "clearAll":
      return { ...initialSession, model: state.model };
    case "newText":
      // In Skrubba a new text gets a new kodnyckel, so one key never mixes
      // unrelated texts. Only Egna ord stay: they are reused across texts.
      return action.mode === "scrub"
        ? { ...initialSession, model: state.model, wordListRaw: state.wordListRaw }
        : { ...state, answer: "", restore: null };
    case "setAnswer":
      return action.text === state.answer ? state : { ...state, answer: action.text, restore: null };
    case "restored":
      // An existing result always belongs to the current answer: setAnswer clears it.
      return {
        ...state,
        restore: { result: action.result, accepted: state.restore?.accepted ?? [], rejected: state.restore?.rejected ?? [] },
      };
    case "moveToRestore":
      return { ...state, answer: state.text, restore: null, text: "", entities: [], entitiesText: "", scrubbed: null };
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

/** The key as it is downloaded and used for Avskrubba. */
export function currentKey(state: SessionState): Key {
  return {
    entries: state.keyEntries,
    wordList: parseWordList(state.wordListRaw),
    createdAt: state.keyCreatedAt ?? new Date().toISOString(),
    app: "skrubba",
    version: 1,
  };
}
