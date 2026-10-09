import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createBrowserMasker, type Masker, type MaskInput, parseWordList } from "../engine/index.ts";
import { freshEntities, initialSession, type Mode, panelEntities, sessionReducer } from "../state/session.ts";
import { copyText } from "./clipboard.ts";
import { EXAMPLE, t } from "./copy.ts";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { EntityPanel } from "./EntityPanel.tsx";
import { Gate } from "./Gate.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { Toast } from "./Toast.tsx";

const DEBOUNCE_MS = 300;
const FLASH_MS = 1200;
const MODES: Array<{ mode: Mode; label: string }> = [
  { mode: "scrub", label: t("mode.scrub") },
  { mode: "restore", label: t("mode.restore") },
  { mode: "key", label: t("mode.key") },
];
// Byt tillbaka and Nyckel arrive in Phase 3.
const READY_MODES: ReadonlySet<Mode> = new Set(["scrub"]);

export function App() {
  const [masker] = useState<Masker>(() => createBrowserMasker());
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const [flash, setFlash] = useState<string | null>(null);
  const editor = useRef<EditorHandle>(null);
  const pasted = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const wordList = parseWordList(state.wordListRaw);
  const modelStatus = state.model.status;

  // Load the model in the background; rules work meanwhile.
  useEffect(() => {
    masker
      .init(({ loaded, total }) =>
        dispatch({ type: "model", model: { status: "loading", pct: Math.floor((loaded / total) * 100) } }),
      )
      .then(
        () => dispatch({ type: "model", model: { status: "ready" } }),
        () => dispatch({ type: "model", model: { status: "rulesOnly" } }),
      );
  }, [masker]);

  // Rules and word list first, then the model when it is ready. Immediately
  // after a paste, otherwise after 300 ms of quiet.
  useEffect(() => {
    const { text } = state;
    const input: MaskInput = { wordList: parseWordList(state.wordListRaw), manual: state.manual };
    const delay = pasted.current ? 0 : DEBOUNCE_MS;
    pasted.current = false;
    const timer = setTimeout(() => {
      dispatch({ type: "setEntities", text, entities: masker.maskRules(text, input) });
      if (modelStatus === "ready" && text) {
        masker.mask(text, input).then(
          (entities) => dispatch({ type: "setEntities", text, entities }),
          () => {}, // a failed NER run keeps the rule entities on screen
        );
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [masker, state.text, state.wordListRaw, state.manual, modelStatus]);

  // Copy always masks the current text afresh: highlights may be 300 ms old.
  const copyScrubbed = useCallback(async () => {
    const s = latest.current;
    if (s.model.status === "loading" || !s.text) return;
    const input: MaskInput = { wordList: parseWordList(s.wordListRaw), manual: s.manual };
    const entities = s.model.status === "ready" ? await masker.mask(s.text, input) : masker.maskRules(s.text, input);
    dispatch({ type: "setEntities", text: s.text, entities });
    const withKept = entities.map((e) => ({ ...e, active: !latest.current.kept.has(e.placeholder) }));
    const { masked } = masker.applyMask(s.text, withKept, input.wordList);
    await copyText(masked);
    dispatch({ type: "toast", message: t("toast.copied", { n: withKept.filter((e) => e.active).length }) });
  }, [masker]);

  const reveal = useCallback((placeholder: string) => {
    editor.current?.reveal(placeholder);
    setFlash(placeholder);
    setTimeout(() => setFlash((f) => (f === placeholder ? null : f)), FLASH_MS);
  }, []);

  const closeToast = useCallback(() => dispatch({ type: "toast", message: null }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && ["1", "2", "3"].includes(e.key)) {
        const mode = MODES[Number(e.key) - 1].mode;
        e.preventDefault();
        if (READY_MODES.has(mode)) dispatch({ type: "mode", mode });
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copyScrubbed();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        void copyScrubbed();
      } else if (e.key === "Escape" && latest.current.toast) {
        closeToast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyScrubbed, closeToast]);

  const entities = panelEntities(state);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">{t("app.name")}</h1>
        <nav className="modes" aria-label={t("app.name")}>
          {MODES.map(({ mode, label }, i) => (
            <button
              key={mode}
              type="button"
              className="mode"
              aria-current={state.mode === mode ? "page" : undefined}
              disabled={!READY_MODES.has(mode)}
              onClick={() => dispatch({ type: "mode", mode })}
              title={`${navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl+"}${i + 1}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="link"
          disabled={state.model.status === "loading"}
          onClick={() => {
            dispatch({ type: "loadExample", text: EXAMPLE.text, wordList: EXAMPLE.wordList });
            pasted.current = true;
            editor.current?.focus();
          }}
        >
          {t("editor.example")}
        </button>
      </header>

      <main className="workspace">
        <section className="editor-column">
          {state.model.status === "loading" ? (
            <Gate pct={state.model.pct} />
          ) : (
            <Editor
              ref={editor}
              text={state.text}
              entities={freshEntities(state)}
              flash={flash}
              onChange={(text, wasPaste) => {
                pasted.current = wasPaste;
                dispatch({ type: "setText", text });
              }}
              onScrubSelection={(term) => dispatch({ type: "addManual", term })}
              onToggleKeep={(placeholder) => dispatch({ type: "toggleKeep", placeholder })}
            />
          )}
          <p className="caveat">{t("caveat.short")}</p>
        </section>
        <EntityPanel
          entities={entities}
          wordListRaw={state.wordListRaw}
          wordCount={wordList.length}
          onReveal={reveal}
          onToggleKeep={(placeholder) => dispatch({ type: "toggleKeep", placeholder })}
          onKeep={(placeholder) => dispatch({ type: "keep", placeholder })}
          onScrubAll={() => dispatch({ type: "scrubAll" })}
          onKeepAll={() => dispatch({ type: "keepAll" })}
          onWordList={(raw) => dispatch({ type: "setWordList", raw })}
        />
      </main>

      <StatusBar
        model={state.model}
        copyDisabled={state.model.status === "loading" || !state.text}
        onCopy={() => void copyScrubbed()}
      />
      <Toast message={state.toast} onClose={closeToast} />
    </div>
  );
}
