// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../app/strings.js';

vi.mock('../../_lib/core/router/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../_lib/core/sw-manager/sw-repair.js', () => ({ repairInstallation: vi.fn() }));
vi.mock('../../app/utils/backup-before-repair.js', () => ({
  backupBeforeRepair: vi.fn(),
  LAST_EXPORT_KEY: 'telos:lastExportedAt',
}));

import '../../app/components/bottom-nav/bottom-nav.js';
import { boot, setState, getState } from '../../_lib/core/store/store.js';
import { navigate } from '../../_lib/core/router/router.js';
import { repairInstallation } from '../../_lib/core/sw-manager/sw-repair.js';
import { backupBeforeRepair } from '../../app/utils/backup-before-repair.js';
import * as syncModule from '../../_lib/modules/sync/sync.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

// happy-dom does not implement ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

// Silence the version.json fetch — caught internally by .catch(() => {})
globalThis.fetch = () => Promise.reject(new Error('no network in tests'));

function stubModals(el) {
  for (const id of ['#settings-modal', '#import-modal', '#handoff-list-picker']) {
    const m = el.shadowRoot.querySelector(id);
    if (m) { m.show = vi.fn(); m.close = vi.fn(); }
  }
  // import-text-dialog exposes open()/no bare show()/close() — stub its inner
  // modal-dialog instead, same pattern as import-text-dialog's own tests.
  const shareTextModal = el.shadowRoot.querySelector('#share-text-dialog')?.shadowRoot.querySelector('#modal');
  if (shareTextModal) { shareTextModal.show = vi.fn(); shareTextModal.close = vi.fn(); }
}

function mount() {
  const el = document.createElement('bottom-nav');
  document.body.appendChild(el);
  stubModals(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.clearAllMocks(); });

// ── Structure ─────────────────────────────────────────────────────────────────

describe('bottom-nav — structure', () => {
  it('renders Years and Lists nav pills', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#pill-years')).not.toBeNull();
    expect(el.shadowRoot.querySelector('#pill-lists')).not.toBeNull();
  });

  it('renders a gear button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-btn')).not.toBeNull();
  });

  it('renders three theme option pills', () => {
    const el = mount();
    expect(el.shadowRoot.querySelectorAll('[data-theme]').length).toBe(3);
  });

  it('renders three locale option pills', () => {
    const el = mount();
    expect(el.shadowRoot.querySelectorAll('[data-locale]').length).toBe(3);
  });
});

// ── Nav pill active state ─────────────────────────────────────────────────────
// _updateActive() reads window.location.pathname, so tests must use
// history.pushState to actually change the URL before dispatching navigate.

function navTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
}

describe('bottom-nav — active state', () => {
  it('Years pill is active by default (not on a lists path)', () => {
    navTo('/2026');
    const el = mount();
    expect(el.shadowRoot.querySelector('#pill-years').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#pill-lists').classList.contains('active')).toBe(false);
  });

  it('Lists pill becomes active after navigating to /lists', () => {
    const el = mount();
    navTo('/lists');
    expect(el.shadowRoot.querySelector('#pill-lists').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#pill-years').classList.contains('active')).toBe(false);
  });

  it('Years pill returns to active after navigating back to a year', () => {
    const el = mount();
    navTo('/lists');
    navTo('/2026');
    expect(el.shadowRoot.querySelector('#pill-years').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#pill-lists').classList.contains('active')).toBe(false);
  });

  it('Lists pill is active when mounted while already on a lists path', () => {
    navTo('/lists/abc123');
    const el = mount();
    expect(el.shadowRoot.querySelector('#pill-lists').classList.contains('active')).toBe(true);
  });
});

// ── Settings pills ────────────────────────────────────────────────────────────
// _updateSettingsPills() runs when the settings modal is opened, not on mount

describe('bottom-nav — settings pills', () => {
  it('exactly one theme pill is active after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const active = [...el.shadowRoot.querySelectorAll('[data-theme]')]
      .filter(b => b.classList.contains('active'));
    expect(active).toHaveLength(1);
  });

  it('exactly one locale pill is active after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const active = [...el.shadowRoot.querySelectorAll('[data-locale]')]
      .filter(b => b.classList.contains('active'));
    expect(active).toHaveLength(1);
  });

  it('gear button click calls show() on the settings modal', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    expect(el.shadowRoot.querySelector('#settings-modal').show).toHaveBeenCalledOnce();
  });
});

