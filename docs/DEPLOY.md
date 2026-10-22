# Deploys and the offline cache

## Hosting

Skrubba is a static site on Cloudflare Pages, project `skrubba`, built from `main` on GitHub (`promptagency/skrubba`). Every push to `main` deploys; other branches get preview URLs.

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | from `.node-version` (24) |
| Custom domain | `skrubba.app`, the canonical address since 2026-10-22. The old address `skrubba.promptagency.se` is a 301 redirect to it, set up in Cloudflare, not in this repo |
| Web Analytics | Off. It injects a script from another origin, which the CSP blocks and the privacy promise forbids. Visits are counted with our own Plausible instead (below) |

**If a push does not go live.** At launch (2026-10-12) three of seven deploys failed at the very last step with "Failed to publish your Function. Got error: Unknown internal error occurred", although Skrubba has no Functions and the build had passed. It is on Cloudflare's side, and retrying the same deployment fixed it every time (Workers & Pages → skrubba → Deployments → the failed one → Retry deployment). The live build is in the page: `<meta name="skrubba-build" content="<commit>">`.

**Visit counting.** `functions/` holds one Pages Function, `/api/event`, which passes the page's anonymous page view on to Plausible (`plausible.app.promptagency.se`, site `skrubba.app`). Plausible's own script and its optional measurements are not used. To leave your own visits out, add your IP address under the site's Shields in Plausible. Automated browsers (the smoke tests) are never counted.

After a deploy, `npm run smoke` runs the privacy check, the model, a full round trip, offline use and the feedback link in all three browsers against the live site (`SKRUBBA_URL=https://skrubba.pages.dev npm run smoke` for another address). It caught a bug local tests could not: Cloudflare redirects `/index.html` to `/`, and a service worker that cached the redirect broke every return visit. The worker now fetches the app shell from `/`.

The build downloads the model from Hugging Face and checks it against pinned sha256 hashes, so a build never ships weights that differ from the ones tested. Hugging Face sometimes answers 429 (too many requests) when many builds run close together, so the download waits and tries again up to five times, with growing pauses or as long as its Retry-After header asks (`scripts/retryFetch.ts`). A build that still fails can be retried from the dashboard. `public/_headers` sets the CSP (also as a meta tag), cross-origin isolation, hardening headers and caching; `scripts/headers.test.ts` keeps its CSP equal to the one in `vite.config.ts`.


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

Pushing the tag also runs the full browser suite on GitHub (`.github/workflows/test.yml`); ordinary pushes to `main` only run the type check and unit tests. That split was made to save Actions minutes while the repo was private; since it went public (2026-10-12) minutes are free, but the split keeps pushes quick. There is no need to run `npm run e2e` locally before tagging: the tag run does the same, in all three browsers (owner's decision, 2026-10-15). A real failure then shows up after the tag instead of before; fix it and release the next patch version, as below. On CI a failing test is run once more (`retries` in `playwright.config.ts`), so a one-off flake passes and is reported as flaky. A bug that always shows up fails both tries and blocks the release page, but one that only shows up sometimes can pass on the retry, so the run's summary lists every flaky test ("Flaky tests", from `scripts/flaky.ts`): open each and check whether the test or the app is at fault. The privacy tests (`no-egress.spec.ts`, and the web storage test in `restore.spec.ts`) never retry, so a leak that happens only sometimes still blocks the release (owner's decision, 2026-10-16).

Once the tag's tests have passed, the workflow creates the GitHub release page for it, titled "Skrubba X.Y.Z", with that version's section from `CHANGELOG.md` as the notes (`scripts/release-notes.ts`). A version with failing tests gets no page; fix it, then release the next patch version. The page is only a label: the site was already deployed when `main` was pushed.

The footer shows the version from `package.json`, set when the app is built. A unit test (`scripts/changelog.test.ts`) fails if `CHANGELOG.md` has no entry for that version.

## Updating dependencies

Dependabot (`.github/dependabot.yml`) opens pull requests once a month: one per runtime package (maskera, transformers.js, React…), one for all build and test tools, and one for the GitHub Actions in the workflow. Dependabot security updates open a pull request at once when a dependency has a known vulnerability. Each pull request runs the checks and gets a Cloudflare preview address.

Merging into `main` deploys to production, so never merge one unread or untested:

1. Check out the branch, run `npm ci`, `npm test` and `npm run e2e`.
2. **maskera or @maskera/core:** run `npm run spike` and compare leaks and over-masking with the previous run (counts only). A new maskera can find more, or less.
3. **onnxruntime-node:** bump its entry in `allowScripts` in `package.json` to the new version, or npm skips its install script and the model tests silently test nothing. `scripts/allowScripts.test.ts` fails until you do.
4. **@huggingface/transformers or onnxruntime-web:** these change the runtime files under `/runtime/`; the build checks them, but run the full `npm run e2e` and, after merging, `npm run smoke`.
5. Merge, then check that the deploy went live and `npm run smoke` passes.

