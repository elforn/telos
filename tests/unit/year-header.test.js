// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as Store from '../../_lib/core/store/store.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

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

// Each sheet is a <modal-dialog>; its real native <dialog> lives one shadow level in.
function nativeDialog(modalDialogEl) {
  return modalDialogEl.shadowRoot.querySelector('dialog');
}

beforeEach(() => {
  Store.setState('images', {});
  Store.setState('accentColors', {});
  Store.setState('reflections', {});
});

afterEach(() => {
  document.body.querySelectorAll('year-header').forEach(el => el.remove());
  localStorage.clear();
});

describe('year-header — menu', () => {
  it('opens the menu dialog when menu button is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(nativeDialog(el.shadowRoot.querySelector('#menu')).open).toBe(true);
  });

  it('sets aria-expanded="true" on menu button when menu opens', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#menu-btn');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  // Backdrop-click-to-close is modal-dialog's own concern, covered by
  // modal-dialog.test.js — here we just verify year-header reacts correctly
  // to a close, regardless of what triggered it.
  it('resets aria-expanded when the menu closes', () => {
    const el = mount();
    const btn = el.shadowRoot.querySelector('#menu-btn');
    btn.click();
    el.shadowRoot.querySelector('#menu').close();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders an Extract Markdown button in the menu', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#year-export-btn')).not.toBeNull();
  });

  it('renders a Share year button in the menu', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#year-share-btn')).not.toBeNull();
  });

  it('dispatches year-share-request and closes the menu when Share year is clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    const events = [];
    el.addEventListener('year-share-request', e => events.push(e));
    el.shadowRoot.querySelector('#year-share-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(nativeDialog(el.shadowRoot.querySelector('#menu')).open).toBe(false);
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

describe('year-header — year photo clearing', () => {
  it('removes the src attribute entirely when clearing the header image, rather than setting it to an empty string', () => {
    // img.src = '' resolves to the current page's own URL, so the browser briefly
    // tries (and fails) to decode the HTML document as an image — flashing the
    // broken-image icon on every swipe/select into a year with no photo.
    const el = mount(2026);
    const img = el.shadowRoot.querySelector('#header-img');
    img.src = 'blob:fake-object-url-for-test';
    el.setAttribute('data-has-image', '');

    el._clearImage();

    expect(img.hasAttribute('src')).toBe(false);
    expect(el.hasAttribute('data-has-image')).toBe(false);
  });

  it('clearing an image that was never set is a no-op, not an error', () => {
    const el = mount(2026);
    const img = el.shadowRoot.querySelector('#header-img');
    expect(() => el._clearImage()).not.toThrow();
    expect(img.hasAttribute('src')).toBe(false);
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
    expect(nativeDialog(el.shadowRoot.querySelector('#color-sheet')).open).toBe(true);
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
    const swatch = el.shadowRoot.querySelector('.swatch[data-color="#3B82F6"]');
    swatch.click();
    expect(Store.getState().accentColors?.['2026']).toBe('#3B82F6');
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

// ── year-header — tag strip toggle ────────────────────────────────────────────

describe('year-header — tag strip toggle', () => {
  beforeEach(() => {
    Store.setState('goalsTagsVisible', {});
  });

  it('clicking tags-show-btn sets goalsTagsVisible[year] to true', () => {
    const el = mount();
    el.shadowRoot.querySelector('#tags-show-btn').click();
    expect(Store.getState().goalsTagsVisible?.['2026']).toBe(true);
  });

  it('clicking tags-hide-btn sets goalsTagsVisible[year] to false', () => {
    Store.setState('goalsTagsVisible', { '2026': true });
    const el = mount();
    el.shadowRoot.querySelector('#tags-hide-btn').click();
    expect(Store.getState().goalsTagsVisible?.['2026']).toBe(false);
  });

  it('tags-show-btn gets active class when strip is visible', () => {
    Store.setState('goalsTagsVisible', { '2026': true });
    const el = mount();
    expect(el.shadowRoot.querySelector('#tags-show-btn').classList.contains('active')).toBe(true);
    expect(el.shadowRoot.querySelector('#tags-hide-btn').classList.contains('active')).toBe(false);
  });

  it('tags-hide-btn gets active class when strip is hidden', () => {
    Store.setState('goalsTagsVisible', { '2026': false });
    const el = mount();
    expect(el.shadowRoot.querySelector('#tags-show-btn').classList.contains('active')).toBe(false);
    expect(el.shadowRoot.querySelector('#tags-hide-btn').classList.contains('active')).toBe(true);
  });

  it('sets --tag-strip-display: block on documentElement when visible', () => {
    Store.setState('goalsTagsVisible', { '2026': true });
    mount();
    expect(document.documentElement.style.getPropertyValue('--tag-strip-display')).toBe('block');
  });

  it('sets --tag-strip-display: none on documentElement when hidden', () => {
    Store.setState('goalsTagsVisible', { '2026': false });
    mount();
    expect(document.documentElement.style.getPropertyValue('--tag-strip-display')).toBe('none');
  });

  it('does not affect a different year', () => {
    Store.setState('goalsTagsVisible', { '2025': true });
    const el = mount(2026);
    // year 2026 not set → visible is false → hide btn should be active
    expect(el.shadowRoot.querySelector('#tags-hide-btn').classList.contains('active')).toBe(true);
  });
});

describe('year-header — year picker', () => {
  it('opens the year picker dialog when the year title is tapped', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    expect(nativeDialog(el.shadowRoot.querySelector('#year-picker')).open).toBe(true);
  });

  it('lists the full router-valid year range, not just a window around the current year', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const years = [...el.shadowRoot.querySelectorAll('.year-row')].map(r => r.dataset.year);
    expect(years[0]).toBe('1900');
    expect(years.at(-1)).toBe('2100');
    expect(years).toContain('2026');
    // Distant years with no content are still present and reachable by scrolling —
    // the list is never capped to a window around the current year or around content.
    expect(years).toContain('2015');
    expect(years).toContain('2040');
  });

  it('marks the currently displayed year as active/selected', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const active = el.shadowRoot.querySelector('.year-row.active');
    expect(active?.dataset.year).toBe('2026');
    expect(active?.getAttribute('aria-selected')).toBe('true');
  });

  it('centres the active row in the list when the sheet opens', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const list = el.shadowRoot.querySelector('#year-picker-list');
    const active = list.querySelector('.year-row.active');
    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(active, 'offsetTop', { value: 1000, configurable: true });
    Object.defineProperty(active, 'offsetHeight', { value: 40, configurable: true });
    el._scrollYearPickerToActive();
    expect(list.scrollTop).toBe(1000 - 200 / 2 + 40 / 2);
  });

  it('renders a Today button in the picker header', () => {
    const el = mount(2026);
    expect(el.shadowRoot.querySelector('#year-picker-today-btn')).not.toBeNull();
  });

  it('clicking Today centres the list on the real current year without navigating or closing the sheet', () => {
    const currentYear = new Date().getFullYear();
    // Anchor far from today so the today row is distinguishable from the active row.
    const el = mount(currentYear + 30);
    el.shadowRoot.querySelector('#year').click();
    const list = el.shadowRoot.querySelector('#year-picker-list');
    const todayRow = list.querySelector(`.year-row[data-year="${currentYear}"]`);
    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(todayRow, 'offsetTop', { value: 500, configurable: true });
    Object.defineProperty(todayRow, 'offsetHeight', { value: 40, configurable: true });

    let fired = false;
    el.addEventListener('year-navigate', () => { fired = true; });
    el.shadowRoot.querySelector('#year-picker-today-btn').click();

    expect(list.scrollTop).toBe(500 - 200 / 2 + 40 / 2);
    expect(fired).toBe(false);
    expect(nativeDialog(el.shadowRoot.querySelector('#year-picker')).open).toBe(true);
  });

  it('flags a distant year with goals with a filled dot without limiting what else is listed', () => {
    Store.setState('goals', { 2015: { capstone: [{ id: 'g1', title: 'x', tags: [], tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [], focus: [] } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2015');
    expect(row.querySelector('.year-row-dot').classList.contains('empty')).toBe(false);
    Store.setState('goals', {});
  });

  it('shows a filled dot on years with goals', () => {
    Store.setState('goals', { 2027: { capstone: [{ id: 'g1', title: 'x', tags: [], tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [], focus: [] } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2027');
    expect(row.querySelector('.year-row-dot').classList.contains('empty')).toBe(false);
    Store.setState('goals', {});
  });

  it('shows a filled dot on years with a photo', () => {
    Store.setState('images', { 2023: 'blob-id' });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2023');
    expect(row.querySelector('.year-row-dot').classList.contains('empty')).toBe(false);
    Store.setState('images', {});
  });

  it('renders an empty (layout-reserving) dot placeholder on years with no content', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2030');
    const dot = row.querySelector('.year-row-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('empty')).toBe(true);
  });

  it('an empty goals section for a year does not count as content', () => {
    Store.setState('goals', { 2028: { capstone: [], milestones: [], wow: [], focus: [] } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2028');
    expect(row.querySelector('.year-row-dot').classList.contains('empty')).toBe(true);
    Store.setState('goals', {});
  });

  it('every row renders a year-row-label with the year text, kept separate from the dot', () => {
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2026');
    expect(row.querySelector('.year-row-label').textContent).toBe('2026');
  });

  it('colours the dot with the year\'s accent colour when one is set', () => {
    Store.setState('goals', { 2027: { capstone: [{ id: 'g1', title: 'x', tags: [], tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [], focus: [] } });
    Store.setState('accentColors', { '2027': '#3B82F6' });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2027');
    expect(row.querySelector('.year-row-dot').style.background).toBe('#3B82F6');
    Store.setState('goals', {});
    Store.setState('accentColors', {});
  });

  it('does not apply a background colour to an empty dot even when the year has an accent colour set', () => {
    // accentColors can be set on a year with no goals/photo (colour picked, then content removed) —
    // the dot should stay an invisible placeholder, not surface a colour for a year with nothing in it.
    Store.setState('accentColors', { '2030': '#3B82F6' });
    const el = mount(2026);
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2030');
    const dot = row.querySelector('.year-row-dot');
    expect(dot.classList.contains('empty')).toBe(true);
    expect(dot.style.background).toBe('');
    Store.setState('accentColors', {});
  });

  it('emits year-navigate and closes the sheet when a year row is clicked', () => {
    const el = mount(2026);
    let detail;
    el.addEventListener('year-navigate', e => { detail = e.detail; });
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2029');
    row.click();
    expect(detail).toEqual({ year: 2029 });
    expect(nativeDialog(el.shadowRoot.querySelector('#year-picker')).open).toBe(false);
  });

  it('year-navigate from the picker bubbles and is composed', () => {
    const el = mount(2026);
    let event;
    document.addEventListener('year-navigate', e => { event = e; }, { once: true });
    el.shadowRoot.querySelector('#year').click();
    const row = [...el.shadowRoot.querySelectorAll('.year-row')].find(r => r.dataset.year === '2029');
    row.click();
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(true);
  });

  it('clicking the already-active year closes the sheet without dispatching year-navigate', () => {
    const el = mount(2026);
    let fired = false;
    el.addEventListener('year-navigate', () => { fired = true; });
    el.shadowRoot.querySelector('#year').click();
    el.shadowRoot.querySelector('.year-row.active').click();
    expect(fired).toBe(false);
    expect(nativeDialog(el.shadowRoot.querySelector('#year-picker')).open).toBe(false);
  });

  it('the year title button has an accessible label including the year', () => {
    const el = mount(2026);
    expect(el.shadowRoot.querySelector('#year').getAttribute('aria-label')).toContain('2026');
  });

  it('sets aria-expanded="true" on the year button when the picker opens, and resets it on close', () => {
    const el = mount(2026);
    const btn = el.shadowRoot.querySelector('#year');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    el.shadowRoot.querySelector('#year-picker').close();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('the list floor matches the router\'s valid year floor regardless of the current year', () => {
    const el = mount(1905);
    el.shadowRoot.querySelector('#year').click();
    const years = [...el.shadowRoot.querySelectorAll('.year-row')].map(r => r.dataset.year);
    expect(years[0]).toBe('1900');
  });
});

describe('year-header — deadline markers toggle', () => {
  const CURRENT = new Date().getFullYear();
  const PAST = CURRENT - 1;
  const displayVar = () => document.documentElement.style.getPropertyValue('--goal-deadline-display');

  beforeEach(() => {
    Store.setState('goalsDeadlinesVisible', {});
  });

  it('defaults ON for the current year when nothing is stored', () => {
    const el = mount(CURRENT);
    expect(el.shadowRoot.querySelector('#deadlines-show-btn').classList.contains('active')).toBe(true);
    expect(displayVar()).toBe('block');
  });

  it('defaults OFF for a non-current year when nothing is stored', () => {
    const el = mount(PAST);
    expect(el.shadowRoot.querySelector('#deadlines-hide-btn').classList.contains('active')).toBe(true);
    expect(displayVar()).toBe('none');
  });

  it('clicking deadlines-show-btn sets goalsDeadlinesVisible[year] to true', () => {
    const el = mount(PAST);
    el.shadowRoot.querySelector('#deadlines-show-btn').click();
    expect(Store.getState().goalsDeadlinesVisible?.[String(PAST)]).toBe(true);
  });

  it('clicking deadlines-hide-btn sets goalsDeadlinesVisible[year] to false', () => {
    const el = mount(CURRENT);
    el.shadowRoot.querySelector('#deadlines-hide-btn').click();
    expect(Store.getState().goalsDeadlinesVisible?.[String(CURRENT)]).toBe(false);
  });

  it('an explicit stored value overrides the year default', () => {
    // Current year, but explicitly hidden.
    Store.setState('goalsDeadlinesVisible', { [String(CURRENT)]: false });
    const hidden = mount(CURRENT);
    expect(hidden.shadowRoot.querySelector('#deadlines-hide-btn').classList.contains('active')).toBe(true);
    expect(displayVar()).toBe('none');
    hidden.remove();
    // Past year, but explicitly shown.
    Store.setState('goalsDeadlinesVisible', { [String(PAST)]: true });
    const shown = mount(PAST);
    expect(shown.shadowRoot.querySelector('#deadlines-show-btn').classList.contains('active')).toBe(true);
    expect(displayVar()).toBe('block');
  });
});

// ── year-header — reflection ─────────────────────────────────────────────────

describe('year-header — reflection menu entry', () => {
  it('renders a Reflection button in the menu', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#year-reflection-btn')).not.toBeNull();
  });

  it('shows "Add" as the trailing value when no reflection exists for the year', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#reflection-menu-value').textContent).toBe('Add ›');
  });

  it('shows the aggregate score as the trailing value once one exists', () => {
    Store.setState('reflections', { '2026': { scores: { people: 4, health: 4 } } });
    const el = mount();
    expect(el.shadowRoot.querySelector('#reflection-menu-value').textContent).toBe('★ 4.0 ›');
  });

  it('opens the reflection dialog and closes the menu when clicked', () => {
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    expect(nativeDialog(dialog.shadowRoot.querySelector('#dialog')).open).toBe(true);
    expect(nativeDialog(el.shadowRoot.querySelector('#menu')).open).toBe(false);
  });

  it('pre-fills the dialog with the existing reflection for the year', () => {
    Store.setState('reflections', { '2026': { scores: { wonder: 3 }, comment: 'good year' } });
    const el = mount();
    el.shadowRoot.querySelector('#menu-btn').click();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    expect(dialog.shadowRoot.querySelector('#reflection-comment').value).toBe('good year');
    expect(dialog.shadowRoot.querySelector('.star-group[data-aspect="wonder"] .star-btn[data-value="3"]').classList.contains('filled')).toBe(true);
  });
});

describe('year-header — reflection edits commit immediately', () => {
  it('a star tap commits the score to the store right away', () => {
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('.star-group[data-aspect="health"] .star-btn[data-value="4"]').click();
    expect(Store.getState().reflections?.['2026']?.scores?.health).toBe(4);
  });

  it('preserves other aspects already scored when a different one is tapped', () => {
    Store.setState('reflections', { '2026': { scores: { people: 5 } } });
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('.star-group[data-aspect="wealth"] .star-btn[data-value="2"]').click();
    expect(Store.getState().reflections?.['2026']?.scores).toEqual({ people: 5, wealth: 2 });
  });

  it('a comment blur commits the comment to the store', () => {
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    const textarea = dialog.shadowRoot.querySelector('#reflection-comment');
    textarea.value = 'Solid year.';
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(Store.getState().reflections?.['2026']?.comment).toBe('Solid year.');
  });
});

describe('year-header — reflection session-undo toast', () => {
  it('shows an undo toast on close when something changed, and Undo restores the prior value', async () => {
    _resetToast();
    Store.setState('reflections', { '2026': { scores: { people: 5 } } });
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('.star-group[data-aspect="health"] .star-btn[data-value="3"]').click();
    nativeDialog(dialog.shadowRoot.querySelector('#dialog')).close();

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('Reflection saved');
    });
    document.querySelector('#toast-container .socle-toast-btn').click();
    expect(Store.getState().reflections?.['2026']).toEqual({ scores: { people: 5 } });
  });

  it('shows no toast on close when nothing changed', async () => {
    _resetToast();
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    nativeDialog(dialog.shadowRoot.querySelector('#dialog')).close();
    await new Promise(r => setTimeout(r, 0));
    expect(document.querySelector('#toast-container .socle-toast-success')).toBeNull();
  });

  it('undo removes the year entirely when it did not exist before the edit', async () => {
    _resetToast();
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('.star-group[data-aspect="health"] .star-btn[data-value="3"]').click();
    nativeDialog(dialog.shadowRoot.querySelector('#dialog')).close();

    await vi.waitFor(() => {
      expect(document.querySelector('#toast-container .socle-toast-btn')).not.toBeNull();
    });
    document.querySelector('#toast-container .socle-toast-btn').click();
    expect(Store.getState().reflections?.['2026']).toBeUndefined();
  });
});

// The on-page summary element itself now lives in home-page.js (a plain
// scrollable-area element above Capstone, not owned by this fixed header —
// see home-page.test.js) after two earlier attempts at owning it here (tied
// to this component's own fixed positioning, with independent scroll-fold
// logic) broke in real testing. year-header.js's own public openReflection()
// is what that element calls; test it directly here.
describe('year-header — openReflection() public API', () => {
  it('opens the dialog pre-filled with the existing reflection for the year', () => {
    Store.setState('reflections', { '2026': { scores: { people: 4 }, comment: 'Good year' } });
    const el = mount();
    el.openReflection();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    expect(nativeDialog(dialog.shadowRoot.querySelector('#dialog')).open).toBe(true);
    expect(dialog.shadowRoot.querySelector('#reflection-comment').value).toBe('Good year');
  });

  it('opens blank for a year with no reflection yet', () => {
    const el = mount();
    el.openReflection();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    expect(dialog.shadowRoot.querySelector('#reflection-comment').value).toBe('');
  });
});

describe('year-header — reflection visibility toggle', () => {
  it('toggling off in the dialog sets showCard:false in the store', () => {
    Store.setState('reflections', { '2026': { scores: { people: 4 } } });
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('#reflection-visibility-btn').click();
    expect(Store.getState().reflections?.['2026']?.showCard).toBe(false);
  });

  it('toggling back on omits showCard entirely rather than storing true', () => {
    Store.setState('reflections', { '2026': { scores: { people: 4 }, showCard: false } });
    const el = mount();
    el.shadowRoot.querySelector('#year-reflection-btn').click();
    const dialog = el.shadowRoot.querySelector('#reflection-dialog');
    dialog.shadowRoot.querySelector('#reflection-visibility-btn').click();
    expect(Store.getState().reflections['2026']).not.toHaveProperty('showCard');
  });
});

