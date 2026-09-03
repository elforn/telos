// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { notificationsEnabled, setNotificationsEnabled } from '../../app/utils/notification-prefs.js';

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