// ── aria-current on nav pills ─────────────────────────────────────────────────

describe('bottom-nav — aria-current', () => {
  it('Years pill has aria-current="page" when on a year path', () => {
    navTo('/2026');
    const el = mount();
    expect(el.shadowRoot.querySelector('#pill-years').getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot.querySelector('#pill-lists').getAttribute('aria-current')).toBe('false');
  });

  it('Lists pill has aria-current="page" when on /lists', () => {
    navTo('/lists');
    const el = mount();
    expect(el.shadowRoot.querySelector('#pill-lists').getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot.querySelector('#pill-years').getAttribute('aria-current')).toBe('false');
  });

  it('aria-current updates when navigating between sections', () => {
    const el = mount();
    navTo('/lists');
    expect(el.shadowRoot.querySelector('#pill-lists').getAttribute('aria-current')).toBe('page');
    navTo('/2026');
    expect(el.shadowRoot.querySelector('#pill-years').getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot.querySelector('#pill-lists').getAttribute('aria-current')).toBe('false');
  });
});

// ── aria-pressed on settings pills ───────────────────────────────────────────

describe('bottom-nav — aria-pressed on settings pills', () => {
  it('active theme pill has aria-pressed="true" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const active = [...el.shadowRoot.querySelectorAll('[data-theme]')]
      .find(b => b.classList.contains('active'));
    expect(active?.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive theme pills have aria-pressed="false" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const inactive = [...el.shadowRoot.querySelectorAll('[data-theme]')]
      .filter(b => !b.classList.contains('active'));
    expect(inactive.every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('active locale pill has aria-pressed="true" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const active = [...el.shadowRoot.querySelectorAll('[data-locale]')]
      .find(b => b.classList.contains('active'));
    expect(active?.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive locale pills have aria-pressed="false" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const inactive = [...el.shadowRoot.querySelectorAll('[data-locale]')]
      .filter(b => !b.classList.contains('active'));
    expect(inactive.every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('active reminder pill has aria-pressed="true" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const active = [...el.shadowRoot.querySelectorAll('[data-reminder]')]
      .find(b => b.classList.contains('active'));
    expect(active?.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive reminder pills have aria-pressed="false" after opening settings', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const inactive = [...el.shadowRoot.querySelectorAll('[data-reminder]')]
      .filter(b => !b.classList.contains('active'));
    expect(inactive.every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });
});

// ── Lists path memory ─────────────────────────────────────────────────────────

describe('bottom-nav — lists path memory', () => {
  it('Lists pill is active after navigating to a list-detail path', () => {
    const el = mount();
    navTo('/lists/abc123');
    expect(el.shadowRoot.querySelector('#pill-lists').classList.contains('active')).toBe(true);
  });
});

// ── Scroll position helpers ───────────────────────────────────────────────────

// ── Year pill navigation ──────────────────────────────────────────────────────

describe('bottom-nav — year pill navigation', () => {
  it('scrolls to top when Years pill is tapped while already on today\'s year', () => {
    const year = new Date().getFullYear();
    navTo(`/${year}`);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    el._onPillYears();
    expect(navigate).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('saves scroll and navigates to today\'s year when tapped from a different year', () => {
    navTo('/2020');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    const saveSpy = vi.spyOn(el, '_saveScroll');
    el._onPillYears();
    expect(saveSpy).toHaveBeenCalledWith('/2020');
    expect(navigate).toHaveBeenCalledWith(`/${new Date().getFullYear()}`);
  });
});

// ── Year navigate scroll restoration ─────────────────────────────────────────

describe('bottom-nav — year navigate scroll restoration', () => {
  it('restores saved scroll position when a navigate event lands on a year path', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    el._scrollPositions['/2026'] = 350;
    navTo('/2026');
    expect(scrollTo).toHaveBeenCalledWith(0, 350);
  });

  it('restores to 0 when navigating to a year with no saved scroll position', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mount();
    navTo('/2025');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// ── Scroll position helpers ───────────────────────────────────────────────────

describe('bottom-nav — scroll position helpers', () => {
  it('_saveScroll stores current window.scrollY for the given path', () => {
    const el = mount();
    el._saveScroll('/lists');
    expect(el._scrollPositions['/lists']).toBe(window.scrollY);
  });

  it('_restoreScroll calls scrollTo with the saved position', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    el._scrollPositions['/2026'] = 200;
    el._restoreScroll('/2026');
    expect(scrollTo).toHaveBeenCalledWith(0, 200);
  });

  it('_restoreScroll defaults to 0 when no saved position exists for path', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    el._restoreScroll('/unknown-path');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// ── Export reminder ───────────────────────────────────────────────────────────

const LAST_EXPORT_KEY     = 'telos:lastExportedAt';
const EXPORT_REMINDER_KEY = 'telos:exportReminderEnabled';

describe('bottom-nav — export reminder: _shouldShowExportReminder', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() =>  localStorage.clear());

  it('returns true when no export has ever been made', () => {
    const el = mount();
    expect(el._shouldShowExportReminder()).toBe(true);
  });

  it('returns false when the reminder is explicitly disabled', () => {
    localStorage.setItem(EXPORT_REMINDER_KEY, 'false');
    const el = mount();
    expect(el._shouldShowExportReminder()).toBe(false);
  });

  it('returns false when the last export was less than 30 days ago', () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 5 * 24 * 60 * 60 * 1000));
    const el = mount();
    expect(el._shouldShowExportReminder()).toBe(false);
  });

  it('returns true when the last export was more than 30 days ago', () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now() - 31 * 24 * 60 * 60 * 1000));
    const el = mount();
    expect(el._shouldShowExportReminder()).toBe(true);
  });
});

describe('bottom-nav — export reminder: _markExported', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() =>  localStorage.clear());

  it('writes the current timestamp to localStorage', () => {
    const before = Date.now();
    const el = mount();
    el._markExported();
    const stored = parseInt(localStorage.getItem(LAST_EXPORT_KEY), 10);
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(Date.now());
  });

  it('_shouldShowExportReminder returns false immediately after _markExported', () => {
    const el = mount();
    el._markExported();
    expect(el._shouldShowExportReminder()).toBe(false);
  });
});

describe('bottom-nav — export reminder: badge visibility', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() =>  localStorage.clear());

  it('gear badge is visible on mount when no export has ever been made', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-badge').hidden).toBe(false);
  });

  it('export badge is visible on mount when no export has ever been made', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#export-badge').hidden).toBe(false);
  });

  it('gear badge is hidden when the last export was recent', () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-badge').hidden).toBe(true);
  });

  it('export badge is hidden when the last export was recent', () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    const el = mount();
    expect(el.shadowRoot.querySelector('#export-badge').hidden).toBe(true);
  });

  it('badges are hidden when the reminder is disabled even with no prior export', () => {
    localStorage.setItem(EXPORT_REMINDER_KEY, 'false');
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-badge').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#export-badge').hidden).toBe(true);
  });

  it('gear button has aria-description when the badge is visible', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-btn').hasAttribute('aria-description')).toBe(true);
  });

  it('gear button has no aria-description when the badge is hidden', () => {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    const el = mount();
    expect(el.shadowRoot.querySelector('#gear-btn').hasAttribute('aria-description')).toBe(false);
  });
});

