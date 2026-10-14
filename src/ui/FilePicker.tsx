import { useRef } from "react";
import { t } from "./copy.ts";

/** What the file dialog offers. Other files can still be dropped and get a plain message. */
const ACCEPT = ".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.csv,.html,.htm,.eml,.msg,.pptx,.xlsx";

/** "Välj fil": a real button that opens the file dialog, for keyboards and phones. */
export function FilePicker({ onFile, disabled }: { onFile(file: File): void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="link" aria-haspopup="dialog" disabled={disabled} onClick={() => input.current?.click()}>
        {t("file.choose")}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
