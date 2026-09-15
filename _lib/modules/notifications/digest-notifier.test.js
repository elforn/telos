// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { boot, reset } from '../../core/store/store.js';
import './digest-notifier.js';
import { NotificationPrefs } from './notification-prefs.js';
import { NotificationDedup } from './notification-dedup.js';

const reducer = s => s ?? {};

let dbSeq = 0;
function freshName() { return `digest-notifier-test-${dbSeq++}`; }

function stubNotification(permission) {
  vi.stubGlobal('Notification', { permission });
}

function stubServiceWorker(showNotification = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ showNotification }) },
    configurable: true,
  });
  return showNotification;
}

function mount({ enabled = true, buildDigest = () => ({ title: 'T', body: 'B' }) } = {}) {
  const el = document.createElement('digest-notifier');
  const prefs = NotificationPrefs(`test:prefs-${dbSeq}`);
  prefs.setEnabled(enabled);
  el.prefs = prefs;
  el.dedup = NotificationDedup(freshName());
  el.buildDigest = buildDigest;
  document.body.appendChild(el);
  return el;
}

beforeEach(async () => {
  reset();
  await boot({ dbName: `digest-notifier-store-${dbSeq++}`, reducer });
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  reset();
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
});

describe('digest-notifier', () => {
  it('does nothing when disabled', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount({ enabled: false });
    await new Promise(r => setTimeout(r, 30));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does nothing when permission was never granted', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('default');
    mount();
    await new Promise(r => setTimeout(r, 30));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does nothing when buildDigest returns null', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount({ buildDigest: () => null });
    await new Promise(r => setTimeout(r, 30));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('fires the digest buildDigest returns, on mount, when enabled and granted', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount({ buildDigest: () => ({ title: 'Hello', body: 'World' }) });
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification).toHaveBeenCalledWith('Hello', { body: 'World', tag: 'socle-digest' });
  });

  it('uses a custom tag when set', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    const el = mount();
    el.tag = 'my-app-digest';
    el.refresh();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification.mock.calls[0][1].tag).toBe('my-app-digest');
  });

  it('does not fire twice in the same day, even across two mounts sharing the same dedup DB', async () => {
    const dbName = freshName();
    const showNotification = stubServiceWorker();
    stubNotification('granted');

    const el1 = document.createElement('digest-notifier');
    el1.prefs = NotificationPrefs(`test:prefs-${dbSeq}`);
    el1.prefs.setEnabled(true);
    el1.dedup = NotificationDedup(dbName);
    el1.buildDigest = () => ({ title: 'T', body: 'B' });
    document.body.appendChild(el1);
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));

    document.body.innerHTML = '';
    const el2 = document.createElement('digest-notifier');
    el2.prefs = el1.prefs;
    el2.dedup = NotificationDedup(dbName);
    el2.buildDigest = () => ({ title: 'T', body: 'B' });
    document.body.appendChild(el2);
    await new Promise(r => setTimeout(r, 30));
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('refresh() re-checks immediately, picking up a preference that only just turned on', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    const el = mount({ enabled: false });
    await new Promise(r => setTimeout(r, 20));
    expect(showNotification).not.toHaveBeenCalled();

    el.prefs.setEnabled(true);
    el.refresh();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  });

  it('re-checks on visibilitychange -> visible, not just on mount', async () => {
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    let ready = false;
    mount({ buildDigest: () => (ready ? { title: 'T', body: 'B' } : null) });
    await new Promise(r => setTimeout(r, 20));
    expect(showNotification).not.toHaveBeenCalled();

    ready = true;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  });

  it('does nothing when the Notification API is unavailable', async () => {
    stubServiceWorker();
    expect(() => mount()).not.toThrow();
  });
});