describe('bottom-nav — export reminder: pill group', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() =>  localStorage.clear());

  it('Show pill is active by default when no value is stored', () => {
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const onPill  = el.shadowRoot.querySelector('[data-reminder="on"]');
    const offPill = el.shadowRoot.querySelector('[data-reminder="off"]');
    expect(onPill.classList.contains('active')).toBe(true);
    expect(offPill.classList.contains('active')).toBe(false);
  });

  it('clicking the Hide pill saves false to localStorage', () => {
    const el = mount();
    el.shadowRoot.querySelector('[data-reminder="off"]').click();
    expect(localStorage.getItem(EXPORT_REMINDER_KEY)).toBe('false');
  });

  it('clicking the Hide pill hides both badges', () => {
    const el = mount();
    el.shadowRoot.querySelector('[data-reminder="off"]').click();
    expect(el.shadowRoot.querySelector('#gear-badge').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#export-badge').hidden).toBe(true);
  });

  it('clicking the Show pill saves true to localStorage', () => {
    localStorage.setItem(EXPORT_REMINDER_KEY, 'false');
    const el = mount();
    el.shadowRoot.querySelector('[data-reminder="on"]').click();
    expect(localStorage.getItem(EXPORT_REMINDER_KEY)).toBe('true');
  });

  it('Hide pill is active when false is stored and settings are opened', () => {
    localStorage.setItem(EXPORT_REMINDER_KEY, 'false');
    const el = mount();
    el.shadowRoot.querySelector('#gear-btn').click();
    const onPill  = el.shadowRoot.querySelector('[data-reminder="on"]');
    const offPill = el.shadowRoot.querySelector('[data-reminder="off"]');
    expect(onPill.classList.contains('active')).toBe(false);
    expect(offPill.classList.contains('active')).toBe(true);
  });
});

