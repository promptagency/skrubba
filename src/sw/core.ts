// Pure parts of the service worker (src/sw/sw.ts), kept apart for testing.

/** URL path → content revision. Written into sw.js at build time. */
export type SwManifest = Record<string, string>;

export const cacheKey = (path: string, rev: string) => `${path}?__rev=${rev}`;

/**
 * Files the offline cache leaves alone. The demo video is watched by few and
 * would add to every first visit; it is fetched from the network when played.
 */
export const inOfflineCache = (path: string) => !path.startsWith("/video/");

/** Small files are fetched on install. Packed parts are cached when the app first fetches them. */
export function precacheList(manifest: SwManifest): string[] {
  return Object.keys(manifest).filter((path) => !/\.gzpart\d+$/.test(path));
}

/** Where the service worker keeps the manifest it activated with, to know the previous build. */
export const MANIFEST_KEY = "/__sw-manifest";

/**
 * Cached request URLs to delete on activate: anything that belongs neither to
 * this build nor to the previous one. The previous build's files stay one
 * more cycle, so a tab still running it never asks for a file that is gone.
 */
export function staleKeys(cachedUrls: string[], current: SwManifest, previous: SwManifest): string[] {
  return cachedUrls.filter((url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === MANIFEST_KEY) return false;
    const rev = searchParams.get("__rev");
    return current[pathname] !== rev && previous[pathname] !== rev;
  });
}
