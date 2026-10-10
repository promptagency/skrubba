import { useRef, useState } from "react";
import { t } from "./copy.ts";

interface Props {
  onUpload(raw: string): "loaded" | "invalid" | "cancelled";
}

/** "Ladda upp kodnyckel": a file picker, with the error under it if the file is not a key. */
export function KeyUpload({ onUpload }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);

  return (
    <div className="key-upload">
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
          setFailed(onUpload(await f.text()) === "invalid");
        }}
      />
      {failed && (
        <p className="key-error" role="alert">
          {t("key.uploadError")}
        </p>
      )}
    </div>
  );
}