// ── Repair (manual, via Settings) ───────────────────────────────────────────
// Loop-detected auto-repair lives entirely in <sw-manager> now (_lib); this button
// is the only repair path bottom-nav still owns.

describe('bottom-nav — repair button', () => {
  it('calls repairInstallation with the app basePath, backupBeforeRepair, and checkServer:true', () => {
    const el = mount();
    el.shadowRoot.querySelector('#repair-btn').click();
    expect(repairInstallation).toHaveBeenCalledWith({
      basePath: '/',
      onBackup: backupBeforeRepair,
      checkServer: true,
    });
  });

  it('closes the settings modal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#settings-modal');
    el.shadowRoot.querySelector('#repair-btn').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── Urgency roll-up ─────────────────────────────────────────────────────────

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const YEAR = new Date().getFullYear();
const yearGoals = goals => ({ [YEAR]: { capstone: goals, milestones: [], wow: [], focus: [] } });

describe('bottom-nav — urgency roll-up', () => {
  const yearsDot = el => el.shadowRoot.querySelector('#years-dot');
  const listsDot = el => el.shadowRoot.querySelector('#lists-dot');

  it('shows a red count on the Years pill for current-year goals due today/overdue', () => {
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(false);
    expect(yearsDot(el).dataset.urgency).toBe('overdue');
    expect(yearsDot(el).dataset.count).toBe('1');
  });

  it('a fully-complete goal with a past due date does not count as overdue on the Years pill', () => {
    // Regression: percentValue(goal) must gate urgency here, not a stale
    // `goal.percentage` read — a 100%-done goal is inactive regardless of
    // its due date (mirrors goal-item's own `active` computation).
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 100 }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
  });

  it('a partially-met frequency goal with a past due date still counts as overdue', () => {
    // A single entry only meets the current period, not the full 6-period
    // window — percentValue stays below 100, so this proves percentValue()
    // (not a stale flat field) is actually driving frequency goals here too.
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'weekly', target: 1, entries: [isoDaysFromNow(0)] }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(false);
  });

  it('a fully-met frequency goal (whole window) does not count as overdue', () => {
    const entries = [0, 1, 2, 3, 4, 5].map(w => isoDaysFromNow(-w * 7));
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'weekly', target: 1, entries }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
  });

  it('shows the Lists pill colour without a count for a green/yellow item', () => {
    setState('goals', {});
    setState('lists', [{ id: 'l', name: 'L', items: [{ id: 'i', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(5) }] }]);
    const el = mount();
    el.refreshUrgency();
    expect(listsDot(el).hidden).toBe(false);
    expect(listsDot(el).dataset.urgency).toBe('week');
    expect(listsDot(el).dataset.count).toBeUndefined();
  });

  it('ignores non-current-year goals on the Years pill', () => {
    setState('goals', { [YEAR - 1]: { capstone: [{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }], milestones: [], wow: [], focus: [] } });
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
  });

  it('hides both pills when nothing is due soon', () => {
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(90) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
    expect(listsDot(el).hidden).toBe(true);
  });

  it('mutes the Lists pill (not Years) when listsRollupVisible is false', () => {
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', [{ id: 'l', name: 'L', items: [{ id: 'i', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(-1) }] }]);
    setState('listsRollupVisible', false);
    const el = mount();
    el.refreshUrgency();
    expect(listsDot(el).hidden).toBe(true);
    expect(yearsDot(el).hidden).toBe(false);
    setState('listsRollupVisible', true);
  });

  it('restores the Lists pill when listsRollupVisible is toggled back on', () => {
    setState('lists', [{ id: 'l', name: 'L', items: [{ id: 'i', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(0) }] }]);
    setState('listsRollupVisible', false);
    const el = mount();
    el.refreshUrgency();
    expect(listsDot(el).hidden).toBe(true);
    setState('listsRollupVisible', true);
    expect(listsDot(el).hidden).toBe(false);
  });
});

