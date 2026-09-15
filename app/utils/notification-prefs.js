// Device-local "don't notify before this hour" gate — deliberately
// localStorage, not a store key, same reasoning as theme/locale (see
// CLAUDE.md). The on/off notifications preference itself now lives in
// Socle's notifications module (NotificationPrefs,
// _lib/modules/notifications/notification-prefs.js) — this file is only
// what that module has no opinion on.
//
// null (the default, absent key) means "no restriction" — the digest check
// can fire at any hour, the original behaviour every existing install
// already has. A 0–23 integer means "don't fire the foreground digest check
// before this local hour" — checked in app/utils/build-telos-digest.js
// against new Date().getHours() on every boot/resume, so it doesn't cost a
// missed day, just delays that day's first successful check. Deliberately
// not applied to the Chrome-only best-effort periodicSync layer
// (app/sw-extensions.js) — that layer's own firing cadence is already
// outside our control, so gating it the same way risks the opposite of the
// intent (skip a rare background tick just before the hour, then not get
// another one until well after).
const HOUR_KEY = 'telos:notifyAfterHour';

export function notifyAfterHour() {
  const raw = localStorage.getItem(HOUR_KEY);
  if (raw === null) return null;
  const hour = Number(raw);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export function setNotifyAfterHour(hour) {
  if (hour === null || hour === undefined) {
    localStorage.removeItem(HOUR_KEY);
    return;
  }
  localStorage.setItem(HOUR_KEY, String(hour));
}
