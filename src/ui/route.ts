import { useEffect, useState } from "react";

// Two routes, no router library: the app at / and the page /sa-funkar-det.
export const HOW_PATH = "/sa-funkar-det";

export function usePath(): string {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

/** Click handler for same-origin links: change the URL without reloading the app. */
export function followLink(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  history.pushState(null, "", e.currentTarget.getAttribute("href"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
