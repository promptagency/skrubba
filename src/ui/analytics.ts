// Anonymous visit counting with Prompt Agency's own Plausible (self-hosted in
// Finland). One page view per page load, sent to Skrubba's own address
// (/api/event), where a Cloudflare Function passes it on (functions/api/event.ts).
// So the browser still talks to no other address, and the CSP stays 'self'.
// What is sent: the page address (with only utm_* tags kept), the referring
// page (origin and path only), and the site's name. Never the text, the
// highlights, the word list or the kodnyckel. Nothing is stored in the browser.
//
// The FAQ and README describe this; keep them in step with any change here.

/** The site's name in Plausible, and the only address that is counted. */
export const PLAUSIBLE_SITE = "skrubba.promptagency.se";

/** The visitor has asked not to be tracked (Global Privacy Control or Do Not Track). */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** This page's address with every query parameter dropped except utm_* (link sources). */
function pageAddress(): string {
  const url = new URL(location.href);
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) if (key.startsWith("utm_")) kept.append(key, value);
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/** The page the visitor came from, origin and path only: some sites pass a search term or a token. */
function referrerPage(): string | null {
  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

/** Count this page load. Only on the public site, never for automated browsers. */
export function countVisit(): void {
  if (location.hostname !== PLAUSIBLE_SITE || optedOut() || navigator.webdriver) return;
  void fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ n: "pageview", u: pageAddress(), d: PLAUSIBLE_SITE, r: referrerPage() }),
  }).catch(() => {
    /* offline, blocked or down: never matters */
  });
}
