import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import logoDark from "../../design/logo/skrubba-logotyp-negativ.svg";
import logoLight from "../../design/logo/skrubba-logotyp-positiv.svg";
import { type EntityType, keyFileName, type MaskInput, parseKey, parseWordList, type RestoreResult } from "../engine/index.ts";
import { currentKey, freshEntities, panelEntities } from "../state/session.ts";
import { useSession } from "../state/SessionContext.tsx";
import { copyText } from "./clipboard.ts";
import { AGENCY_URL, APP_NAME, AUTHOR_URL, FEEDBACK_EMAIL, KBBERT_URL, MASKERA_URL, REPO_URL } from "../config.ts";
import { countLabel, EXAMPLE, t } from "./copy.ts";
import { APP_VERSION } from "./version.ts";
import { DropZone } from "./DropZone.tsx";
import { FilePicker } from "./FilePicker.tsx";
import { type FileJob, FileWindow } from "./FileWindow.tsx";
import { Editor, type EditorHandle, type PasteUndo } from "./Editor.tsx";
import { Gate } from "./Gate.tsx";
import { FaqDialog } from "./FaqDialog.tsx";
import { HowtoDialog } from "./HowtoDialog.tsx";
import { ItemsDialog } from "./ItemsDialog.tsx";
import { KeyDialog } from "./KeyDialog.tsx";
import { KeyUpload } from "./KeyUpload.tsx";
import { ModelStatus } from "./ModelStatus.tsx";
import { RestoreNotes } from "./RestoreNotes.tsx";
import { firstPlaceholder, type Mark, placeholderMarks } from "./segments.ts";
import { controlledByServiceWorker } from "./serviceWorker.ts";
import { TextPane, type TextPaneHandle } from "./TextPane.tsx";
import { Summary } from "./Summary.tsx";
import { Toast } from "./Toast.tsx";
import { WordList } from "./WordList.tsx";

type Mode = "scrub" | "restore";

const DEBOUNCE_MS = 300;
const FLASH_MS = 1200;

