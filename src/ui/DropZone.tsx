import { type ReactNode, useState } from "react";
import { readDrop } from "./drop.ts";

interface Props {
  children: ReactNode;
  onText(text: string): void;
  onUnsupported(): void;
}

/** A card that accepts a dropped text file. */
export function DropZone({ children, onText, onUnsupported }: Props) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? "dropzone-over" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(false);
        const result = await readDrop(e.dataTransfer);
        if (result.kind === "text") onText(result.text);
        if (result.kind === "unsupported") onUnsupported();
      }}
    >
      {children}
    </div>
  );
}
