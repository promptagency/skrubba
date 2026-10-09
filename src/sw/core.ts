// Pure parts of the service worker (src/sw/sw.ts), kept apart for testing.

/** URL path → content revision. Written into sw.js at build time. */
export type SwManifest = Record<string, string>;

export const cacheKey = (path: string, rev: string) => `${path}?__rev=${rev}`;

/** Small files are fetched on install. Packed parts are cached when the app first fetches them. */
export function precacheList(manifest: SwManifest): string[] {
  return Object.keys(manifest).filter((path) => !/\.gzpart\d+$/.test(path));
}

/** Cached request URLs that no longer match the manifest (old revisions, removed files). */
export function staleKeys(cachedUrls: string[], manifest: SwManifest): string[] {
  return cachedUrls.filter((url) => {
    const { pathname, searchParams } = new URL(url);
    return manifest[pathname] !== searchParams.get("__rev");
  });
}
