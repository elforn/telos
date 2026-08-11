// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/date-filter-row/date-filter-row.js';

function mount(selected = []) {
  const el = document.createElement('date-filter-row');
  document.body.appendChild(el);
  el.selected = selected;
  return el;
}

function pills(el) {
  return [...el.shadowRoot.querySelectorAll('.filter-date-pill')];
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('date-filter-row — rendering', () => {
  it('renders the 5 bucket pills in order', () => {
    const el = mount();
    expect(pills(el).map(p => p.dataset.date)).toEqual(['overdue', 'week', 'month', 'later', 'none']);
  });

  it('marks pills in `selected` as active with aria-pressed true', () => {
    const el = mount(['week', 'overdue']);
    const week = pills(el).find(p => p.dataset.date === 'week');
    const month = pills(el).find(p => p.dataset.date === 'month');
    expect(week.classList.contains('active')).toBe(true);
    expect(week.getAttribute('aria-pressed')).toBe('true');
    expect(month.classList.contains('active')).toBe(false);
    expect(month.getAttribute('aria-pressed')).toBe('false');
  });

  it('accepts a Set as well as an array for `selected`', () => {
    const el = mount();
    el.selected = new Set(['later']);
    const later = pills(el).find(p => p.dataset.date === 'later');
    expect(later.classList.contains('active')).toBe(true);
  });

  it('selected getter returns a copy, not a live reference', () => {
    const el = mount(['week']);
    const got = el.selected;
    got.add('month');
    expect(el.selected).toEqual(new Set(['week']));
  });
});

describe('date-filter-row — events', () => {
  it('fires date-toggle with the clicked key', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('date-toggle', e => spy(e.detail.key));
    pills(el).find(p => p.dataset.date === 'overdue').click();
    expect(spy).toHaveBeenCalledWith('overdue');
  });

  it('does not mutate `selected` itself — the parent owns the Set', () => {
    const el = mount(['week']);
    pills(el).find(p => p.dataset.date === 'week').click();
    expect(el.selected).toEqual(new Set(['week']));
  });

  it('re-renders pressed state when `selected` is set again, without dispatching date-toggle', () => {
    const el = mount([]);
    const spy = vi.fn();
    el.addEventListener('date-toggle', spy);
    el.selected = ['month'];
    const month = pills(el).find(p => p.dataset.date === 'month');
    expect(month.classList.contains('active')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
