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
