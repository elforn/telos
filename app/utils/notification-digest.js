// Builds the notification's title/body from collectUpcoming()'s own buckets
// (app/utils/upcoming.js) — the exact same overdue/today/tomorrow split the
// Upcoming dialog and bell badge already show, so the notification never
// disagrees with what tapping it reveals. One grouped digest per check, not
// one notification per item — deliberately, per the original design pass:
// a notification for every single overdue goal would be spam.
import { t } from '../../_lib/core/strings.js';

// Returns null when there's nothing to show at all — callers should skip
// firing a notification entirely in that case, not show an empty one.
//
// `hiddenCount` (from collectHiddenUrgent — overdue/today items in a
// currently-suppressed year/list, see deadline-visibility.js) normally rides
// along as an extra clause on an already-firing digest, never a trigger on
// its own — a year/list with deadlines turned off is a deliberate "don't nag
// me about this" choice, and surfacing a notification purely because
// something's hidden would undermine that. The one exception: when the
// visible total is 0, this is the only *proactive* nudge that still exists —
// bottom-nav.js's bell stays reachable in that state too (no numeric badge,
// but not hidden either — see its own comment), but a badge-less bell icon
// is easy to never notice or think to tap. Without this fallback, a
// year/list going fully hidden would mean the Hidden-items modal is only
// ever found by chance, not proactively surfaced at all — so this one case
// still fires, with a minimal body naming only the hidden count, not the
// normal per-bucket breakdown.
// Tomorrow is deliberately never mentioned here, even though collectUpcoming
// still returns it — an OS-level push is for what needs attention now
// (overdue/today), same split upcomingBadgeCount already uses for the bell
// badge's own number. A day with only "tomorrow" items and nothing overdue
// or due today produces no notification at all; the heads-up stays an
// in-app-only concern (the icon, the Upcoming dialog), not something worth
// interrupting the user for.
export function buildDigest({ overdue, today }, hiddenCount = 0) {
  const total = (overdue?.length ?? 0) + (today?.length ?? 0);
  if (total === 0 && hiddenCount === 0) return null;

  if (total === 0) {
    return {
      title: t('notifications.digest-hidden-only-title', { count: hiddenCount }),
      body: t('notifications.digest-hidden-only-body'),
    };
  }

  const parts = [];
  if (overdue?.length)  parts.push(t('notifications.digest-overdue',  { count: overdue.length }));
  if (today?.length)    parts.push(t('notifications.digest-today',    { count: today.length }));
  if (hiddenCount > 0)  parts.push(t('notifications.digest-hidden',   { count: hiddenCount }));

  return {
    title: t('notifications.digest-title', { count: total }),
    body: parts.join(' · '),
  };
}
