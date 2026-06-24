// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as Store from '../../_lib/core/store/store.js';

HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

vi.mock('../../_lib/modules/images/images.js', () => ({
  compressImage: vi.fn(async f => f),
}));

vi.mock('../../_lib/modules/sync/sync.js', () => ({
  exportData:     vi.fn(async () => new Uint8Array()),
  importData:     vi.fn(async () => ({ eventsAdded: 0, imagesAdded: 0 })),
  downloadExport: vi.fn(),
  readImportFile: vi.fn(async () => ({})),
}));

await import('../../app/strings.js');
await import('../../app/components/year-header/year-header.js');

beforeAll(async () => {
  await Store.boot({ dbName: 'test-year-header', initialState: { goals: {}, images: {}, accentColors: {} } });
});

function mount(year = 2026) {
  const el = document.createElement('year-header');
  el.year = year;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  Store.setState('images', {});
  Store.setState('accentColors', {});
});

afterEach(() => {
  document.body.querySelectorAll('year-header').forEach(el => el.remove());
  localStorage.clear();
});

describe('year-header — menu', () => {
  it('opens the menu dialog when menu button is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(el.shadowRoot.querySelector('#menu').open).toBe(true);
  });

  it('sets aria-expanded="true" on menu button when menu opens', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#menu-btn');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes menu on backdrop click', () => {
    const el = mount();
    const menu = el.shadowRoot.querySelector('#menu');
    el.shadowRoot.querySelector('#menu-btn').click();
    menu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.open).toBe(false);
  });

  it('resets aria-expanded when menu closes', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#menu-btn');
    btn.click();
    el.shadowRoot.querySelector('#menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders an Extract Markdown button in the menu', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#year-export-btn')).not.toBeNull();
  });
});

describe('year-header — year navigation', () => {
  it('emits year-navigate with year - 1 when prev button is clicked', () => {
    const el = mount(2026);
    let detail;
    el.addEventListener('year-navigate', e => { detail = e.detail; });
    el.shadowRoot.querySelector('#prev').click();
    expect(detail).toEqual({ year: 2025 });
  });

  it('emits year-navigate with year + 1 when next button is clicked', () => {
    const el = mount(2026);
    let detail;
    el.addEventListener('year-navigate', e => { detail = e.detail; });
    el.shadowRoot.querySelector('#next').click();
    expect(detail).toEqual({ year: 2027 });
  });

  it('updates displayed year when year property is set after mount', async () => {
    const el = mount(2026);
    el.year = 2027;
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#year').textContent).toBe('2027')
    );
  });

  it('year-navigate event bubbles and is composed', () => {
    const el = mount(2026);
    let event;
    document.addEventListener('year-navigate', e => { event = e; }, { once: true });
    el.shadowRoot.querySelector('#next').click();
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(true);
  });
});

describe('year-header — scroll to top on background tap', () => {
  it('onTap scrolls to the top when no dialog is open', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const el = mount();
    el.onTap();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  // No test for "dialog open" guard — when a modal dialog is open it captures
  // all pointer events, making onTap() physically unreachable from the background.
});

describe('year-header — accent color picker', () => {
  it('opens color sheet when color menu item is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    expect(el.shadowRoot.querySelector('#color-sheet').open).toBe(true);
  });

  it('sets .active on the swatch matching the current accent color', () => {
    Store.setState('accentColors', { '2026': '#3B82F6' });
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    const active = el.shadowRoot.querySelector('.swatch.active');
    expect(active?.dataset.color).toBe('#3B82F6');
  });

  it('no swatch is active when no accent color is set', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    expect(el.shadowRoot.querySelector('.swatch.active')).toBeNull();
  });

  it('clicking a swatch updates accentColors in the store', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    const swatch = el.shadowRoot.querySelector('.swatch[data-color="#EF4444"]');
    swatch.click();
    expect(Store.getState().accentColors?.['2026']).toBe('#EF4444');
  });

  it('reset button removes the accent color for the year', () => {
    Store.setState('accentColors', { '2026': '#3B82F6' });
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    el.shadowRoot.querySelector('#color-reset-btn').click();
    expect(Store.getState().accentColors?.['2026']).toBeUndefined();
  });

  it('each swatch has a descriptive aria-label', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-color-btn').click();
    const swatches = [...el.shadowRoot.querySelectorAll('.swatch')];
    expect(swatches.every(s => s.getAttribute('aria-label')?.length > 0)).toBe(true);
    expect(swatches.some(s => s.getAttribute('aria-label') === '#5BADE0')).toBe(false);
  });
});

