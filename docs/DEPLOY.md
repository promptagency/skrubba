# Deploys and the offline cache

## Hosting

Skrubba is a static site on Cloudflare Pages, project `skrubba`, built from `main` on GitHub (`promptagency/skrubba`). Every push to `main` deploys; other branches get preview URLs.

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | from `.node-version` (24) |
| Custom domain | `skrubba.promptagency.se`, a CNAME to `skrubba.pages.dev` at the DNS host of promptagency.se |
| Web Analytics | Off. It injects a script from another origin, which the CSP blocks and the privacy promise forbids |

The build downloads the model from Hugging Face and checks it against pinned sha256 hashes, so a build never ships weights that differ from the ones tested. `public/_headers` sets the CSP (also as a meta tag), cross-origin isolation, hardening headers and caching; `scripts/headers.test.ts` keeps its CSP equal to the one in `vite.config.ts`.


Skrubba has a service worker so the 53 MB language model is downloaded once and the app works offline.

**How a deploy reaches returning visitors.** Browsers fetch `/sw.js` fresh on every visit. Each build bakes a content hash of every file into it, so any change gives a new `sw.js`. The visit that finds it is still served by the old build and installs the new one in the background; the next load is the new build. The previous build's files are kept one more cycle, so a tab left open on the old build keeps working. Every served path except `index.html` is content-addressed, so old and new files never mix.

**`/sw.js` must never be cached.** `public/_headers` sets `Cache-Control: no-cache` on it. Do not override that in Cloudflare.

**Turning the offline cache off (kill switch).** If the service worker misbehaves in production:

```sh
SW_KILL=1 npm run build   # then deploy dist/ as usual
```

On their next visit, every returning visitor gets a service worker that deletes all of Skrubba's caches, unregisters itself and reloads the tab from the network. The app in that build does not register a service worker, so it stays off. Caches hold app files and the model only; Skrubba never stores user text. To turn the cache back on, deploy a normal build.

`npx playwright test deploy` checks all of this against three local builds (update, kill switch, old tab).

## Releasing a version

Versions follow [Semantic Versioning](https://semver.org/): a bug fix bumps the last number (1.0.1), a new feature the middle one (1.1.0), and a change that breaks something users rely on, such as the kodnyckel file format, the first (2.0.0).

1. While working, note each user-visible change under `## [Unreleased]` in `CHANGELOG.md`.
2. To release, rename that section to `## [X.Y.Z] - YYYY-MM-DD`, add a new empty `## [Unreleased]` above it, and update the compare links at the bottom.
3. Set the version, commit and tag:

   ```sh
   npm version X.Y.Z --no-git-tag-version   # package.json and package-lock.json
   git commit -am "Release X.Y.Z"
   git tag -a vX.Y.Z -m "Skrubba X.Y.Z"
   git push --follow-tags
   ```

Pushing the tag also runs the full browser suite on GitHub (`.github/workflows/test.yml`); ordinary pushes to `main` only run the type check and unit tests, to stay within the free Actions minutes of a private repo. Run `npm run e2e` locally before tagging.

The footer shows the version from `package.json`, set when the app is built. A unit test (`scripts/changelog.test.ts`) fails if `CHANGELOG.md` has no entry for that version.
