# Deploys and the offline cache

Skrubba has a service worker so the 53 MB language model is downloaded once and the app works offline.

**How a deploy reaches returning visitors.** Browsers fetch `/sw.js` fresh on every visit. Each build bakes a content hash of every file into it, so any change gives a new `sw.js`. The visit that finds it is still served by the old build and installs the new one in the background; the next load is the new build. The previous build's files are kept one more cycle, so a tab left open on the old build keeps working. Every served path except `index.html` is content-addressed, so old and new files never mix.

**`/sw.js` must never be cached.** `public/_headers` sets `Cache-Control: no-cache` on it. Do not override that in Cloudflare.

**Turning the offline cache off (kill switch).** If the service worker misbehaves in production:

```sh
SW_KILL=1 npm run build   # then deploy dist/ as usual
```

On their next visit, every returning visitor gets a service worker that deletes all of Skrubba's caches, unregisters itself and reloads the tab from the network. The app in that build does not register a service worker, so it stays off. Caches hold app files and the model only; Skrubba never stores user text. To turn the cache back on, deploy a normal build.

`npx playwright test deploy` checks all of this against three local builds (update, kill switch, old tab).