describe('bottom-nav — app icon badge', () => {
  const realSetAppBadge = navigator.setAppBadge;
  const realClearAppBadge = navigator.clearAppBadge;

  afterEach(() => {
    navigator.setAppBadge = realSetAppBadge;
    navigator.clearAppBadge = realClearAppBadge;
  });

  it('calls setAppBadge with the combined urgent count', () => {
    navigator.setAppBadge = vi.fn().mockResolvedValue(undefined);
    navigator.clearAppBadge = vi.fn().mockResolvedValue(undefined);
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', [{ id: 'l', name: 'L', items: [{ id: 'i', title: 'x', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(0) }] }]);
    const el = mount();
    el.refreshUrgency();
    expect(navigator.setAppBadge).toHaveBeenCalledWith(2);
  });

  it('calls clearAppBadge when nothing is urgent', () => {
    navigator.setAppBadge = vi.fn().mockResolvedValue(undefined);
    navigator.clearAppBadge = vi.fn().mockResolvedValue(undefined);
    setState('goals', {});
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(navigator.clearAppBadge).toHaveBeenCalled();
  });

  it('logs (not throws) when setAppBadge rejects asynchronously', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    navigator.setAppBadge = vi.fn().mockRejectedValue(new Error('denied'));
    navigator.clearAppBadge = vi.fn().mockResolvedValue(undefined);
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    expect(() => { const el = mount(); el.refreshUrgency(); }).not.toThrow();
    await vi.waitFor(() => expect(consoleErr).toHaveBeenCalledWith('App badge update failed:', expect.any(Error)));
  });

  it('does nothing when setAppBadge is unsupported', () => {
    const original = navigator.setAppBadge;
    // eslint-disable-next-line no-param-reassign
    delete navigator.setAppBadge;
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-1) }]));
    expect(() => { const el = mount(); el.refreshUrgency(); }).not.toThrow();
    navigator.setAppBadge = original;
  });
});

