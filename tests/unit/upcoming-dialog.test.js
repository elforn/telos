// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/upcoming-dialog/upcoming-dialog.js';

function mount() {
  const el = document.createElement('upcoming-dialog');
  document.body.appendChild(el);
  el._dialog.show  = vi.fn();
  el._dialog.close = vi.fn();
  return el;
}

const GOAL_ENTRY = { kind: 'goal', id: 'g1', title: 'Ship investor deck', year: '2026', section: 'capstone' };
const ITEM_ENTRY = { kind: 'item', id: 'i1', title: 'Renew passport', listId: 'l1', listName: 'Admin' };

afterEach(() => { document.body.innerHTML = ''; });

describe('upcoming-dialog — structure', () => {
  it('renders a real heading for the dialog title', () => {
    const el = mount();
    const title = el.shadowRoot.querySelector('.upcoming-title');
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('Upcoming');
  });

  it('shows the empty state when nothing is upcoming', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [] });
    expect(el.shadowRoot.querySelector('#upcoming-empty').hidden).toBe(false);
    expect(el.shadowRoot.querySelectorAll('.upcoming-row')).toHaveLength(0);
  });

  it('hides the empty state and renders a section + row when something is overdue', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    expect(el.shadowRoot.querySelector('#upcoming-empty').hidden).toBe(true);
    const heads = el.shadowRoot.querySelectorAll('.upcoming-section-head');
    expect(heads).toHaveLength(1);
    expect(heads[0].querySelector('.upcoming-section-label').textContent).toBe('Overdue');
    expect(heads[0].querySelector('.upcoming-section-count').textContent).toBe('1');
    expect(el.shadowRoot.querySelectorAll('.upcoming-row')).toHaveLength(1);
  });

  it('only renders sections that have entries, in overdue/today/tomorrow order', () => {
    const el = mount();
    el.open({ overdue: [], today: [{ ...GOAL_ENTRY, id: 'g2' }], tomorrow: [ITEM_ENTRY] });
    const labels = [...el.shadowRoot.querySelectorAll('.upcoming-section-label')].map(l => l.textContent);
    expect(labels).toEqual(['Today', 'Tomorrow']);
  });

  it('renders a goal row with a title and a Goal/year/section sublabel', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-row-title').textContent).toBe('Ship investor deck');
    expect(row.querySelector('.upcoming-row-sub').textContent).toBe('Goal · 2026 · Capstone');
  });

  it('renders an item row with a title and a List/name sublabel', () => {
    const el = mount();
    el.open({ overdue: [ITEM_ENTRY], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-row-title').textContent).toBe('Renew passport');
    expect(row.querySelector('.upcoming-row-sub').textContent).toBe('List · Admin');
  });

  it('open() shows the wrapped modal-dialog', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    expect(el._dialog.show).toHaveBeenCalledOnce();
  });

  it('renders a plain "days overdue" detail for a dueDate-driven entry', () => {
    const el = mount();
    el.open({ overdue: [{ ...GOAL_ENTRY, detail: { kind: 'overdue', days: 5 } }], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-detail-text').textContent).toBe('5 days overdue');
    expect(row.querySelector('.day-strip')).toBeNull();
  });

  it('renders a plain "missed" count for an Any/monthly frequency shortfall', () => {
    const el = mount();
    el.open({ overdue: [{ ...GOAL_ENTRY, detail: { kind: 'count', count: 2 } }], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-detail-text').textContent).toBe('2 missing');
  });

  const ALL_DAY_STATES = [
    { wd: 'mon', state: 'missed' },
    { wd: 'tue', state: 'success' },
    { wd: 'wed', state: 'unscheduled' },
    { wd: 'thu', state: 'pending' },
    { wd: 'fri', state: 'blank' },
    { wd: 'sat', state: 'blank' },
    { wd: 'sun', state: 'blank' },
  ];

  it('renders a 7-slot Mon-Sun day strip for a scheduled-days frequency shortfall, one class per day\'s own state', () => {
    const el = mount();
    el.open({ overdue: [{ ...GOAL_ENTRY, detail: { kind: 'days', days: ALL_DAY_STATES } }], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    const slots = [...row.querySelectorAll('.day-slot')];
    expect(slots).toHaveLength(7); // Mon..Sun, fixed position disambiguates Tue/Thu and Sat/Sun
    expect(slots.map(s => s.className)).toEqual([
      'day-slot missed',
      'day-slot success',
      'day-slot unscheduled',
      'day-slot pending',
      'day-slot blank',
      'day-slot blank',
      'day-slot blank',
    ]);
    expect(row.querySelector('.upcoming-detail-text')).toBeNull();
  });

  it('the day strip\'s accessible text names only the missed days, not the full success/unscheduled/pending picture', () => {
    const el = mount();
    el.open({ overdue: [{ ...GOAL_ENTRY, detail: { kind: 'days', days: ALL_DAY_STATES } }], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.getAttribute('aria-label')).toBe('Ship investor deck, Goal · 2026 · Capstone, Missing Mon');
  });

  it('folds the detail into the row\'s own aria-label instead of a separately-focusable element', () => {
    const el = mount();
    el.open({ overdue: [{ ...GOAL_ENTRY, detail: { kind: 'overdue', days: 3 } }], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.getAttribute('aria-label')).toBe('Ship investor deck, Goal · 2026 · Capstone, 3 days overdue');
    expect(row.querySelector('.upcoming-detail-text').getAttribute('aria-hidden')).toBe('true');
  });

  it('renders no detail element at all when entry.detail is absent', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    const row = el.shadowRoot.querySelector('.upcoming-row');
    expect(row.querySelector('.upcoming-detail-text')).toBeNull();
    expect(row.querySelector('.day-strip')).toBeNull();
  });

  it('tags each section head with data-key, driving the icon-colour CSS selectors', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [{ ...GOAL_ENTRY, id: 'g2' }], tomorrow: [ITEM_ENTRY] });
    const keys = [...el.shadowRoot.querySelectorAll('.upcoming-section-head')].map(h => h.dataset.key);
    expect(keys).toEqual(['overdue', 'today', 'tomorrow']);
  });

  it('renders the calendar icon markup in every section head — CSS gives each its own colour/fill per data-key', () => {
    // happy-dom doesn't compute CSS, so this only confirms the icon markup
    // exists in every section head — see upcoming-dialog.js's own
    // [data-key="..."] .upcoming-section-icon rules for the actual per-key
    // colour/fill, which isn't testable in this environment.
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [{ ...GOAL_ENTRY, id: 'g2' }], tomorrow: [ITEM_ENTRY] });
    const heads = [...el.shadowRoot.querySelectorAll('.upcoming-section-head')];
    expect(heads.every(h => !!h.querySelector('.upcoming-section-icon svg'))).toBe(true);
  });
});

describe('upcoming-dialog — fold/unfold', () => {
  function heads(el) {
    return Object.fromEntries(
      [...el.shadowRoot.querySelectorAll('.upcoming-section-head')].map(h => [h.dataset.key, h]),
    );
  }
  function bodies(el) {
    return Object.fromEntries(
      [...el.shadowRoot.querySelectorAll('.upcoming-section-body')].map(b => [b.dataset.key, b]),
    );
  }

  it('defaults to overdue and today expanded, tomorrow folded', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [{ ...GOAL_ENTRY, id: 'g2' }], tomorrow: [ITEM_ENTRY] });
    const h = heads(el);
    expect(h.overdue.getAttribute('aria-expanded')).toBe('true');
    expect(h.today.getAttribute('aria-expanded')).toBe('true');
    expect(h.tomorrow.getAttribute('aria-expanded')).toBe('false');
    const b = bodies(el);
    expect(b.overdue.hidden).toBe(false);
    expect(b.today.hidden).toBe(false);
    expect(b.tomorrow.hidden).toBe(true);
  });

  it('clicking a folded section head expands it and reveals its rows', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [ITEM_ENTRY] });
    heads(el).tomorrow.click();
    expect(heads(el).tomorrow.getAttribute('aria-expanded')).toBe('true');
    expect(bodies(el).tomorrow.hidden).toBe(false);
  });

  it('clicking an expanded section head folds it and hides its rows, without closing the dialog', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    heads(el).overdue.click();
    expect(heads(el).overdue.getAttribute('aria-expanded')).toBe('false');
    expect(bodies(el).overdue.hidden).toBe(true);
    expect(el._dialog.close).not.toHaveBeenCalled();
  });

  it('resets to the default fold state on every open(), not remembering a prior session', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [ITEM_ENTRY] });
    heads(el).tomorrow.click(); // expand it
    expect(heads(el).tomorrow.getAttribute('aria-expanded')).toBe('true');

    el.open({ overdue: [], today: [], tomorrow: [ITEM_ENTRY] }); // re-open
    expect(heads(el).tomorrow.getAttribute('aria-expanded')).toBe('false'); // back to folded
  });
});

