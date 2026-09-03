// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { boot, setState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/components/due-date-notifier/due-date-notifier.js';
import { setNotificationsEnabled } from '../../app/utils/notification-prefs.js';
import { lastNotifiedDate } from '../../app/utils/notification-dedup.js';

let dbSeq = 0;
function freshName() { return `due-date-notifier-test-${dbSeq++}`; }

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

function mount() {
  const el = document.createElement('due-date-notifier');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase('telos-notifications');
  req.onsuccess = resolve;
  req.onerror = () => reject(req.error);
  req.onblocked = resolve;
}));

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  reset();
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
});

describe('due-date-notifier', () => {
  it('does nothing on mount when notifications are disabled (the default)', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, lists: [] } });
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount();
    await vi.waitFor(() => expect(showNotification).not.toHaveBeenCalled());
    expect(await lastNotifiedDate()).toBeNull();
  });

  it('does nothing when enabled but permission was never granted', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, lists: [] } });
    setNotificationsEnabled(true);
    const showNotification = stubServiceWorker();
    stubNotification('default');
    mount();
    await vi.waitFor(() => expect(showNotification).not.toHaveBeenCalled());
  });

  it('fires a digest notification on mount when enabled, granted, and something is overdue', async () => {
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    await boot({
      dbName: freshName(),
      initialState: {
        goals: { '2026': { capstone: [{ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 }, dueDate: yesterday }], milestones: [], wow: [] } },
        lists: [],
      },
    });
    setNotificationsEnabled(true);
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification.mock.calls[0][0]).toBe('1 items need attention');
  });

  it('does not fire twice in the same day, even across two mounts', async () => {
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    await boot({
      dbName: freshName(),
      initialState: {
        goals: { '2026': { capstone: [{ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 }, dueDate: yesterday }], milestones: [], wow: [] } },
        lists: [],
      },
    });
    setNotificationsEnabled(true);
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));

    document.body.innerHTML = ''; // simulate the page reloading (a fresh component instance)
    mount();
    await new Promise(r => setTimeout(r, 50)); // give the second check a moment to (not) fire
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('fires nothing when there is nothing overdue/due today/due tomorrow', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, lists: [] } });
    setNotificationsEnabled(true);
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount();
    await new Promise(r => setTimeout(r, 50));
    expect(showNotification).not.toHaveBeenCalled();
    expect(await lastNotifiedDate()).toBeNull(); // never marked — nothing was actually shown
  });

  it('refresh() re-checks immediately, picking up a preference that only just turned on', async () => {
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    await boot({
      dbName: freshName(),
      initialState: {
        goals: { '2026': { capstone: [{ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 }, dueDate: yesterday }], milestones: [], wow: [] } },
        lists: [],
      },
    });
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    const el = mount(); // notifications still off at mount time
    await new Promise(r => setTimeout(r, 20));
    expect(showNotification).not.toHaveBeenCalled();

    setNotificationsEnabled(true); // toggled on afterwards, same as the Settings flow
    el.refresh();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  });

  it('re-checks on visibilitychange -> visible, not just on mount', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, lists: [] } });
    setNotificationsEnabled(true);
    const showNotification = stubServiceWorker();
    stubNotification('granted');
    mount();
    await new Promise(r => setTimeout(r, 20));
    expect(showNotification).not.toHaveBeenCalled(); // nothing due yet

    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    setState('goals', { '2026': { capstone: [{ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 }, dueDate: yesterday }], milestones: [], wow: [] } });

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  });
});
