// Chrome-only, best-effort registration for the background notification
// digest (see app/sw-extensions.js) — feature-detected throughout, so this
// silently no-ops on Firefox and on non-installed Chromium, rather than
// erroring. The browser decides actual firing cadence regardless of
// minInterval; this only ever asks, never guarantees.
const TAG = 'telos-due-date-check';
const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h — a hint, not a promise

export async function registerPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!('periodicSync' in registration)) return;
  try {
    const status = await navigator.permissions?.query({ name: 'periodic-background-sync' });
    if (status && status.state !== 'granted') return;
    await registration.periodicSync.register(TAG, { minInterval: MIN_INTERVAL_MS });
  } catch {
    // Best-effort only — an unsupported permission name (Firefox), a
    // rejected registration, etc. all just leave the foreground-only path active.
  }
}

export async function unregisterPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!('periodicSync' in registration)) return;
  try {
    await registration.periodicSync.unregister(TAG);
  } catch {
    // no-op — nothing to clean up if it was never registered
  }
}
