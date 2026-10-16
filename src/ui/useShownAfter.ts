import { useEffect, useState } from "react";

/** True once `active` has stayed true for `ms`, false again at once when it is not. */
export function useShownAfter(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && shown;
}