export function App() {
  const { state, dispatch, masker } = useSession();
  const [flash, setFlash] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("scrub");
  const [fileJob, setFileJob] = useState<FileJob | null>(null);
  // Set after a paste whose broken lines were joined, for Ångra.
  const [pasteUndo, setPasteUndo] = useState<PasteUndo | null>(null);
  const editor = useRef<EditorHandle>(null);
  const answerPane = useRef<TextPaneHandle>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const focusCopy = useRef(false);
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

  // Skrubba masks the current text afresh (highlights may be 300 ms old),
  // records the key and shows the result on the right.
  const scrub = useCallback(async (): Promise<string | null> => {
    const s = latest.current;
    if (s.model.status === "loading" || !s.text) return null;
    const input: MaskInput = { wordList: parseWordList(s.wordListRaw), manual: s.manual };
    const entities = s.model.status === "ready" ? await masker.mask(s.text, input) : masker.maskRules(s.text, input);
    if (latest.current.text !== s.text) return null; // edited while the model ran
    dispatch({ type: "setEntities", text: s.text, entities });
    const withKept = entities.map((e) => ({ ...e, active: !latest.current.kept.has(e.placeholder) }));
    const { masked, key } = masker.applyMask(s.text, withKept, input.wordList);
    // The key is recorded now, not on copy: the result can be copied by hand too.
    dispatch({ type: "scrubbed", masked, entries: key.entries, at: key.createdAt });
    return masked;
  }, [masker, dispatch]);

  // Avskrubba always starts from the answer as pasted, with the suggestions
  // accepted so far.
  const restore = useCallback(
    (accept?: string): RestoreResult | null => {
      const s = latest.current;
      if (!s.answer) return null;
      const accepted = new Set([...(s.restore?.accepted ?? []), ...(accept ? [accept] : [])]);
      const result = masker.restore(s.answer, currentKey(s), accepted);
      dispatch({ type: "restored", result });
      return result;
    },
    [masker, dispatch],
  );

  // A restore made with an older key is redone when the key grows.
  const keySize = state.keyEntries.length;
  useEffect(() => {
    if (latest.current.restore) restore();
  }, [keySize, restore]);

  /** The button between the panes. Focus moves on to Kopiera once there is a result. */
  const run = useCallback(async () => {
    const done = mode === "scrub" ? await scrub() : restore();
    if (done) focusCopy.current = true;
  }, [mode, scrub, restore]);

  // The result is already in the right pane when copying fails, so the toast
  // says how to copy it by hand.
  const copyResult = useCallback(async () => {
    const s = latest.current;
    const copy = async (text: string, done: string) => {
      const ok = await copyText(text).then(
        () => true,
        () => false,
      );
      dispatch({ type: "toast", message: ok ? done : t("toast.copyFailed") });
    };
    if (mode === "scrub") {
      const masked = s.scrubbed ?? (await scrub());
      if (masked === null) return;
      const n = new Set(placeholderMarks(masked).map((m) => masked.slice(m.start, m.end))).size;
      await copy(masked, t("toast.copied", { n }));
    } else {
      const result = s.restore?.result ?? restore();
      if (!result) return;
      await copy(result.text, t("toast.copiedRestored", { n: result.restored.length }));
    }
  }, [mode, scrub, restore, dispatch]);

  const hasResult = mode === "scrub" ? state.scrubbed !== null : state.restore !== null;
  useEffect(() => {
    if (hasResult && focusCopy.current) copyButton.current?.focus();
    focusCopy.current = false;
  }, [hasResult]);

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
      // The AI answer is kept, so it does not count as work that would be lost.
      const hasWork = s.text || s.keyEntries.length > 0;
      if (hasWork && !window.confirm(t("key.uploadConfirm"))) return "cancelled";
      masker.loadKey(key);
      dispatch({ type: "loadKey", key });
      return "loaded";
    },
    [masker, dispatch],
  );

  /** Opens the file window for the first of the files, for the left pane of the mode. */
  function openFiles(files: File[], target: FileJob["target"]) {
    const current = target === "text" ? state.text : state.answer;
    setFileJob({ file: files[0], target, multiple: files.length > 1, replaces: current.trim() !== "" });
  }

  /**
   * "Använd texten": the read text goes into the pane the file was for. In
   * Skrubba a document is a new case, so it starts a new kodnyckel as Ny text
   * does, asking first when the key has entries (owner's decision,
   * 2026-10-14). Saying no leaves the window open. Avskrubba keeps the key.
   */
  function applyFileText(text: string) {
    if (fileJob?.target === "answer") {
      setFileJob(null);
      dispatch({ type: "setAnswer", text });
      setTimeout(() => answerPane.current?.focus());
      return;
    }
    if (state.keyEntries.length > 0 && !window.confirm(t("action.newTextConfirm"))) return;
    setFileJob(null);
    masker.reset();
    dispatch({ type: "newText", mode: "scrub" });
    pasted.current = true;
    dispatch({ type: "setText", text });
    setTimeout(() => editor.current?.focus());
  }

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

  // Shortcuts act on the current mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copyResult();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        void run();
      } else if (e.key === "Escape" && latest.current.toast) {
        closeToast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyResult, run, closeToast]);

  const entities = panelEntities(state);
  const wrongMode = firstPlaceholder(state.text);
  const restoredMarks: Mark<EntityType>[] = (state.restore?.result.restored ?? []).map((r) => ({
    start: r.start,
    end: r.end,
    data: r.placeholder.slice(1, r.placeholder.lastIndexOf("_")) as EntityType,
  }));

  return (
    <div className="site">
      <header className="masthead">
        <h1 className="logotype">
          <img className="logo-light" src={logoLight} alt={t("app.name")} />
          <img className="logo-dark" src={logoDark} alt={t("app.name")} />
        </h1>
      </header>

      <div className="controls">
        <div className="mode-switch" role="group" aria-label={t("mode.switch")}>
          {(["scrub", "restore"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m === "scrub" ? t("mode.scrub") : t("mode.restore")}
            </button>
          ))}
        </div>
        <div className="help-links">
          <button type="button" className="link" aria-haspopup="dialog" onClick={() => setFaqOpen(true)}>
            {t("faq.open")}
          </button>
          <span className="help-sep" aria-hidden="true" />
          <button type="button" className="link" aria-haspopup="dialog" onClick={() => setHowtoOpen(true)}>
            {t("howto.open")}
          </button>
        </div>
      </div>

      <main className="workspace">
        <section className="pane" aria-labelledby="pane-in">
          <div className="pane-head">
            <h2 id="pane-in">{mode === "scrub" ? t("pane.scrubIn") : t("pane.restoreIn")}</h2>
            <div className="pane-links">
              {mode === "scrub" && (
                <>
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
                  <span className="help-sep" aria-hidden="true" />
                </>
              )}
              <FilePicker
                disabled={mode === "scrub" && state.model.status === "loading"}
                onFile={(file) => openFiles([file], mode === "scrub" ? "text" : "answer")}
              />
            </div>
          </div>
          {mode === "restore" ? (
            <DropZone onFiles={(files) => openFiles(files, "answer")}>
              <TextPane
                ref={answerPane}
                label={t("pane.restoreIn")}
                placeholder={t("restore.empty")}
                value={state.answer}
                marks={placeholderMarks(state.answer)}
                onChange={(text) => dispatch({ type: "setAnswer", text })}
              />
            </DropZone>
          ) : state.model.status === "loading" ? (
            <Gate pct={state.model.pct} />
          ) : (
            <DropZone onFiles={(files) => openFiles(files, "text")}>
              <Editor
                ref={editor}
                text={state.text}
                entities={freshEntities(state)}
                flash={flash}
                onChange={(text, wasPaste) => {
                  pasted.current = wasPaste;
                  dispatch({ type: "setText", text });
                }}
                onPasteJoined={setPasteUndo}
                onScrubSelection={(term) => dispatch({ type: "addManual", term })}
                onToggleKeep={(placeholder) => dispatch({ type: "toggleKeep", placeholder })}
              />
            </DropZone>
          )}
          {mode === "restore" && state.keyEntries.length === 0 && (
            <div className="notice key-missing">
              <p>{t("key.missing")}</p>
              <KeyUpload onUpload={uploadKey} />
            </div>
          )}
          <ModelStatus model={state.model} />
          {mode === "scrub" && pasteUndo?.cleaned === state.text && (
            <p className="notice paste-joined" role="status">
              <span>{t("paste.joined")}</span>{" "}
              <button
                type="button"
                onClick={() => {
                  pasted.current = true;
                  dispatch({ type: "setText", text: pasteUndo.original });
                  setPasteUndo(null);
                  editor.current?.focus();
                }}
              >
                {t("paste.undo")}
              </button>
            </p>
          )}
          {mode === "scrub" && wrongMode && (
            <p className="notice wrong-mode" role="status">
              <span>{t("wrongMode.notice", { found: wrongMode })}</span>{" "}
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "moveToRestore" });
                  setMode("restore");
                  setTimeout(() => answerPane.current?.focus());
                }}
              >
                {t("wrongMode.move")}
              </button>
            </p>
          )}
          {mode === "scrub" && (
            <>
              {/* Nothing to count or act on before there is text. */}
              {state.text && (
                <div className="card-actions">
                  <Summary types={entities.map((e) => e.type)} label={countLabel(entities.length)} onOpen={() => setItemsOpen(true)} />
                </div>
              )}
              <p className="caveat">
                {t("caveat.short")} <a href={feedbackMailto()}>{t("feedback.link")}</a>
              </p>
              <WordList
                raw={state.wordListRaw}
                count={wordList.length}
                onChange={(raw) => dispatch({ type: "setWordList", raw })}
              />
            </>
          )}
        </section>

        <div className="run-column">
          <button
            type="button"
            className="primary run"
            disabled={mode === "scrub" ? state.model.status === "loading" || !state.text : !state.answer}
            onClick={() => void run()}
          >
            {mode === "scrub" ? t("action.scrub") : t("action.restore")}
            <span className="run-arrow" aria-hidden="true" />
          </button>
          {(mode === "scrub" ? state.text : state.answer) && (
            <button
              type="button"
              className="link new-text"
              onClick={() => {
                if (mode === "scrub") {
                  if (state.keyEntries.length > 0 && !window.confirm(t("action.newTextConfirm"))) return;
                  masker.reset();
                }
                dispatch({ type: "newText", mode });
                setTimeout(() => (mode === "scrub" ? editor.current : answerPane.current)?.focus());
              }}
            >
              {t("action.newText")}
            </button>
          )}
        </div>

        <section className="pane" aria-labelledby="pane-out">
          <div className="pane-head">
            <h2 id="pane-out">{mode === "scrub" ? t("pane.scrubOut") : t("pane.restoreOut")}</h2>
          </div>
          {mode === "scrub" ? (
            <TextPane
              label={t("pane.scrubOut")}
              placeholder={t("scrub.resultEmpty")}
              value={state.scrubbed ?? ""}
              marks={placeholderMarks(state.scrubbed ?? "")}
            />
          ) : (
            <TextPane
              label={t("pane.restoreOut")}
              placeholder={t("restore.resultEmpty")}
              value={state.restore?.result.text ?? ""}
              marks={restoredMarks}
            />
          )}
          {mode === "restore" && (
            <RestoreNotes
              restore={state.restore}
              onAnswer={(found, accept) => {
                dispatch({ type: "suggestion", found, accept });
                if (accept) restore(found);
              }}
            />
          )}
          {(hasResult || state.keyEntries.length > 0) && (
            <div className="card-actions">
              {state.keyEntries.length > 0 && (
                <Summary
                  types={state.keyEntries.map((e) => e.type)}
                  label={t("key.summary", { n: state.keyEntries.length })}
                  onOpen={() => setKeyOpen(true)}
                />
              )}
              {hasResult && (
                <button type="button" className="primary" ref={copyButton} onClick={() => void copyResult()}>
                  {t("action.copy")}
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>
          {fill(t("footer.byline"), {
            app: <strong>{APP_NAME}</strong>,
            author: <ExternalLink href={AUTHOR_URL}>{t("footer.author")}</ExternalLink>,
            agency: <ExternalLink href={AGENCY_URL}>{t("footer.agency")}</ExternalLink>,
          })}
        </p>
        <p>
          {fill(t("footer.credits"), {
            maskera: <ExternalLink href={MASKERA_URL}>{t("footer.maskera")}</ExternalLink>,
            kbbert: <ExternalLink href={KBBERT_URL}>{t("footer.kbbert")}</ExternalLink>,
            github: REPO_URL ? <ExternalLink href={REPO_URL}>{t("footer.github")}</ExternalLink> : t("footer.github"),
          })}
        </p>
        <p>
          <button type="button" className="link" aria-haspopup="dialog" onClick={() => setFaqOpen(true)}>
            {t("status.trust")}
          </button>
        </p>
        <p>{t("footer.version", { version: APP_VERSION })}</p>
      </footer>

      <ItemsDialog
        open={itemsOpen}
        onClose={() => setItemsOpen(false)}
        entities={entities}
        onReveal={(placeholder) => {
          // Close the window first: the text behind it is inert while it is open.
          setItemsOpen(false);
          setTimeout(() => reveal(placeholder));
        }}
        onToggleKeep={(placeholder) => dispatch({ type: "toggleKeep", placeholder })}
        onKeep={(placeholder) => dispatch({ type: "keep", placeholder })}
        onScrubAll={() => dispatch({ type: "scrubAll" })}
        onKeepAll={() => dispatch({ type: "keepAll" })}
      />
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
      <FileWindow job={fileJob} onUse={applyFileText} onClose={() => setFileJob(null)} />
      <HowtoDialog open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <Toast message={state.toast} onClose={closeToast} />
    </div>
  );
}

/** A copy string with {name} slots filled by elements. */
// The email only describes what was missed: the user's text never goes into it.
function feedbackMailto(): string {
  const subject = encodeURIComponent(t("feedback.subject"));
  const body = encodeURIComponent(t("feedback.body"));
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}

function fill(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[piece]}</Fragment> : piece));
}

/** Opens in a new tab, so leaving never loses the text and kodnyckel in this one. */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
