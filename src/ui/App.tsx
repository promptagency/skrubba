import { useCallback, useEffect, useRef, useState } from "react";
import { keyFileName, type MaskInput, parseKey, parseWordList } from "../engine/index.ts";
import { currentKey, freshEntities, type Mode, panelEntities } from "../state/session.ts";
import { useSession } from "../state/SessionContext.tsx";
import { copyText } from "./clipboard.ts";
import { EXAMPLE, HOW, t } from "./copy.ts";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { EntityPanel } from "./EntityPanel.tsx";
import { Gate } from "./Gate.tsx";
import { HowItWorks } from "./HowItWorks.tsx";
import { KeyView } from "./KeyView.tsx";
import { RestoreView } from "./RestoreView.tsx";
import { followLink, HOW_PATH, usePath } from "./route.ts";
import { controlledByServiceWorker } from "./serviceWorker.ts";
import { StatusBar } from "./StatusBar.tsx";
import { Toast } from "./Toast.tsx";

const DEBOUNCE_MS = 300;
const FLASH_MS = 1200;
const MODES: Array<{ mode: Mode; label: string }> = [
  { mode: "scrub", label: t("mode.scrub") },
  { mode: "restore", label: t("mode.restore") },
  { mode: "key", label: t("mode.key") },
];

