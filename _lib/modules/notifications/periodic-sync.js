// Chrome-only, best-effort registration for a background periodicsync tag.
// Feature-detected throughout — silently no-ops on Firefox/Safari and on
// non-installed Chromium rather than erroring. The browser decides actual
// firing cadence regardless of minIntervalMs; this only ever asks, never
// guarantees. Actual cadence can't be verified in Playwright/headless
// Chromium (Notification.permission is hard-locked to 'denied' there
// regardless of granted context permissions) — confirm on a real device.
//
// isPeriodicSyncSupported is exported standalone (not tied to a single tag)
// because apps typically also use it to gate unrelated UI — e.g. hiding a
// whole notifications settings section on browsers that can never honour it.
export function isPeriodicSyncSupported() {
  return 'serviceWorker' in navigator && 'PeriodicSyncManager' in window;
}

export function PeriodicSync(tag, { minIntervalMs = 12 * 60 * 60 * 1000 } = {}) {
  return {
    async register() {
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      if (!('periodicSync' in registration)) return;
      try {
        const status = await navigator.permissions?.query({ name: 'periodic-background-sync' });
        if (status && status.state !== 'granted') return;
        await registration.periodicSync.register(tag, { minInterval: minIntervalMs });
      } catch {
        // Best-effort only — an unsupported permission name (Firefox), a
        // rejected registration, etc. all just leave the foreground-only path active.
      }
    },

    async unregister() {
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      if (!('periodicSync' in registration)) return;
      try {
        await registration.periodicSync.unregister(tag);
      } catch {
        // no-op — nothing to clean up if it was never registered
      }
    },
  };
}
