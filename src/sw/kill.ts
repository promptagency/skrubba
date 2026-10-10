/// <reference lib="webworker" />
// Kill switch. Built instead of sw.ts by `SW_KILL=1 npm run build` and
// deployed like any build (see README). Browsers fetch /sw.js fresh on every
// visit, so each returning visitor gets this on their next visit: it deletes
// every cache this origin has (app files and model only; Skrubba never stores
// user text), unregisters itself and reloads open tabs, which then load from
// the network. The same build's app code does not register a service worker,
// so nothing comes back until a normal build is deployed again.

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
      await self.clients.claim();
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) void client.navigate(client.url);
    })(),
  );
});
