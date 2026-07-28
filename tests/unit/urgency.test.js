import { describe, it, expect } from 'vitest';
import { daysUntil, urgencyOf, mostUrgent, urgentCount, formatCount, URGENCY_ORDER } from '../../app/utils/urgency.js';

// Local YYYY-MM-DD offset from today, matching todayISO()'s local-calendar basis.
function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('urgency — urgencyOf buckets', () => {
  it('returns none for no date', () => {
    expect(urgencyOf(undefined, true)).toBe('none');
    expect(urgencyOf('', true)).toBe('none');
  });

  it('returns none when inactive, regardless of date', () => {
    expect(urgencyOf(isoDaysFromNow(-5), false)).toBe('none');
    expect(urgencyOf(isoDaysFromNow(0), false)).toBe('none');
  });

  it('classifies overdue / today', () => {
    expect(urgencyOf(isoDaysFromNow(-1), true)).toBe('overdue');
    expect(urgencyOf(isoDaysFromNow(-30), true)).toBe('overdue');
    expect(urgencyOf(isoDaysFromNow(0), true)).toBe('today');
  });

  it('classifies week boundary (1–7 days)', () => {
    expect(urgencyOf(isoDaysFromNow(1), true)).toBe('week');
    expect(urgencyOf(isoDaysFromNow(7), true)).toBe('week');
  });

  it('classifies month boundary (8–30 days)', () => {
    expect(urgencyOf(isoDaysFromNow(8), true)).toBe('month');
    expect(urgencyOf(isoDaysFromNow(30), true)).toBe('month');
  });

  it('classifies far (> 30 days)', () => {
    expect(urgencyOf(isoDaysFromNow(31), true)).toBe('far');
    expect(urgencyOf(isoDaysFromNow(400), true)).toBe('far');
  });
});

describe('urgency — daysUntil across boundaries', () => {
  it('handles month and year boundaries via local parsing', () => {
    // Anchored, DST-independent whole-day diffs.
    // (round of ms/day tolerates any DST shift within the span.)
    expect(daysUntil(isoDaysFromNow(0))).toBe(0);
    expect(daysUntil(isoDaysFromNow(45))).toBe(45);
    expect(daysUntil(isoDaysFromNow(-45))).toBe(-45);
    expect(daysUntil(isoDaysFromNow(365))).toBe(365);
  });
});

describe('urgency — mostUrgent aggregation', () => {
  it('picks the highest-ranked bucket', () => {
    expect(mostUrgent(['far', 'month', 'week'])).toBe('week');
    expect(mostUrgent(['month', 'overdue', 'today'])).toBe('overdue');
    expect(mostUrgent(['today', 'week'])).toBe('today');
  });

  it('returns none for an empty set or all-none', () => {
    expect(mostUrgent([])).toBe('none');
    expect(mostUrgent(['none', 'none'])).toBe('none');
  });

  it('orders overdue > today > week > month > far > none', () => {
    expect(URGENCY_ORDER).toEqual(['none', 'far', 'month', 'week', 'today', 'overdue']);
  });
});

describe('urgency — urgentCount', () => {
  it('counts only today + overdue', () => {
    expect(urgentCount(['overdue', 'today', 'week', 'month', 'far'])).toBe(2);
    expect(urgentCount(['overdue', 'overdue', 'today'])).toBe(3);
  });

  it('is zero for green/yellow/grey-only aggregates', () => {
    expect(urgentCount(['week', 'month', 'far'])).toBe(0);
    expect(urgentCount([])).toBe(0);
    expect(urgentCount(['none'])).toBe(0);
  });
});

describe('urgency — formatCount', () => {
  it('shows the exact number up to 99', () => {
    expect(formatCount(1)).toBe('1');
    expect(formatCount(9)).toBe('9');
    expect(formatCount(99)).toBe('99');
  });

  it('shows a bare + beyond 99 (keeps the badge to two chars)', () => {
    expect(formatCount(100)).toBe('+');
    expect(formatCount(234)).toBe('+');
  });
});
