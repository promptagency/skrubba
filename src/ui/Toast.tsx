import { useEffect } from "react";

export function Toast({ message, onClose }: { message: string | null; onClose(): void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="toast-region" aria-live="polite">
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
