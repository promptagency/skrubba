import { SKIP_WAITING } from "../sw/core.ts";

declare const __SW_KILL__: boolean;

/**
 * Register the offline service worker (production only) and wait until it
 * controls the page, so the model worker's downloads go through its cache.
 * Resolves false when there is no service worker; the app works without one.
 */
export async function controlledByServiceWorker(timeoutMs = 5000): Promise<boolean> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  if (__SW_KILL__) {
    // Kill-switch build: make sure nothing stays registered.
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    return false;
  }
  try {
    retryWaitingActivation(await navigator.serviceWorker.register("/sw.js"));
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

/**
 * A new build calls skipWaiting() when installed, but Chromium can drop that
 * handover: it stops the old worker, a request from the page starts it again,
 * and the new build then waits until every tab is closed. While a build is
 * still waiting, ask it again every second; the ask can be dropped the same way.
 */
export function retryWaitingActivation(reg: ServiceWorkerRegistration, delayMs = 1000): void {
  const retryWhileWaiting = (worker: ServiceWorker) => {
    const timer = setInterval(() => {
      if (reg.waiting === worker) worker.postMessage(SKIP_WAITING);
      else clearInterval(timer);
    }, delayMs);
  };
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    if (worker.state === "installed") retryWhileWaiting(worker);
    else if (worker.state === "installing") {
      const onChange = () => {
        if (worker.state === "installing") return;
        worker.removeEventListener("statechange", onChange);
        if (worker.state === "installed") retryWhileWaiting(worker);
      };
      worker.addEventListener("statechange", onChange);
    }
  };
  watch(reg.waiting);
  watch(reg.installing);
  reg.addEventListener("updatefound", () => watch(reg.installing));
}
