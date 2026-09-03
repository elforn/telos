// Service-tier component (invisible, mirrors sw-manager/db-init) — the
// foreground half of the day-before/today/overdue notification digest (see
// CLAUDE.md and the original design pass). Checks on boot and whenever the
// app resumes (visibilitychange -> visible), fires at most one grouped
// notification per calendar day, and only when the user has explicitly
// opted in (app/utils/notification-prefs.js) and actually granted OS/
// browser permission. Never calls Notification.requestPermission() itself —
// that only ever happens from the settings toggle's own click, a real user
// gesture (see bottom-nav.js).
//
// The enabled/permission check happens fresh inside _checkAndNotify() on
// every call, not as a one-time gate on whether the visibilitychange
// listener even attaches — the toggle is a localStorage preference with no
// store-style watch() to react to, so re-reading it live is what lets
// turning notifications on in Settings take effect on the very next
// check (see refresh(), which bottom-nav.js calls immediately after the
// toggle flips) rather than requiring a reload.
//
// This is the reliable, universal half. app/sw-extensions.js adds a
// Chrome-only, best-effort periodicSync layer on top that can fire even
// while the app isn't open at all — this component's job is just "don't
// miss it on the very next open," which works on every browser.
import { AppElement } from '../../../_lib/core/app-element.js';
import { getState } from '../../../_lib/core/store/store.js';
import { todayISO } from '../../utils/today-iso.js';
import { notificationsEnabled } from '../../utils/notification-prefs.js';
import { lastNotifiedDate, markNotifiedToday } from '../../utils/notification-dedup.js';
import { collectUpcoming } from '../../utils/upcoming.js';
import { buildDigest } from '../../utils/notification-digest.js';

class DueDateNotifier extends AppElement {
  template() {
    return '';
  }

  subscribe() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    this._checkAndNotify();
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') this._checkAndNotify();
    });
  }

  // Public: called right after the Settings toggle turns notifications on,
  // so the very first check happens immediately rather than waiting for
  // the next natural resume.
  refresh() {
    this._checkAndNotify();
  }

  async _checkAndNotify() {
    if (!notificationsEnabled() || Notification.permission !== 'granted') return;
    // A resume can fire visibilitychange again before the previous check's
    // own IDB round-trip finishes — without this, both would still see
    // "not notified yet" and could both fire.
    if (this._checking) return;
    this._checking = true;
    try {
      const today = todayISO();
      const last = await lastNotifiedDate();
      if (last === today) return; // already notified today — foreground or background, doesn't matter which

      const digest = buildDigest(collectUpcoming(getState()));
      if (!digest) return;

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(digest.title, {
        body: digest.body,
        tag: 'telos-digest', // replaces any still-showing digest rather than stacking
      });
      await markNotifiedToday(today);
    } catch (err) {
      // Never fatal to the app — a missed notification isn't worth surfacing as an error to the user.
      console.error('Due-date notification check failed:', err);
    } finally {
      this._checking = false;
    }
  }
}

customElements.define('due-date-notifier', DueDateNotifier);
