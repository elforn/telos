const SW_LOOP_WINDOW_MS = 15_000;
const SERVER_CHECK_TIMEOUT_MS = 5_000;
const RELOAD_AT_KEY = 'socle:swReloadAt';

// Called by sw-manager on every controller change that triggers a reload,
// so the next session can detect whether an update-available notification
// arrives suspiciously soon after that reload (= poisoned-cache loop).
export function recordControllerChange() {
  try { sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now())); } catch {}
}

// Returns true if updateAvailable fired within SW_LOOP_WINDOW_MS of a SW-triggered reload.
// A poisoned cache causes the browser to keep installing the same bad update every time
// the app loads, so the update notification appears almost immediately after the reload.
export function isUpdateLoop() {
  const lastReload = parseInt(sessionStorage.getItem(RELOAD_AT_KEY) || '0', 10);
  return lastReload > 0 && (Date.now() - lastReload) < SW_LOOP_WINDOW_MS;
}

export function clearLoopMarker() {
  try { sessionStorage.removeItem(RELOAD_AT_KEY); } catch {}
}

// Repair a poisoned SW installation: verify connectivity, optionally back up data,
// then clear all caches and unregister all SWs before reloading to a clean state.
//
// checkServer: verify the server is reachable before clearing caches — without both
//   a cache and a network the app becomes completely inaccessible. Skip when called
//   from loop detection, since a SW update confirmed connectivity moments ago.
// onBackup: async callback to export/save data before clearing (non-fatal if it throws).
export async function repairInstallation({ basePath = '/', onBackup, checkServer = true } = {}) {
  if (checkServer) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), SERVER_CHECK_TIMEOUT_MS);
      const r = await fetch(`${basePath}version.json?_=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) return;
    } catch {
      return; // offline or server down — leave the cached app intact
    }
  }
  if (onBackup) {
    // Backup failure is non-fatal — repair proceeds without it rather than blocking the user.
    try { await onBackup(); } catch (err) { console.error('Backup before repair failed:', err); }
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  } catch {}
  location.replace(basePath);
}
