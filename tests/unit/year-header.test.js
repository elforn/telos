// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/year-header/year-header.js';

function stubAllDialogs(el) {
  el.shadowRoot.querySelectorAll('dialog').forEach(dialog => {
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close     = vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
  });
}

function mount(year = 2026) {
  const el = document.createElement('year-header');
  document.body.appendChild(el);
  el.year = year;
  stubAllDialogs(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('year-header — structure', () => {
  it('renders prev and next buttons', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#prev')).not.toBeNull();
    expect(el.shadowRoot.querySelector('#next')).not.toBeNull();
  });

  it('renders the year', () => {
    const el = mount(2025);
    expect(el.shadowRoot.querySelector('#year').textContent).toBe('2025');
  });

  it('renders the progress strip', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#strip-fill')).not.toBeNull();
  });

  it('renders a menu button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#menu-btn')).not.toBeNull();
  });
});

describe('year-header — year strip', () => {
  it('shows 100% strip for a past year', () => {
    const el = mount(new Date().getFullYear() - 1);
    expect(el.shadowRoot.querySelector('#strip-fill').style.width).toBe('100%');
  });

  it('shows 0% strip for a future year', () => {
    const el = mount(new Date().getFullYear() + 1);
    expect(el.shadowRoot.querySelector('#strip-fill').style.width).toBe('0%');
  });
});

describe('year-header — navigation', () => {
  it('emits year-navigate with year - 1 on prev click', () => {
    const el = mount(2026);
    let detail;
    el.addEventListener('year-navigate', e => { detail = e.detail; }, { once: true });
    el.shadowRoot.querySelector('#prev').click();
    expect(detail.year).toBe(2025);
  });

  it('emits year-navigate with year + 1 on next click', () => {
    const el = mount(2026);
    let detail;
    el.addEventListener('year-navigate', e => { detail = e.detail; }, { once: true });
    el.shadowRoot.querySelector('#next').click();
    expect(detail.year).toBe(2027);
  });

  it('updates displayed year when year prop changes', () => {
    const el = mount(2026);
    el.year = 2027;
    expect(el.shadowRoot.querySelector('#year').textContent).toBe('2027');
  });
});

describe('year-header — menu', () => {
  it('opens menu dialog on menu button click', () => {
    const el = mount();
    const menu = el.shadowRoot.querySelector('#menu');
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(menu.showModal).toHaveBeenCalledOnce();
  });

  it('shows year section in menu', () => {
    const el = mount();
    const labels = Array.from(el.shadowRoot.querySelectorAll('.menu-section-label'))
      .map(p => p.textContent);
    expect(labels).toContain('This year');
  });

  it('shows app section in menu', () => {
    const el = mount();
    const labels = Array.from(el.shadowRoot.querySelectorAll('.menu-section-label'))
      .map(p => p.textContent);
    expect(labels).toContain('App');
  });
});

describe('year-header — compact mode (no image)', () => {
  it('adds compact class when scrollY exceeds threshold (no image)', () => {
    const el = mount();
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(el.classList.contains('compact')).toBe(true);
  });

  it('removes compact class when scrollY drops below revert threshold (no image)', () => {
    const el = mount();
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    Object.defineProperty(window, 'scrollY', { value: 10, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(el.classList.contains('compact')).toBe(false);
  });

  it('does not go compact at scrollY below threshold (no image)', () => {
    const el = mount();
    Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(el.classList.contains('compact')).toBe(false);
  });
});

describe('year-header — compact mode (with image)', () => {
  it('adds compact class at lower threshold when image is set', () => {
    const el = mount();
    el.setAttribute('data-has-image', '');
    Object.defineProperty(window, 'scrollY', { value: 25, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(el.classList.contains('compact')).toBe(true);
  });

  it('removes compact class at lower revert threshold when image is set', () => {
    const el = mount();
    el.setAttribute('data-has-image', '');
    Object.defineProperty(window, 'scrollY', { value: 25, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    Object.defineProperty(window, 'scrollY', { value: 5, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect(el.classList.contains('compact')).toBe(false);
  });
});

describe('year-header — photo sub-sheet', () => {
  it('opens photo sub-sheet when year photo menu item is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-photo-btn').click();
    const sheet = el.shadowRoot.querySelector('#photo-sheet');
    expect(sheet.showModal).toHaveBeenCalledOnce();
  });

  it('shows add-photo button and hides change/remove when no image is set', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-photo-btn').click();
    const sheet = el.shadowRoot.querySelector('#photo-sheet');
    expect(sheet.querySelector('#photo-add').hidden).toBe(false);
    expect(sheet.querySelector('#photo-change').hidden).toBe(true);
    expect(sheet.querySelector('#photo-remove').hidden).toBe(true);
  });

  it('shows change/remove and hides add when image is set for the year', () => {
    const el = mount(2026);
    el._imagesState = { 2026: 'some-uuid' };
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-photo-btn').click();
    const sheet = el.shadowRoot.querySelector('#photo-sheet');
    expect(sheet.querySelector('#photo-add').hidden).toBe(true);
    expect(sheet.querySelector('#photo-change').hidden).toBe(false);
    expect(sheet.querySelector('#photo-remove').hidden).toBe(false);
  });
});

describe('year-header — language sub-sheet', () => {
  it('opens language sub-sheet when language menu item is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#language-btn').click();
    const sheet = el.shadowRoot.querySelector('#lang-sheet');
    expect(sheet.showModal).toHaveBeenCalledOnce();
  });

  it('renders EN, FR, and CA locale options', () => {
    const el = mount();
    const locales = Array.from(
      el.shadowRoot.querySelectorAll('#lang-sheet [data-locale]')
    ).map(btn => btn.dataset.locale);
    expect(locales).toContain('en');
    expect(locales).toContain('fr');
    expect(locales).toContain('ca');
  });
});

describe('year-header — sync section', () => {
  it('renders export this year button', () => {
    const el = mount(2026);
    expect(el.shadowRoot.querySelector('#export-year-btn')).not.toBeNull();
  });

  it('export year button label includes the year', () => {
    const el = mount(2026);
    const span = el.shadowRoot.querySelector('#export-year-label');
    expect(span.textContent).toContain('2026');
  });

  it('export year button label updates when year prop changes', () => {
    const el = mount(2026);
    el.year = 2027;
    const span = el.shadowRoot.querySelector('#export-year-label');
    expect(span.textContent).toContain('2027');
  });

  it('renders export all years button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#export-all-btn')).not.toBeNull();
  });

  it('renders import button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#import-btn')).not.toBeNull();
  });
});
