// Temporary Phase 1 harness: proves mask → restore runs in the browser with
// the worker and the self-hosted model. Phase 2 replaces it with the real
// screen from docs/UX.md.
import { useEffect, useMemo, useState } from "react";
import { APP_NAME } from "../config.ts";
import { createBrowserMasker } from "../engine/index.ts";

type ModelState = "loading" | "ready" | "rulesOnly";

const STATUS: Record<ModelState, string> = {
  loading: "Laddar modell",
  ready: "Modell laddad",
  rulesOnly: "Modellen kunde inte laddas. Personnummer och liknande hittas ändå, men namn och platser får du markera själv.",
};

export function App() {
  const masker = useMemo(() => createBrowserMasker(), []);
  const [model, setModel] = useState<ModelState>("loading");
  const [text, setText] = useState("");
  const [masked, setMasked] = useState("");
  const [restored, setRestored] = useState("");

  useEffect(() => {
    masker.init(() => {}).then(
      () => setModel("ready"),
      () => setModel("rulesOnly"),
    );
  }, [masker]);

  useEffect(() => {
    let current = true;
    const input = { wordList: [], manual: [] };
    const timer = setTimeout(async () => {
      const entities = model === "ready" ? await masker.mask(text, input) : masker.maskRules(text, input);
      if (!current) return;
      const result = masker.applyMask(text, entities, []);
      setMasked(result.masked);
      setRestored(masker.restore(result.masked, result.key).text);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [masker, model, text]);

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p role="status" data-state={model}>
        {STATUS[model]}
      </p>
      <textarea
        aria-label="Text"
        placeholder="Klistra in text här. Den stannar i din webbläsare."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        cols={80}
      />
      <h2>Skrubbad</h2>
      <pre data-testid="masked">{masked}</pre>
      <h2>Tillbaka</h2>
      <pre data-testid="restored">{restored}</pre>
    </main>
  );
}
