// Cloudflare Pages Function at /api/event: passes the page's anonymous page
// view (src/ui/analytics.ts) on to Prompt Agency's self-hosted Plausible, so
// the browser itself only ever talks to Skrubba's own address.
//
// Only a page view for skrubba.promptagency.se gets through, and only the four
// known fields: anything else is refused or dropped, so this can never carry
// text on. The visitor's IP and browser string go along because Plausible
// needs them to count unique visitors; Plausible stores neither, only a hash
// that changes every day. Do Not Track and Global Privacy Control are
// honoured here too.

const PLAUSIBLE = "https://plausible.app.promptagency.se/api/event";
const SITE = "skrubba.promptagency.se";
const MAX_BODY = 2048;

interface PageView {
  n: "pageview";
  u: string;
  d: string;
  r: string | null;
}

function pageView(raw: string): PageView | null {
  if (raw.length > MAX_BODY) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { n, u, d, r } = data as Record<string, unknown>;
  if (n !== "pageview" || d !== SITE || typeof u !== "string" || !u.startsWith(`https://${SITE}/`)) return null;
  if (r !== null && r !== undefined && typeof r !== "string") return null;
  return { n, u, d, r: r ?? null };
}

export async function onRequestPost({ request }: { request: Request }): Promise<Response> {
  const event = pageView(await request.text());
  if (!event) return new Response(null, { status: 400 });
  if (request.headers.get("DNT") === "1" || request.headers.get("Sec-GPC") === "1") return new Response(null, { status: 202 });
  try {
    await fetch(PLAUSIBLE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("User-Agent") ?? "",
        "X-Forwarded-For": request.headers.get("CF-Connecting-IP") ?? "",
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Plausible down: the visit is just not counted.
  }
  return new Response(null, { status: 202 });
}
