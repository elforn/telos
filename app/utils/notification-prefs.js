// Device-local preference — deliberately localStorage, not a store key,
// same reasoning as theme/locale (see CLAUDE.md) and the existing
// export-reminder toggle this mirrors: whether notifications are wanted is
// a property of *this browser install*, not app data to export/import or
// carry across devices. Opt-in default (unlike the reminder toggle, which
// defaults on) — notifications also require an explicit OS/browser
// permission grant, so there's nothing to show until the user deliberately
// turns this on.
const KEY = 'telos:notificationsEnabled';

export function notificationsEnabled() {
  return localStorage.getItem(KEY) === 'true';
}

export function setNotificationsEnabled(value) {
  localStorage.setItem(KEY, String(!!value));
}

// Same device-local reasoning as above. null (the default, absent key) means
// "no restriction" — the digest check can fire at any hour, the original
// behaviour every existing install already has. A 0–23 integer means "don't
// fire the foreground digest check before this local hour" — checked in
// due-date-notifier.js against new Date().getHours() on every boot/resume,
// so it doesn't cost a missed day, just delays that day's first successful
// check. Deliberately not applied to the Chrome-only best-effort periodicSync
// layer (app/sw-extensions.js) — that layer's own firing cadence is already
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