export function App() {
  const { state, dispatch, masker } = useSession();
  const path = usePath();
  const [flash, setFlash] = useState<string | null>(null);
  const editor = useRef<EditorHandle>(null);
  const pasted = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const wordList = parseWordList(state.wordListRaw);
  const modelStatus = state.model.status;

  // Load the model in the background. The Skrubba editor waits for it.
  useEffect(() => {
    controlledByServiceWorker()
      .then((controlled) =>
        masker.init(
          ({ loaded, total }) =>
            dispatch({ type: "model", model: { status: "loading", pct: Math.floor((loaded / total) * 100) } }),
          { browserCache: !controlled },
        ),
      )
      .then(
        () => dispatch({ type: "model", model: { status: "ready" } }),
        () => dispatch({ type: "model", model: { status: "rulesOnly" } }),
      );
  }, [masker, dispatch]);

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
  }, [masker, dispatch, state.text, state.wordListRaw, state.manual, modelStatus]);

  // Warn before the tab closes with a key that only exists here.
  useEffect(() => {
    if (state.keyDownloaded) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t("unload.warning"); // most browsers show their own text
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.keyDownloaded]);

  // Copy always masks the current text afresh: highlights may be 300 ms old.
  const copyScrubbed = useCallback(async () => {
    const s = latest.current;
    if (s.model.status === "loading" || !s.text) return;
    const input: MaskInput = { wordList: parseWordList(s.wordListRaw), manual: s.manual };
    const entities = s.model.status === "ready" ? await masker.mask(s.text, input) : masker.maskRules(s.text, input);
    dispatch({ type: "setEntities", text: s.text, entities });
    const withKept = entities.map((e) => ({ ...e, active: !latest.current.kept.has(e.placeholder) }));
    const { masked, key } = masker.applyMask(s.text, withKept, input.wordList);
    // Record the key first: the masked text may reach the AI even if the
    // clipboard call reports a failure.
    dispatch({ type: "copied", entries: key.entries, at: key.createdAt });
    await copyText(masked);
    dispatch({ type: "toast", message: t("toast.copied", { n: key.entries.length }) });
  }, [masker, dispatch]);

  // Byt tillbaka always starts from the answer as pasted, with the
  // suggestions accepted so far.
  const runRestore = useCallback(
    (accept?: string) => {
      const s = latest.current;
      const original = s.restore?.original ?? s.answer;
      if (!original) return;
      const accepted = new Set([...(s.restore?.accepted ?? []), ...(accept ? [accept] : [])]);
      dispatch({ type: "restored", original, result: masker.restore(original, currentKey(s), accepted) });
    },
    [masker, dispatch],
  );

  // A restore made with an older key is redone when the key grows.
  const keySize = state.keyEntries.length;
  useEffect(() => {
    if (latest.current.restore) runRestore();
  }, [keySize, runRestore]);

  const copyRestored = useCallback(async () => {
    const s = latest.current;
    if (!s.answer) return;
    await copyText(s.answer);
    dispatch({ type: "toast", message: t("toast.copiedRestored", { n: s.restore?.result.restored.length ?? 0 }) });
  }, [dispatch]);

  const downloadKey = useCallback(() => {
    const s = latest.current;
    if (s.keyEntries.length === 0) return;
    const blob = new Blob([JSON.stringify(currentKey(s), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = keyFileName(new Date());
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    dispatch({ type: "keyDownloaded" });
  }, [dispatch]);

  const uploadKey = useCallback(
    (raw: string): "loaded" | "invalid" | "cancelled" => {
      const key = parseKey(raw);
      if (!key) return "invalid";
      const s = latest.current;
      const hasWork = s.text || s.answer || s.keyEntries.length > 0;
      if (hasWork && !window.confirm(t("key.uploadConfirm"))) return "cancelled";
      masker.loadKey(key);
      dispatch({ type: "loadKey", key });
      return "loaded";
    },
    [masker, dispatch],
  );

  const clearAll = useCallback(() => {
    if (!window.confirm(t("key.clearConfirm"))) return;
    masker.reset();
    dispatch({ type: "clearAll" });
  }, [masker, dispatch]);

  const reveal = useCallback((placeholder: string) => {
    editor.current?.reveal(placeholder);
    setFlash(placeholder);
    setTimeout(() => setFlash((f) => (f === placeholder ? null : f)), FLASH_MS);
  }, []);

  const closeToast = useCallback(() => dispatch({ type: "toast", message: null }), [dispatch]);

  const primary = {
    scrub: {
      label: t("action.copy"),
      disabled: state.model.status === "loading" || !state.text,
      onClick: () => void copyScrubbed(),
    },
    restore: { label: t("action.restore"), disabled: !state.answer, onClick: () => runRestore() },
    // Nyckel has its own buttons, with the warning under "Ladda ner nyckel".
    key: null,
  }[state.mode];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const mode = latest.current.mode;
      if (mod && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        dispatch({ type: "mode", mode: MODES[Number(e.key) - 1].mode });
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (mode === "scrub") void copyScrubbed();
        if (mode === "restore") void copyRestored();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (mode === "scrub") void copyScrubbed();
        if (mode === "restore") runRestore();
        if (mode === "key") downloadKey();
      } else if (e.key === "Escape" && latest.current.toast) {
        closeToast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, copyScrubbed, copyRestored, runRestore, downloadKey, closeToast]);

  const entities = panelEntities(state);

  // The session stays in memory while the page is shown; going back finds it intact.
  if (path === HOW_PATH) return <HowItWorks />;

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
        <a className="help" href={HOW_PATH} onClick={followLink} aria-label={HOW.title}>
          ?
        </a>
      </header>

      {state.mode === "scrub" && (
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
      )}

      {state.mode === "restore" && (
        <main className="workspace workspace-single">
          <RestoreView
            answer={state.answer}
            restore={state.restore}
            onChange={(text) => dispatch({ type: "setAnswer", text })}
            onAnswer={(found, accept) => {
              dispatch({ type: "suggestion", found, accept });
              if (accept) runRestore(found);
            }}
            onCopy={() => void copyRestored()}
          />
        </main>
      )}

      {state.mode === "key" && (
        <main className="workspace workspace-single">
          <KeyView
            entries={state.keyEntries}
            wordList={wordList}
            entities={entities}
            onDownload={downloadKey}
            onUpload={uploadKey}
            onClear={clearAll}
          />
        </main>
      )}

      <StatusBar model={state.model} primary={primary} />
      <Toast message={state.toast} onClose={closeToast} />
    </div>
  );
}
