// Device-local opt-in preference for OS/browser notifications — deliberately
// localStorage, not a store key. Whether notifications are wanted is a
// property of this browser install, not app data to export/import or carry
// across devices (same reasoning as theme/locale). Holding a "wants
// notifications" bit here is not the same as having permission — callers
// must still check the live `Notification.permission` before firing, since a
// browser-level revoke can happen outside the app at any time.
export function NotificationPrefs(storageKey) {
  return {
    enabled() {
      return localStorage.getItem(storageKey) === 'true';
    },
    setEnabled(value) {
      localStorage.setItem(storageKey, String(!!value));
    },
  };
}
