// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { notificationsEnabled, setNotificationsEnabled, notifyAfterHour, setNotifyAfterHour } from '../../app/utils/notification-prefs.js';

beforeEach(() => localStorage.clear());

describe('notification-prefs', () => {
  it('defaults to disabled when never set — opt-in, unlike the export reminder', () => {
    expect(notificationsEnabled()).toBe(false);
  });

  it('setNotificationsEnabled(true) persists and reads back true', () => {
    setNotificationsEnabled(true);
    expect(notificationsEnabled()).toBe(true);
  });

  it('setNotificationsEnabled(false) persists and reads back false', () => {
    setNotificationsEnabled(true);
    setNotificationsEnabled(false);
    expect(notificationsEnabled()).toBe(false);
  });

  it('stores as the literal string "true"/"false" under the documented key', () => {
    setNotificationsEnabled(true);
    expect(localStorage.getItem('telos:notificationsEnabled')).toBe('true');
    setNotificationsEnabled(false);
    expect(localStorage.getItem('telos:notificationsEnabled')).toBe('false');
  });
});

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
