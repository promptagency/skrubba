/**
 * Register the offline service worker (production only) and wait until it
 * controls the page, so the model worker's downloads go through its cache.
 * Resolves false when there is no service worker; the app works without one.
 */
export async function controlledByServiceWorker(timeoutMs = 5000): Promise<boolean> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    return false;
  }
  if (navigator.serviceWorker.controller) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });
}
