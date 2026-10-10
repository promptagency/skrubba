import { useRef, useState } from "react";
import type { Entity, KeyEntry } from "../engine/index.ts";
import { t, TYPE_LABEL } from "./copy.ts";

export interface KeyViewProps {
  entries: KeyEntry[];
  wordList: string[];
  entities: Entity[];
  onDownload(): void;
  onUpload(raw: string): "loaded" | "invalid" | "cancelled";
  onClear(): void;
}

/** Nyckel: what each placeholder stands for, download, upload, clear. */
export function KeyView({ entries, wordList, entities, onDownload, onUpload, onClear }: KeyViewProps) {
  const file = useRef<HTMLInputElement>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const counts = new Map(entities.map((e) => [e.placeholder, e.occurrences.length]));

  return (
    <div className="keyview">
      {entries.length === 0 ? (
        <p className="key-empty">{t("key.empty")}</p>
      ) : (
        <table className="key-table">
          <thead>
            <tr>
              <th scope="col">{t("key.col.placeholder")}</th>
              <th scope="col">{t("key.col.value")}</th>
              <th scope="col">{t("key.col.type")}</th>
              <th scope="col">{t("key.col.count")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.placeholder}>
                <td>
                  <code>{e.placeholder}</code>
                </td>
                <td>{e.value}</td>
                <td>{TYPE_LABEL[e.type]}</td>
                <td>{counts.get(e.placeholder) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="key-note">{t("key.note")}</p>

      {wordList.length > 0 && (
        <section>
          <h2 className="key-heading">{t("panel.words")}</h2>
          <ul className="key-words">
            {wordList.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="key-actions">
        <div>
          <button type="button" className="primary" onClick={onDownload} disabled={entries.length === 0}>
            {t("key.download")}
          </button>
          <p className="key-warning">{t("key.downloadWarning")}</p>
        </div>
        <div>
          <button type="button" onClick={() => file.current?.click()}>
            {t("key.upload")}
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="offscreen"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploadFailed(onUpload(await f.text()) === "invalid");
            }}
          />
          {uploadFailed && (
            <p className="key-error" role="alert">
              {t("key.uploadError")}
            </p>
          )}
        </div>
        <div>
          <button type="button" onClick={onClear}>
            {t("key.clear")}
          </button>
        </div>
      </div>
    </div>
  );
}
