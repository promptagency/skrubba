import { useCallback, useEffect, useRef, useState } from "react";
import { keyFileName, type MaskInput, parseKey, parseWordList } from "../engine/index.ts";
import { currentKey, freshEntities, panelEntities } from "../state/session.ts";
import { useSession } from "../state/SessionContext.tsx";
import { copyText } from "./clipboard.ts";
import { REPO_URL } from "../config.ts";
import { countLabel, EXAMPLE, t } from "./copy.ts";
import { DropZone } from "./DropZone.tsx";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { EntityPanel } from "./EntityPanel.tsx";
import { Gate } from "./Gate.tsx";
import { FaqDialog } from "./FaqDialog.tsx";
import { KeyDialog } from "./KeyDialog.tsx";
import { ModelStatus } from "./ModelStatus.tsx";
import { RestoreView } from "./RestoreView.tsx";
import { controlledByServiceWorker } from "./serviceWorker.ts";
import { Toast } from "./Toast.tsx";

const DEBOUNCE_MS = 300;
const FLASH_MS = 1200;

export function App() {
  const { state, dispatch, masker } = useSession();
  const [flash, setFlash] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [dropError, setDropError] = useState<"scrub" | "restore" | null>(null);
  const editor = useRef<EditorHandle>(null);
  const restorePanel = useRef<HTMLElement>(null);
  const pasted = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const wordList = parseWordList(state.wordListRaw);
  const modelStatus = state.model.status;

  // Load the model in the background. The Skrubba card waits for it.
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

  // Avskrubba always starts from the answer as pasted, with the suggestions
  // accepted so far.
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

  // The right card's one button: Avskrubba, then Kopiera once it is done.
  const restoreOrCopy = useCallback(() => {
    if (latest.current.restore) void copyRestored();
    else runRestore();
  }, [copyRestored, runRestore]);

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

  // Shortcuts act on the card that has focus; the Skrubba card otherwise.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const inRestore = !!restorePanel.current?.contains(document.activeElement);
      if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (inRestore) void copyRestored();
        else void copyScrubbed();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (inRestore) restoreOrCopy();
        else void copyScrubbed();
      } else if (e.key === "Escape" && latest.current.toast) {
        closeToast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyScrubbed, copyRestored, restoreOrCopy, closeToast]);

  const entities = panelEntities(state);

  return (
    <div className="site">
      <header className="masthead">
        <h1 className="logotype">{t("app.name")}</h1>
      </header>

      <div className="toolbar">
        <div className="toolbar-key">
          <span className="toolbar-label" id="key-label">
            {t("mode.key")}
          </span>
          <button
            type="button"
            className="key-button"
            aria-labelledby="key-label key-button"
            aria-describedby="key-explainer"
            id="key-button"
            aria-haspopup="dialog"
            onClick={() => setKeyOpen(true)}
          >
            {state.keyEntries.length > 0 ? countLabel(state.keyEntries.length) : t("key.none")}
          </button>
          <p className="toolbar-explainer" id="key-explainer">
            {t("key.explainer")}
          </p>
        </div>
        <button type="button" className="faq-button" aria-haspopup="dialog" onClick={() => setFaqOpen(true)}>
          {t("faq.open")}
        </button>
      </div>

      <main className="panels">
        <section className="card-column" aria-labelledby="scrub-title">
          <div className="card-head">
            <h2 id="scrub-title">{t("mode.scrub")}</h2>
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
          </div>
          {state.model.status === "loading" ? (
            <Gate pct={state.model.pct} />
          ) : (
            <DropZone
              onText={(text) => {
                setDropError(null);
                pasted.current = true;
                dispatch({ type: "setText", text });
              }}
              onUnsupported={() => setDropError("scrub")}
            >
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
            </DropZone>
          )}
          {dropError === "scrub" && (
            <p className="notice" role="alert">
              {t("drop.unsupported")}
            </p>
          )}
          <ModelStatus model={state.model} />
          <div className="card-actions">
            {/* Nothing to count or act on before there is text. */}
            {state.text && (
              <button
                type="button"
                className="disclosure"
                aria-expanded={listOpen}
                aria-controls="entity-rows"
                onClick={() => setListOpen((open) => !open)}
              >
                {countLabel(entities.length)}{" "}
                <span className="disclosure-arrow" aria-hidden="true">
                  {listOpen ? "▾" : "▸"}
                </span>
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={state.model.status === "loading" || !state.text}
              onClick={() => void copyScrubbed()}
            >
              {t("action.copy")}
            </button>
          </div>
          <p className="caveat">{t("caveat.short")}</p>
          <EntityPanel
            open={listOpen && state.text !== ""}
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
        </section>

        <section className="card-column" aria-labelledby="restore-title" ref={restorePanel}>
          <div className="card-head">
            <h2 id="restore-title">{t("mode.restore")}</h2>
          </div>
          <DropZone
            onText={(text) => {
              setDropError(null);
              dispatch({ type: "setAnswer", text });
            }}
            onUnsupported={() => setDropError("restore")}
          >
            <RestoreView
              answer={state.answer}
              restore={state.restore}
              onChange={(text) => dispatch({ type: "setAnswer", text })}
              onAnswer={(found, accept) => {
                dispatch({ type: "suggestion", found, accept });
                if (accept) runRestore(found);
              }}
            />
          </DropZone>
          {dropError === "restore" && (
            <p className="notice" role="alert">
              {t("drop.unsupported")}
            </p>
          )}
          <div className="card-actions">
            <button type="button" className="primary" disabled={!state.answer} onClick={restoreOrCopy}>
              {state.restore ? t("action.copy") : t("action.restore")}
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          {REPO_URL ? (
            <a href={REPO_URL}>{t("footer.credits")}</a>
          ) : (
            t("footer.credits")
          )}
        </p>
        <p>
          <button type="button" className="link" aria-haspopup="dialog" onClick={() => setFaqOpen(true)}>
            {t("status.trust")}
          </button>
        </p>
      </footer>

      <KeyDialog
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        entries={state.keyEntries}
        wordList={wordList}
        entities={entities}
        onDownload={downloadKey}
        onUpload={uploadKey}
        onClear={clearAll}
      />
      <FaqDialog open={faqOpen} onClose={() => setFaqOpen(false)} />
      <Toast message={state.toast} onClose={closeToast} />
    </div>
  );
}