describe('upcoming-dialog — row tap', () => {
  it('tapping a goal row dispatches upcoming-row-tap with kind/id/year/section', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    let detail = null;
    el.addEventListener('upcoming-row-tap', e => { detail = e.detail; });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(detail).toEqual({ kind: 'goal', id: 'g1', year: '2026', section: 'capstone' });
  });

  it('tapping an item row dispatches upcoming-row-tap with kind/id/listId', () => {
    const el = mount();
    el.open({ overdue: [ITEM_ENTRY], today: [], tomorrow: [] });
    let detail = null;
    el.addEventListener('upcoming-row-tap', e => { detail = e.detail; });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(detail).toEqual({ kind: 'item', id: 'i1', listId: 'l1' });
  });

  it('tapping a row closes the dialog', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    el.shadowRoot.querySelector('.upcoming-row').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });

  it('the Close button closes the dialog', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [] });
    el.shadowRoot.querySelector('#upcoming-close-btn').click();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });
});

describe('upcoming-dialog — hidden-items link (second-class, see hidden-items-dialog.js)', () => {
  const link = el => el.shadowRoot.querySelector('#upcoming-hidden-link');

  it('is hidden when hiddenCount is never set', () => {
    const el = mount();
    el.open({ overdue: [], today: [], tomorrow: [] });
    expect(link(el).hidden).toBe(true);
  });

  it('is hidden when hiddenCount is set to 0', () => {
    const el = mount();
    el.hiddenCount = 0;
    expect(link(el).hidden).toBe(true);
  });

  it('shows the count when hiddenCount is set positive', () => {
    const el = mount();
    el.hiddenCount = 3;
    expect(link(el).hidden).toBe(false);
    expect(link(el).textContent).toBe('3 hidden — tap to review');
  });

  it('is not one of the real overdue/today/tomorrow rows — never dispatches upcoming-row-tap', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    el.hiddenCount = 2;
    const rowTapSpy = vi.fn();
    el.addEventListener('upcoming-row-tap', rowTapSpy);
    link(el).click();
    expect(rowTapSpy).not.toHaveBeenCalled();
  });

  it('clicking it dispatches upcoming-hidden-tap and closes the dialog', () => {
    const el = mount();
    el.hiddenCount = 2;
    const spy = vi.fn();
    el.addEventListener('upcoming-hidden-tap', spy);
    link(el).click();
    expect(spy).toHaveBeenCalledOnce();
    expect(el._dialog.close).toHaveBeenCalledOnce();
  });

  it('lives outside the scroll region — present regardless of section fold state', () => {
    const el = mount();
    el.open({ overdue: [GOAL_ENTRY], today: [], tomorrow: [] });
    el.hiddenCount = 1;
    expect(el.shadowRoot.querySelector('.upcoming-scroll').contains(link(el))).toBe(false);
  });
});
