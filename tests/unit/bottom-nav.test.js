// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';

vi.mock('../../_lib/core/router/router.js', () => ({ navigate: vi.fn() }));

import '../../app/components/bottom-nav/bottom-nav.js';
import { navigate } from '../../_lib/core/router/router.js';

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
