// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { notifyAfterHour, setNotifyAfterHour } from '../../app/utils/notification-prefs.js';

beforeEach(() => localStorage.clear());

// The on/off notifications preference itself moved to Socle's
// NotificationPrefs (_lib/modules/notifications/notification-prefs.js,
// covered by its own test there) — this file now only owns the hour-gate.
describe('notifyAfterHour', () => {
  it('defaults to null (no restriction) when never set', () => {
    expect(notifyAfterHour()).toBeNull();
  });

  it('setNotifyAfterHour(hour) persists and reads back that hour', () => {
    setNotifyAfterHour(9);
    expect(notifyAfterHour()).toBe(9);
  });

  it('setNotifyAfterHour(null) clears back to no restriction', () => {
    setNotifyAfterHour(9);
    setNotifyAfterHour(null);
    expect(notifyAfterHour()).toBeNull();
  });

  it('treats an out-of-range or corrupt stored value as no restriction', () => {
    localStorage.setItem('telos:notifyAfterHour', '99');
    expect(notifyAfterHour()).toBeNull();
    localStorage.setItem('telos:notifyAfterHour', 'not-a-number');
    expect(notifyAfterHour()).toBeNull();
  });

  it('accepts the full 0–23 range, including midnight', () => {
    setNotifyAfterHour(0);
    expect(notifyAfterHour()).toBe(0);
    setNotifyAfterHour(23);
    expect(notifyAfterHour()).toBe(23);
  });
});
