// The app-specific half of the notification digest — everything Socle's
// notifications module (_lib/modules/notifications/) has no opinion on.
// Passed as `<digest-notifier>`'s buildDigest property (see app/main.js);
// the module calls this with the store's current state on every check.
import { collectUpcoming, collectHiddenUrgent } from './upcoming.js';
import { buildDigest as buildDigestText } from './notification-digest.js';
import { notifyAfterHour } from './notification-prefs.js';

export function buildDigest(state) {
  // Settings-configurable "don't notify before this hour" gate. Checked
  // fresh on every call (not just once) so turning it off, or the clock
  // crossing the hour, takes effect on the very next resume rather than
  // requiring a reload. A day that's gated out isn't marked notified — see
  // digest-notifier.js — so the next resume after the hour still fires
  // normally.
  const hour = notifyAfterHour();
  if (hour !== null && new Date().getHours() < hour) return null;

  // hiddenCount normally just rides along as an extra clause on the digest
  // buildDigestText builds — it has one exception (a minimal digest from
  // hiddenCount alone when the visible total is 0, so the Hidden-items
  // dialog stays discoverable even then; see its own doc for why).
  const hiddenCount = collectHiddenUrgent(state).length;
  return buildDigestText(collectUpcoming(state), hiddenCount);
}
