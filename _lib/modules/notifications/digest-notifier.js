// Service-tier component (invisible, mirrors sw-manager/db-init) — the
// foreground half of an opt-in digest notification. Checks on boot and
// whenever the app resumes (visibilitychange -> visible), and fires at most
// one notification per calendar day via the injected `dedup`. Never calls
// Notification.requestPermission() itself — that only works fired
// synchronously from a real user gesture, so it must happen from the
// consuming app's own settings-toggle click handler, never from here.
//
// buildDigest, dedup and prefs are properties (not attributes) set
// imperatively after creation, since a function/object can't be expressed as
// an HTML attribute. buildDigest(state) => { title, body } | null is
// entirely the app's concern — this component has no opinion on what the
// digest is about.
import { AppElement } from '../../core/app-element.js';
import { getState } from '../../core/store/store.js';

class DigestNotifier extends AppElement {
  template() {
    return '';
  }

  subscribe() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    this._check();
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') this._check();
    });
  }

  // Public: call right after the user turns notifications on, so the first
  // check happens immediately rather than waiting for the next resume.
  refresh() {
    this._check();
  }

  async _check() {
    if (!this.prefs?.enabled() || Notification.permission !== 'granted') return;
    // A resume can fire visibilitychange again before the previous check's
    // own IDB round-trip finishes — without this, both would still see
    // "not notified yet" and could both fire.
    if (this._checking) return;
    this._checking = true;
    try {
      if (await this.dedup.alreadyNotifiedToday()) return;

      const digest = this.buildDigest?.(getState());
      if (!digest) return;

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(digest.title, {
        body: digest.body,
        tag: this.tag ?? 'socle-digest', // replaces any still-showing digest rather than stacking
      });
      await this.dedup.markNotifiedToday();
    } catch (err) {
      // Never fatal to the app — a missed notification isn't worth surfacing as an error.
      console.error('Digest notification check failed:', err);
    } finally {
      this._checking = false;
    }
  }
}

customElements.define('digest-notifier', DigestNotifier);