// ── Slice-handoff import routing ──────────────────────────────────────────────

function fakeFile() { return new File([], 'shared.telos'); }

let sliceHandoffDbSeq = 0;

describe('bottom-nav — slice-handoff import routing', () => {
  beforeEach(async () => {
    // applyMerge() always calls getAllBlobs() (even with an empty blobs array), which
    // throws unless Store.boot() has run — this file otherwise never boots the store,
    // so without this these tests would silently depend on IDB state left behind by
    // whichever other test file the shared vitest worker (isolate: false) happened to
    // run beforehand. A fresh dbName per test keeps them isolated from each other too.
    await boot({ dbName: `bottom-nav-slice-handoff-${sliceHandoffDbSeq++}`, initialState: {} });
    setState('goals', {});
    setState('lists', []);
    vi.spyOn(syncModule, 'readImportFile').mockResolvedValue(new Uint8Array());
  });

  it('a plain full-backup file shows the generic Merge/Replace sheet', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple', payload: { goals: {}, lists: [] }, blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    expect(el.shadowRoot.querySelector('#import-merge').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#import-replace').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#goal-landing').hidden).toBe(true);
  });

  it('a list-kind handoff hides Replace but keeps Merge', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'list', lists: [{ id: 'l1', name: 'Groceries', items: [] }] },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    expect(el.shadowRoot.querySelector('#import-merge').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#import-replace').hidden).toBe(true);
  });

  it('a year-kind handoff hides Replace but keeps Merge, and merges via the generic goals path', async () => {
    const yearGoals = { capstone: [{ id: 'c1', title: 'Shared goal', tags: [], tracking: { type: 'percentage', value: 40 } }], milestones: [], wow: [], focus: [] };
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'year', goals: { '2027': yearGoals } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    expect(el.shadowRoot.querySelector('#import-merge').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#import-replace').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#goal-landing').hidden).toBe(true); // no picker needed — the year is already in the payload

    el.shadowRoot.querySelector('#import-merge').click();
    await vi.waitFor(() => {
      expect(getState().goals['2027'].capstone).toHaveLength(1);
      expect(getState().goals['2027'].capstone[0].title).toBe('Shared goal');
    });
  });

  it('an item-kind handoff opens the list picker instead of the generic sheet', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    const el = mount();
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    const modal  = el.shadowRoot.querySelector('#import-modal');
    await el._openImportFile(fakeFile());
    expect(picker.show).toHaveBeenCalledOnce();
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('picking an existing list for an item-kind handoff merges the item into it', async () => {
    setState('lists', [{ id: 'L1', name: 'Existing', items: [] }]);
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: ['L1'], newListName: null, copy: true } }));
    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.id === 'L1');
      expect(list.items).toHaveLength(1);
      expect(list.items[0].title).toBe('Milk');
      expect(list.items[0].id).not.toBe('i1'); // fresh id assigned on receipt
    });
  });

  it('typing a new list name for an item-kind handoff creates the list', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: [], newListName: 'Fresh List', copy: true } }));
    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.name === 'Fresh List');
      expect(list).toBeTruthy();
      expect(list.items[0].title).toBe('Milk');
    });
  });

  it('an items-kind (bulk selection) handoff opens the list picker instead of the generic sheet', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'items', items: [
        { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] },
        { id: 'i2', title: 'Eggs', status: 'open', tags: [], inGoals: [] },
      ] },
      blobs: [],
    });
    const el = mount();
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    const modal  = el.shadowRoot.querySelector('#import-modal');
    await el._openImportFile(fakeFile());
    expect(picker.show).toHaveBeenCalledOnce();
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('picking an existing list for an items-kind handoff merges all items into it with fresh ids', async () => {
    setState('lists', [{ id: 'L1', name: 'Existing', items: [] }]);
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'items', items: [
        { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] },
        { id: 'i2', title: 'Eggs', status: 'open', tags: [], inGoals: [] },
      ] },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: ['L1'], newListName: null, copy: true } }));
    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.id === 'L1');
      expect(list.items).toHaveLength(2);
      expect(list.items.map(i => i.title)).toEqual(['Milk', 'Eggs']);
      expect(list.items.map(i => i.id)).not.toEqual(['i1', 'i2']); // fresh ids assigned on receipt
    });
  });

  it('shows a pluralized confirmation toast when receiving multiple items', async () => {
    _resetToast();
    setState('lists', [{ id: 'L1', name: 'Existing', items: [] }]);
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'items', items: [
        { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] },
        { id: 'i2', title: 'Eggs', status: 'open', tags: [], inGoals: [] },
      ] },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: ['L1'], newListName: null, copy: true } }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toBe('Added 2 items.');
    });
  });

  it('a goal-kind handoff shows the year/section landing view, hiding Merge/Replace', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'goal', goal: { id: 'g1', title: 'Run a marathon', tags: [], tracking: { type: 'percentage', value: 0 } } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    expect(el.shadowRoot.querySelector('#goal-landing').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#import-goal-confirm').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#import-merge').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#import-replace').hidden).toBe(true);
    const yearSelect = el.shadowRoot.querySelector('#goal-landing-year-select');
    expect([...yearSelect.options].some(o => o.value === String(new Date().getFullYear()))).toBe(true);
  });

  it('confirming the goal landing merges the goal into the chosen year and section', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'goal', goal: { id: 'g1', title: 'Run a marathon', tags: [], tracking: { type: 'percentage', value: 0 } } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile());
    const yearSelect = el.shadowRoot.querySelector('#goal-landing-year-select');
    const opt = document.createElement('option');
    opt.value = '2027'; opt.textContent = '2027';
    yearSelect.appendChild(opt);
    yearSelect.value = '2027';
    el.shadowRoot.querySelector('input[name="handoff-goal-section"][value="wow"]').checked = true;
    el.shadowRoot.querySelector('#import-goal-confirm').click();
    await vi.waitFor(() => {
      const wow = getState().goals['2027']?.wow ?? [];
      expect(wow).toHaveLength(1);
      expect(wow[0].title).toBe('Run a marathon');
      expect(wow[0].id).not.toBe('g1'); // fresh id assigned on receipt
    });
  });

  it('shows an import-error message if merging the goal landing fails', async () => {
    _resetToast();
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'goal', goal: { id: 'g1', title: 'Run a marathon', tags: [], tracking: { type: 'percentage', value: 0 } } },
      blobs: [],
    });
    vi.spyOn(syncModule, 'applyMerge').mockRejectedValueOnce(new Error('boom'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = mount();
    await el._openImportFile(fakeFile());
    el.shadowRoot.querySelector('#import-goal-confirm').click();
    await vi.waitFor(() => {
      expect(el.shadowRoot.querySelector('#import-message').textContent).toBe('Invalid or incompatible export file.');
      expect(el.shadowRoot.querySelector('#import-close').hidden).toBe(false);
    });
    expect(consoleErr).toHaveBeenCalled();
  });

  it('toasts an error if merging a picked item-handoff list fails', async () => {
    _resetToast();
    setState('lists', [{ id: 'L1', name: 'Existing', items: [] }]);
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    vi.spyOn(syncModule, 'applyMerge').mockRejectedValueOnce(new Error('boom'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: ['L1'], newListName: null, copy: true } }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
    expect(consoleErr).toHaveBeenCalled();
  });

  it('does nothing if the list picker reports no target lists and no new list name', async () => {
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    const applyMergeSpy = vi.spyOn(syncModule, 'applyMerge');
    const el = mount();
    await el._openImportFile(fakeFile());
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: [], newListName: '', copy: true } }));
    await new Promise(r => setTimeout(r, 0));
    expect(applyMergeSpy).not.toHaveBeenCalled();
  });
});

