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
import { setState } from '../../_lib/core/store/store.js';
import { navigate } from '../../_lib/core/router/router.js';
import { repairInstallation } from '../../_lib/core/sw-manager/sw-repair.js';
import { backupBeforeRepair } from '../../app/utils/backup-before-repair.js';

// happy-dom does not implement ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

// Silence the version.json fetch — caught internally by .catch(() => {})
globalThis.fetch = () => Promise.reject(new Error('no network in tests'));

function stubModals(el) {
  for (const id of ['#settings-modal', '#import-modal']) {
    const m = el.shadowRoot.querySelector(id);
    if (m) { m.show = vi.fn(); m.close = vi.fn(); }
  }
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
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(false);
    expect(yearsDot(el).dataset.urgency).toBe('overdue');
    expect(yearsDot(el).dataset.count).toBe('1');
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
    setState('goals', { [YEAR - 1]: { capstone: [{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }], milestones: [], wow: [], focus: [] } });
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
  });

  it('hides both pills when nothing is due soon', () => {
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(90) }]));
    setState('lists', []);
    const el = mount();
    el.refreshUrgency();
    expect(yearsDot(el).hidden).toBe(true);
    expect(listsDot(el).hidden).toBe(true);
  });

  it('mutes the Lists pill (not Years) when listsRollupVisible is false', () => {
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }]));
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
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }]));
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
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }]));
    setState('lists', []);
    expect(() => { const el = mount(); el.refreshUrgency(); }).not.toThrow();
    await vi.waitFor(() => expect(consoleErr).toHaveBeenCalledWith('App badge update failed:', expect.any(Error)));
  });

  it('does nothing when setAppBadge is unsupported', () => {
    const original = navigator.setAppBadge;
    // eslint-disable-next-line no-param-reassign
    delete navigator.setAppBadge;
    setState('goals', yearGoals([{ id: 'c', title: 'x', tags: [], percentage: 10, dueDate: isoDaysFromNow(-1) }]));
    expect(() => { const el = mount(); el.refreshUrgency(); }).not.toThrow();
    navigator.setAppBadge = original;
  });
});
