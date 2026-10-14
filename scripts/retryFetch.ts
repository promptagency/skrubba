// fetch with a few retries, for downloading the model at build time. Hugging
// Face answers 429 when many builds fetch the model close together, and a
// Cloudflare build that gives up at the first refusal never goes live. Only
// answers that can change are retried (429, 5xx, network errors); the caller
// still checks every file against its pinned sha256.

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  fetchFn?: (url: string) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
}

const MAX_DELAY_MS = 60_000;
const retriable = (status: number) => status === 429 || status >= 500;

/** How long to wait before the next try: Retry-After in seconds if given, else doubling from baseDelayMs. */
function delay(res: Response | undefined, attempt: number, baseDelayMs: number): number {
  const retryAfter = Number(res?.headers.get("Retry-After"));
  const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt;
  return Math.min(ms, MAX_DELAY_MS);
}

export async function fetchWithRetry(url: string, options: RetryOptions = {}): Promise<Response> {
  const {
    attempts = 5,
    baseDelayMs = 2000,
    fetchFn = (u: string) => fetch(u),
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;
  for (let attempt = 0; ; attempt++) {
    const last = attempt === attempts - 1;
    let res: Response | undefined;
    try {
      res = await fetchFn(url);
    } catch (err) {
      if (last) throw err;
    }
    if (res && (res.ok || !retriable(res.status) || last)) return res;
    const ms = delay(res, attempt, baseDelayMs);
    console.log(`  ${res ? res.status : "network error"} from ${new URL(url).host}, trying again in ${Math.round(ms / 1000)} s`);
    await sleep(ms);
  }
}