// ── bottom-nav — Share Target text/URL landing ───────────────────────────────

let shareTextDbSeq = 0;

describe('bottom-nav — share-text landing', () => {
  beforeEach(async () => {
    await boot({ dbName: `bottom-nav-share-text-${shareTextDbSeq++}`, initialState: {} });
    setState('goals', {});
    setState('lists', []);
  });

  it('a telos-share-text event opens the dialog with the given text', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('#share-text-dialog');
    const openSpy = vi.spyOn(dialog, 'open');
    window.dispatchEvent(new CustomEvent('telos-share-text', { detail: { text: 'Shared text' } }));
    expect(openSpy).toHaveBeenCalledWith('Shared text');
  });

  it('confirming the share-text dialog opens the list picker instead of the generic sheet', () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('#share-text-dialog');
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    const modal  = el.shadowRoot.querySelector('#import-modal');
    dialog.dispatchEvent(new CustomEvent('import-text-confirm', { detail: { items: [{ title: 'Milk' }] } }));
    expect(picker.show).toHaveBeenCalledOnce();
    expect(modal.show).not.toHaveBeenCalled();
  });

  it('picking an existing list merges the parsed items into it, building the full item shape', async () => {
    setState('lists', [{ id: 'L1', name: 'Existing', items: [] }]);
    const el = mount();
    const dialog = el.shadowRoot.querySelector('#share-text-dialog');
    dialog.dispatchEvent(new CustomEvent('import-text-confirm', {
      detail: { items: [{ title: 'Milk', note: 'From the corner shop', url: undefined }] },
    }));
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: ['L1'], newListName: null, copy: true } }));

    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.id === 'L1');
      expect(list.items).toHaveLength(1);
      const item = list.items[0];
      expect(item.title).toBe('Milk');
      expect(item.note).toBe('From the corner shop');
      expect(item.status).toBe('open');
      expect(item.tags).toEqual([]);
      expect(item.inGoals).toEqual([]);
      expect(item.id).toBeTruthy();
    });
  });

  it('typing a new list name creates the list with the parsed items', async () => {
    const el = mount();
    const dialog = el.shadowRoot.querySelector('#share-text-dialog');
    dialog.dispatchEvent(new CustomEvent('import-text-confirm', {
      detail: { items: [{ title: 'Milk' }, { title: 'Eggs' }] },
    }));
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: [], newListName: 'Fresh List', copy: true } }));

    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.name === 'Fresh List');
      expect(list).toBeTruthy();
      expect(list.items.map(i => i.title)).toEqual(['Milk', 'Eggs']);
    });
  });

  it('an abandoned item-handoff picker session does not win over a later share-text pick (shared picker, two flows)', async () => {
    // Simulate an item-handoff picker opened and abandoned (backdrop/back, no list-pick
    // fired) — _pendingHandoffItems is left set, same as it would be on a real dismiss.
    vi.spyOn(syncModule, 'previewImport').mockResolvedValue({
      type: 'simple',
      payload: { __telosHandoff: true, kind: 'item', item: { id: 'i1', title: 'Stale item', status: 'open', tags: [], inGoals: [] } },
      blobs: [],
    });
    const el = mount();
    await el._openImportFile(fakeFile()); // sets _pendingHandoffItems, picker never confirmed

    const dialog = el.shadowRoot.querySelector('#share-text-dialog');
    dialog.dispatchEvent(new CustomEvent('import-text-confirm', { detail: { items: [{ title: 'Fresh item' }] } }));
    const picker = el.shadowRoot.querySelector('#handoff-list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', { detail: { targetListIds: [], newListName: 'Target list', copy: true } }));

    await vi.waitFor(() => {
      const list = getState().lists.find(l => l.name === 'Target list');
      expect(list).toBeTruthy();
      expect(list.items.map(i => i.title)).toEqual(['Fresh item']);
    });
  });
});
