/// <reference lib="webworker" />
// Service worker: makes Skrubba work offline after the first visit. Same
// origin only. Small files are fetched on install; the packed model and
// runtime parts are cached the first time the app fetches them, so nothing
// is downloaded twice. Entries are keyed by content revision, so a deploy
// never mixes old and new files.
import { cacheKey, precacheList, type SwManifest, staleKeys } from "./core.ts";

declare const self: ServiceWorkerGlobalScope;
declare const __SW_MANIFEST__: SwManifest;

const MANIFEST: SwManifest = __SW_MANIFEST__;
const CACHE = "skrubba";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        precacheList(MANIFEST).map(async (path) => {
          const key = cacheKey(path, MANIFEST[path]);
          if (await cache.match(key)) return;
          const res = await fetch(path, { cache: "no-cache" });
          if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
          await cache.put(key, res);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const keys = (await cache.keys()).map((r) => r.url);
      await Promise.all(staleKeys(keys, MANIFEST).map((url) => cache.delete(url)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // One screen: every navigation gets the app shell.
  const path = req.mode === "navigate" ? "/index.html" : url.pathname;
  const rev = MANIFEST[path];
  if (!rev) return;
  event.respondWith(cacheFirst(path, rev));
});

async function cacheFirst(path: string, rev: string): Promise<Response> {
  const cache = await caches.open(CACHE);
  const key = cacheKey(path, rev);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(path);
  if (res.ok) await cache.put(key, res.clone());
  return res;
}
