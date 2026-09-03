// Builds the notification's title/body from collectUpcoming()'s own buckets
// (app/utils/upcoming.js) — the exact same overdue/today/tomorrow split the
// Upcoming dialog and bell badge already show, so the notification never
// disagrees with what tapping it reveals. One grouped digest per check, not
// one notification per item — deliberately, per the original design pass:
// a notification for every single overdue goal would be spam.
import { t } from '../../_lib/core/strings.js';

// Returns null when there's nothing to show — callers should skip firing a
// notification entirely in that case, not show an empty one.
export function buildDigest({ overdue, today, tomorrow }) {
  const total = (overdue?.length ?? 0) + (today?.length ?? 0) + (tomorrow?.length ?? 0);
  if (total === 0) return null;

  const parts = [];
  if (overdue?.length)  parts.push(t('notifications.digest-overdue',  { count: overdue.length }));
  if (today?.length)    parts.push(t('notifications.digest-today',    { count: today.length }));
  if (tomorrow?.length) parts.push(t('notifications.digest-tomorrow', { count: tomorrow.length }));

  return {
    title: t('notifications.digest-title', { count: total }),
    body: parts.join(' · '),
  };
}
