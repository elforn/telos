// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationPrefs } from './notification-prefs.js';

const KEY = 'test:notificationsEnabled';

beforeEach(() => localStorage.clear());

describe('NotificationPrefs', () => {
  it('defaults to disabled when nothing stored', () => {
    const prefs = NotificationPrefs(KEY);
    expect(prefs.enabled()).toBe(false);
  });

  it('persists enabled state across instances', () => {
    NotificationPrefs(KEY).setEnabled(true);
    expect(NotificationPrefs(KEY).enabled()).toBe(true);
  });

  it('can be turned back off', () => {
    const prefs = NotificationPrefs(KEY);
    prefs.setEnabled(true);
    prefs.setEnabled(false);
    expect(prefs.enabled()).toBe(false);
  });

  it('scopes to the given storage key', () => {
    NotificationPrefs('a').setEnabled(true);
    expect(NotificationPrefs('b').enabled()).toBe(false);
  });
});
