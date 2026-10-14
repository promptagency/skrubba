import { type ReactNode, useState } from "react";

interface Props {
  children: ReactNode;
  onFiles(files: File[]): void;
}

/** A card that accepts dropped files and hands them to the file window. */
export function DropZone({ children, onFiles }: Props) {
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
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
    >
      {children}
    </div>
  );
}
