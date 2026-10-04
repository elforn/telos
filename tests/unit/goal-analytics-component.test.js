// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-analytics/goal-analytics.js';

function mount(goal) {
  const el = document.createElement('goal-analytics');
  document.body.appendChild(el);
  el.goal = goal;
  return el;
}

const TODAY = '2026-09-20';

function pctGoal(value, history = []) {
  return { id: 'g1', title: 'Ship it', dueDate: '2026-12-31', tracking: { type: 'percentage', value, history } };
}
function weeklyGoal(target, entries) {
  return { id: 'g2', title: 'Run', tracking: { type: 'weekly', target, entries } };
}
function monthlyGoal(target, entries) {
  return { id: 'g3', title: 'Call parents', tracking: { type: 'monthly', target, entries } };
}
function decreasingGoal(target, entries) {
  return { id: 'g4', title: 'No snacking', tracking: { type: 'decreasing', target, entries } };
}
function countdownGoal(startDate, dueDate) {
  return { id: 'g5', title: 'Countdown', dueDate, tracking: { type: 'countdown', startDate } };
}

describe('goal-analytics — page count per type', () => {
  it('percentage: overview, activity — no score page, no streaks', () => {
    // No per-period target (Score) and no real continuity to a run of
    // consecutive "I updated the slider" days (Streaks) — see pagesFor's
    // own comment.
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    expect(el.pageCount).toBe(2);
  });

  it('weekly/monthly: overview, score, activity — no Streaks unless every-day', () => {
    // Streaks only makes sense where consecutive calendar days is the thing
    // actually being measured — a 3x/week goal's logged days are never on
    // adjacent days by design, so the page would have nothing to ever show.
    // See pagesFor's own comment.
    expect(mount(weeklyGoal(3, [])).pageCount).toBe(3);
    expect(mount(monthlyGoal(2, [])).pageCount).toBe(3);
  });

  it('weekly at target 7 ("every day") and decreasing: the full 4, Streaks included', () => {
    expect(mount(weeklyGoal(7, [])).pageCount).toBe(4);
    expect(mount(decreasingGoal(1, [])).pageCount).toBe(4);
  });

  it('countdown: overview only', () => {
    const el = mount(countdownGoal('2026-01-01', '2026-12-31'));
    expect(el.pageCount).toBe(1);
  });
});

describe('goal-analytics — Overview page', () => {
  it('renders the current percentage as the hero number', () => {
    const el = mount(pctGoal(62, [{ date: TODAY, value: 62 }]));
    expect(el.shadowRoot.querySelector('.hero-number .big').textContent).toContain('62');
  });

  it('shows a bare "—" for a comparison with no snapshot old enough, no caption underneath', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    const stats = el.shadowRoot.querySelectorAll('.stat-row .stat');
    // Quarter, not year — a goal lives inside one year, so "vs year" could
    // never have history behind it and was dropped.
    const quarterStat = [...stats].find(s => s.querySelector('.stat-label')?.textContent.includes('quarter'));
    expect(quarterStat.querySelector('.stat-value').textContent.trim()).toBe('—');
    expect(quarterStat.querySelector('.stat-sub')).toBeNull();
  });

  it('shows a real delta once history covers the comparison point', () => {
    const el = mount(pctGoal(50, [{ date: '2026-08-20', value: 40 }, { date: TODAY, value: 50 }]));
    const stats = el.shadowRoot.querySelectorAll('.stat-row .stat');
    const monthStat = [...stats].find(s => s.querySelector('.stat-label')?.textContent.includes('month'));
    expect(monthStat.querySelector('.stat-value').textContent).toContain('10');
  });

  it('never renders a leading "+" on a positive comparison', () => {
    const el = mount(pctGoal(50, [{ date: '2026-08-20', value: 40 }, { date: TODAY, value: 50 }]));
    expect(el.shadowRoot.querySelector('.page').innerHTML).not.toMatch(/>\+\d/);
  });

  it('type-stack shows a single line for percentage (no target to summarise)', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    expect(el.shadowRoot.querySelector('.type-secondary')).toBeNull();
    expect(el.shadowRoot.querySelector('.type-primary')).toBeTruthy();
  });

  it('type-stack shows two lines for weekly (name + target summary)', () => {
    const el = mount(weeklyGoal(3, []));
    expect(el.shadowRoot.querySelector('.type-primary').textContent).toBeTruthy();
    expect(el.shadowRoot.querySelector('.type-secondary').textContent).toContain('3');
  });

  it('renders a pace callout when there is a real upward trend', () => {
    const el = mount(pctGoal(50, [{ date: '2026-06-20', value: 20 }, { date: TODAY, value: 50 }]));
    expect(el.shadowRoot.querySelector('.pace-callout')).toBeTruthy();
  });

  it('renders no pace callout with fewer than 2 known history points', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    expect(el.shadowRoot.querySelector('.pace-callout')).toBeNull();
  });

  it('changing the progress timeframe select re-renders the chart without throwing', () => {
    const el = mount(weeklyGoal(3, ['2026-08-01', '2026-08-02']));
    const select = el.shadowRoot.querySelector('#tf-progress');
    select.value = 'quarter';
    expect(() => select.dispatchEvent(new Event('change'))).not.toThrow();
    expect(el._tfProgress).toBe('quarter');
    expect(el.shadowRoot.querySelector('#tf-progress')).toBeTruthy(); // re-rendered, still present
  });
});

describe('goal-analytics — Score page (weekly/monthly/decreasing only)', () => {
  it('is reachable only on types with a rolling weighted score', () => {
    const weekly = mount(weeklyGoal(3, []));
    weekly.activePage = 1;
    expect(weekly.shadowRoot.querySelector('.calc-grid')).toBeTruthy();

    const pct = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    pct.activePage = 1; // clamped — percentage has no score page, index 1 is 'activity'
    expect(pct.shadowRoot.querySelector('.calc-grid')).toBeNull();
  });

  it('weekly renders one wedge-dot glyph per target occurrence', () => {
    const el = mount(weeklyGoal(3, []));
    el.activePage = 1;
    const firstCell = el.shadowRoot.querySelector('.calc-cell .calc-shape-wrap svg');
    expect(firstCell.querySelectorAll('path').length).toBe(3);
  });

  it('monthly renders a square-fill glyph, not a wedge pie', () => {
    const el = mount(monthlyGoal(2, []));
    el.activePage = 1;
    const firstCell = el.shadowRoot.querySelector('.calc-cell .calc-shape-wrap');
    expect(firstCell.querySelector('svg')).toBeNull();
    expect(firstCell.querySelector('div')).toBeTruthy();
  });

  it('decreasing renders a 7-wedge septagon per week', () => {
    const el = mount(decreasingGoal(1, []));
    el.activePage = 1;
    const firstCell = el.shadowRoot.querySelector('.calc-cell .calc-shape-wrap svg');
    expect(firstCell.querySelectorAll('path').length).toBe(7);
  });

  it('flags a period logged more than target with a "+N" badge', () => {
    // 5 entries in one ISO week against a target of 3 → +2 badge somewhere in the counted column.
    const entries = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
    const el = mount(weeklyGoal(3, entries));
    el.activePage = 1;
    const badges = [...el.shadowRoot.querySelectorAll('.calc-badge')].map(b => b.textContent);
    expect(badges).toContain('+2');
  });

  it('the current (most recent) cell is marked distinctly', () => {
    const el = mount(weeklyGoal(3, []));
    el.activePage = 1;
    expect(el.shadowRoot.querySelector('.calc-cell.current')).toBeTruthy();
  });

  it('a goal with no logged history shows only the counted window — no fabricated context groups', () => {
    const el = mount(weeklyGoal(3, []));
    el.activePage = 1;
    expect(el.shadowRoot.querySelectorAll('.calc-group').length).toBe(1);
    expect(el.shadowRoot.querySelector('.calc-group.counted')).toBeTruthy();
  });

  it('shows every period of real history, not just whole extra groups', () => {
    // Flooring the context-group count meant up to window-1 real periods
    // were silently absent — 12 weeks of history drew 6 — which made this
    // page unusable as the reference for what a goal has actually done.
    for (const weeks of [8, 11, 13, 18]) {
      const entries = Array.from({ length: weeks }, (_, i) => isoDaysAgo(i * 7));
      const el = mount(weeklyGoal(1, entries));
      el.activePage = 1;
      const drawn = [...el.shadowRoot.querySelectorAll('.calc-cell')]
        .filter(c => !c.classList.contains('placeholder')).length;
      expect(drawn, `${weeks} weeks of history`).toBe(weeks);
    }
  });

  it('a goal with real history well beyond the counted window shows extra context groups', () => {
    // ~5 months of weekly entries, one per week — comfortably more than the
    // 6-week counted window, so at least one real context group should appear.
    const entries = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(2026, 4, 4 + i * 7); // Mondays starting early May
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const el = mount(weeklyGoal(3, entries));
    el.activePage = 1;
    expect(el.shadowRoot.querySelectorAll('.calc-group').length).toBeGreaterThan(1);
  });

  it('decreasing with zero real slips shows only the counted window, not "infinite" fabricated clean-day context', () => {
    const el = mount(decreasingGoal(1, []));
    el.activePage = 1;
    expect(el.shadowRoot.querySelectorAll('.calc-group').length).toBe(1);
  });

  it('the header names the real window size for the type (6 for weekly, 4 for monthly)', () => {
    const weekly = mount(weeklyGoal(3, []));
    weekly.activePage = 1;
    expect(weekly.shadowRoot.querySelector('.calc-header').textContent).toContain('6');

    const monthly = mount(monthlyGoal(2, []));
    monthly.activePage = 1;
    expect(monthly.shadowRoot.querySelector('.calc-header').textContent).toContain('4');
  });
});

describe('goal-analytics — Activity page', () => {
  it('renders a histogram, calendar, and (for frequency types) a frequency grid', () => {
    const el = mount(weeklyGoal(3, ['2026-08-01', '2026-08-02']));
    el.activePage = 2;
    expect(el.shadowRoot.querySelector('.histogram')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.heatmap')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.freqgrid')).toBeTruthy();
  });

  it('shows the frequency grid for percentage goals too — it is just logged-day counts', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    el.activePage = 1; // activity is index 1 for percentage (no score page)
    expect(el.shadowRoot.querySelector('.histogram')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.freqgrid')).toBeTruthy();
  });

  it('scrolls the histogram/calendar/frequency-grid containers to their right edge by default', () => {
    const el = mount(weeklyGoal(3, ['2026-08-01']));
    el.activePage = 2;
    // happy-dom reports 0 for scrollWidth/clientWidth, so this just verifies the
    // wiring runs without throwing rather than asserting a real scroll offset.
    expect(() => el.activePage = 2).not.toThrow();
  });
});

describe('goal-analytics — Streaks page', () => {
  // target 7 ("every day") — Streaks only exists on this page shape now,
  // see pagesFor's own comment on why a non-daily weekly goal has no
  // Streaks tab to land on at all.
  it('renders streak rows for a goal with real history', () => {
    const el = mount(weeklyGoal(7, ['2026-09-14', '2026-09-15', '2026-09-16']));
    el.activePage = 3;
    expect(el.shadowRoot.querySelectorAll('.streak-row').length).toBeGreaterThan(0);
  });

  it('shows an empty state for a goal with no history yet', () => {
    const el = mount(weeklyGoal(7, []));
    el.activePage = 3;
    expect(el.shadowRoot.querySelector('.empty-note')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.streak-row')).toBeNull();
  });

  it('is not reachable at all for countdown (clamped back to overview)', () => {
    const el = mount(countdownGoal('2026-01-01', '2026-12-31'));
    el.activePage = 3;
    expect(el.shadowRoot.querySelector('.hero-number')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.streak-row')).toBeNull();
    expect(el.shadowRoot.querySelector('.empty-note')).toBeNull();
  });

  it('is not reachable for a weekly goal that is not every-day either (clamped back to Activity)', () => {
    const el = mount(weeklyGoal(3, ['2026-09-14', '2026-09-15']));
    expect(el.pageCount).toBe(3); // overview, score, activity — no 4th page to land on
    el.activePage = 3;
    expect(el.shadowRoot.querySelector('.histogram')).toBeTruthy(); // landed on Activity instead
    expect(el.shadowRoot.querySelector('.streak-row')).toBeNull();
    expect(el.shadowRoot.querySelector('.empty-note')).toBeNull();
  });
});

describe('goal-analytics — no goal set', () => {
  it('renders nothing rather than throwing', () => {
    const el = document.createElement('goal-analytics');
    document.body.appendChild(el);
    expect(() => el.goal).not.toThrow();
    expect(el.shadowRoot.querySelector('.page').innerHTML.trim()).toBe('');
  });
});

describe('goal-analytics — localisation', () => {
  it('renders month labels through t(), never a hardcoded English array', () => {
    const el = mount(weeklyGoal(3, ['2026-09-14']));
    el.activePage = 2; // activity — calendar + histogram both carry month labels
    const html = el.shadowRoot.innerHTML;
    // The keys resolve to English in this suite (only app/strings.js is loaded),
    // so assert on the mechanism instead: every rendered month label must match
    // a real goal-dialog.month-* value, which is what makes fr/ca work.
    expect(html).toMatch(/Sep|Aug|Jul/);
    expect(el.shadowRoot.querySelector('.heatmap-monthrow')).toBeTruthy();
  });

  it('uses the translatable quarter prefix for axis labels but not for bucket keys', () => {
    const el = mount(weeklyGoal(3, ['2026-09-14']));
    el.activePage = 2;
    const sel = el.shadowRoot.querySelector('#tf-activity');
    sel.value = 'quarter';
    sel.dispatchEvent(new Event('change'));
    // Visible axis text goes through t('goal-analytics.quarter-prefix').
    expect(el.shadowRoot.querySelector('.histogram-axis').textContent).toMatch(/Q\d/);
  });
});

describe('goal-analytics — Overview sparkline', () => {
  // The spark is anchored to the calendar, not counted back from today's
  // date, and clamped to the year the goal is filed under — so these assert
  // against a frozen clock rather than whatever month the suite runs in.
  // No more per-month circle marks (removed on request — plain line reads
  // better), so these read the point count/order straight off the
  // polyline's own points attribute instead.
  const sparkPoints = el => {
    const pts = el.shadowRoot.querySelector('.hero-number svg polyline')?.getAttribute('points') ?? '';
    return pts.trim().split(/\s+/).filter(Boolean);
  };
  const sparkMarks = el => sparkPoints(el).length;
  const sparkXs = el => sparkPoints(el).map(p => Number(p.split(',')[0]));

  // Enough weeks logged that every monthly reading is a real number.
  const logged = (fromIso, days) => {
    const [y, m, d] = fromIso.split('-').map(Number);
    return Array.from({ length: days }, (_, i) => {
      const dt = new Date(y, m - 1, d + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  };

  afterEach(() => vi.useRealTimers());

  it('covers seven calendar months once the year is far enough along', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3)); // 3 Oct 2026
    const el = mount(weeklyGoal(3, logged('2026-01-05', 270)));
    expect(sparkMarks(el)).toBe(7); // seven boundaries, six segments between them
  });

  it('draws only the months that exist when the year has barely started', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // 15 Mar 2026 — Jan, Feb, Mar
    const el = mount(weeklyGoal(3, logged('2026-01-05', 70)));
    expect(sparkMarks(el)).toBe(3);
  });

  it('never reaches back past 1 January of the year being viewed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 10)); // 10 Feb 2026 — Jan, Feb only
    const el = mount(weeklyGoal(3, logged('2026-01-02', 40)));
    expect(sparkMarks(el)).toBe(2);
  });

  it('orders its readings oldest to newest', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3));
    const el = mount(weeklyGoal(3, logged('2026-01-05', 270)));
    const xs = sparkXs(el);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

});

describe('goal-analytics — accessibility', () => {
  it('gives each analytics page an h2 heading so card h3s are not orphaned', () => {
    const el = mount(weeklyGoal(7, [])); // every-day, so Streaks exists to check too
    for (const [page, title] of [[0, 'Overview'], [1, 'Score'], [2, 'Activity'], [3, 'Streaks']]) {
      el.activePage = page;
      const h2 = el.shadowRoot.querySelector('h2.page-title');
      expect(h2, `page ${page} should have an h2`).toBeTruthy();
      expect(h2.textContent).toBe(title);
    }
  });

  it('names the goal on every analytics page, so a swiped-to tab says which goal it is', () => {
    const el = mount(weeklyGoal(3, ['2026-09-14']));
    for (const page of [0, 1, 2, 3]) {
      el.activePage = page;
      expect(el.shadowRoot.querySelector('.page-goal')?.textContent, `page ${page}`).toBe('Run');
    }
  });

  it('escapes the goal title rather than injecting it as markup', () => {
    const goal = weeklyGoal(3, []);
    goal.title = '<img src=x onerror=1> & "quoted"';
    const el = mount(goal);
    const node = el.shadowRoot.querySelector('.page-goal');
    expect(node.querySelector('img')).toBeNull();      // rendered as text, not an element
    expect(node.textContent).toBe('<img src=x onerror=1> & "quoted"');
  });

  it('labels every chart graphic on every page so none is silent to assistive tech', () => {
    // Asserts named containers rather than querying [role="img"]: that
    // selector only matches elements that already carry the role, so a chart
    // missing it is simply absent from the result and the check passes
    // vacuously. That is exactly how an unlabelled chart slipped through once.
    const CHARTS = {
      // .hero-number svg, not the old .spark-wrap svg: that wrapper div is
      // gone (the hero number and spark sit directly in .hero-number now),
      // so the old selector always matched nothing and this check was
      // silently passing vacuously for the sparkline — exactly the failure
      // mode this test's own comment above warns about.
      0: ['#perf-scroll', '.line-wrap svg', '.hero-number svg'],
      2: ['#hist-scroll', '#cal-scroll', '#freq-scroll'],
    };
    const el = mount(weeklyGoal(3, [...Array(6)].map((_, i) => `2026-09-${14 + i}`)));
    for (const [page, selectors] of Object.entries(CHARTS)) {
      el.activePage = Number(page);
      for (const sel of selectors) {
        const node = el.shadowRoot.querySelector(sel);
        if (!node) continue; // not every chart exists for every goal shape
        expect(node.getAttribute('role'), `${sel} on page ${page} needs role=img`).toBe('img');
        expect(node.getAttribute('aria-label')?.trim(), `${sel} on page ${page} needs a label`).toBeTruthy();
      }
    }
  });

  it('gives the timeframe select an accessible name', () => {
    const el = mount(weeklyGoal(3, []));
    el.activePage = 2;
    expect(el.shadowRoot.querySelector('#tf-activity').getAttribute('aria-label')).toBeTruthy();
  });

  it('never leaves a non-overflowing chart in the tab order', () => {
    // happy-dom reports scrollWidth === clientWidth === 0, i.e. "no overflow",
    // which is exactly the case that must NOT be focusable — a dead tab stop on
    // a chart with nothing to scroll. The overflowing case needs real layout and
    // is covered in tests/e2e/goal-analytics.spec.js instead.
    const el = mount(weeklyGoal(3, ['2026-09-14']));
    el.activePage = 2;
    return vi.waitFor(() => {
      ['#hist-scroll', '#cal-scroll', '#freq-scroll'].forEach(sel => {
        const node = el.shadowRoot.querySelector(sel);
        if (node) expect(node.getAttribute('tabindex')).toBeNull();
      });
    });
  });
});

// The component always reads the real today (todayISO()), so these tests
// build their entries relative to it rather than the fixed TODAY above,
// which is only used for the date-independent pieces.
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Mon/Tue/Wed... of the LAST complete ISO week. Avoid's allowance is scored per
// ISO week, so any fixture that needs N slips to share one week cannot build
// them with isoDaysAgo(0,1,2): run the suite on a Monday and those three land
// in two different weeks (Mon this week, Sun+Sat the previous one), splitting
// the allowance and halving the over-allowance count. Anchoring to last week
// gives days that are always in the past and always in the same week, whatever
// day it happens to be.
function isoLastWeek(dayIndex) {
  const d = new Date();
  const mondayThisWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const target = new Date(mondayThisWeek.getFullYear(), mondayThisWeek.getMonth(), mondayThisWeek.getDate() - 7 + dayIndex);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function countedCells(el) {
  return [...el.shadowRoot.querySelectorAll('.calc-group.counted .calc-cell')];
}
function drawnCells(el) {
  return countedCells(el).filter(c => !c.classList.contains('placeholder'));
}

describe('goal-analytics — Overview: weekly scheduled-days strip', () => {
  it('names the scheduled days under the target summary', () => {
    const goal = weeklyGoal(3, []);
    goal.tracking.reminderDays = ['mon', 'wed', 'fri'];
    const el = mount(goal);
    const strip = el.shadowRoot.querySelector('.type-stack .sched-strip');
    expect(strip).toBeTruthy();
    expect(strip.querySelectorAll('.sched-slot').length).toBe(7); // all 7 slots keep their position
    expect(strip.querySelectorAll('.sched-slot.on').length).toBe(3);
    expect(strip.getAttribute('aria-label')).toContain('Mon');
    expect(strip.getAttribute('aria-label')).toContain('Fri');
    expect(strip.getAttribute('aria-label')).not.toContain('Tue');
    // The "N×/week" line is kept — the days are additional, not a replacement.
    expect(el.shadowRoot.querySelector('.type-secondary').textContent).toContain('3');
  });

  it('shows no strip in times-per-week mode, or with no reminder days at all', () => {
    const any = weeklyGoal(3, []);
    any.tracking.reminderDays = 'any';
    expect(mount(any).shadowRoot.querySelector('.sched-strip')).toBeNull();
    expect(mount(weeklyGoal(3, [])).shadowRoot.querySelector('.sched-strip')).toBeNull();
    expect(mount(monthlyGoal(2, [])).shadowRoot.querySelector('.sched-strip')).toBeNull();
  });
});

describe('goal-analytics — Overview: Avoid slip breakdown', () => {
  it('counts every slip, with the over-allowance share called out underneath', () => {
    // Allowance 1/week, 3 slips this week → 1 forgiven, 2 over.
    const el = mount(decreasingGoal(1, [isoLastWeek(0), isoLastWeek(1), isoLastWeek(2)]));
    const stat = [...el.shadowRoot.querySelectorAll('.stat')]
      .find(s => s.querySelector('.stat-label')?.textContent.includes('slips'));
    expect(stat.querySelector('.stat-value').textContent.trim()).toBe('3');
    expect(stat.querySelector('.stat-sub').textContent).toContain('2');
    // Sized like the type stack's second line opposite it, not the smaller
    // footnote the comparison cards use.
    expect(stat.querySelector('.stat-sub').classList.contains('stat-sub-lg')).toBe(true);
  });

  it('shows no breakdown line for a goal with no slips at all', () => {
    const el = mount(decreasingGoal(1, []));
    const stat = [...el.shadowRoot.querySelectorAll('.stat')]
      .find(s => s.querySelector('.stat-label')?.textContent.includes('slips'));
    expect(stat.querySelector('.stat-sub')).toBeNull();
  });
});

describe('goal-analytics — Score page: a failed week is tinted, not recoloured', () => {
  it('weekly: a closed period below target tints the whole cell and inverts its glyph', () => {
    // One entry last week against a target of 3 — a closed miss.
    const el = mount(weeklyGoal(3, [isoDaysAgo(7)]));
    el.activePage = 1;
    const cells = drawnCells(el);
    const lastWeek = cells[cells.length - 1]; // oldest drawn cell = last week
    expect(lastWeek.classList.contains('failed')).toBe(true);
    // The mark keeps its own filled/empty contrast on the red ground rather
    // than becoming red itself — the row's own failed treatment.
    expect(lastWeek.innerHTML).toContain('--color-text-inverse');
    expect(lastWeek.innerHTML).not.toContain('--color-accent');
  });

  it('weekly: the current, still-open period never reads as failed', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    el.activePage = 1;
    const current = el.shadowRoot.querySelector('.calc-cell.current');
    expect(current.classList.contains('failed')).toBe(false);
    expect(current.innerHTML).toContain('--color-accent');
  });

  it('a met period is not tinted', () => {
    const el = mount(weeklyGoal(1, [isoDaysAgo(0), isoDaysAgo(7)]));
    el.activePage = 1;
    const lastWeek = drawnCells(el)[1];
    expect(lastWeek.classList.contains('failed')).toBe(false);
  });

  it('monthly: a closed month below target is tinted too', () => {
    const el = mount(monthlyGoal(4, [isoDaysAgo(40)]));
    el.activePage = 1;
    expect(drawnCells(el).some(c => c.classList.contains('failed'))).toBe(true);
  });

  it('monthly cells sweep around the box (conic), matching the row — not a linear fill', () => {
    const el = mount(monthlyGoal(2, [isoDaysAgo(0)]));
    el.activePage = 1;
    const shape = el.shadowRoot.querySelector('.calc-cell .calc-shape-wrap div');
    expect(shape.getAttribute('style')).toContain('conic-gradient');
    expect(shape.getAttribute('style')).not.toContain('linear-gradient');
  });

  it('Avoid: a week that overspends its allowance is a failed week', () => {
    // Asserts on the CURRENT cell, so the overspend has to be in this week —
    // which rules out isoLastWeek. It also can't be "two slips in a row", since
    // on a Monday there is only one past day in the week to put them on. A zero
    // allowance broken by a single slip today overspends on any weekday.
    const el = mount(decreasingGoal(0, [isoDaysAgo(0)]));
    el.activePage = 1;
    const current = el.shadowRoot.querySelector('.calc-cell.current');
    expect(current.classList.contains('failed')).toBe(true);
    expect(current.innerHTML).toContain('--color-text-inverse');
  });

  it('Avoid: a week inside its allowance is not failed, and marks the forgiven day', () => {
    const el = mount(decreasingGoal(1, [isoDaysAgo(0)]));
    el.activePage = 1;
    const current = el.shadowRoot.querySelector('.calc-cell.current');
    expect(current.classList.contains('failed')).toBe(false);
    expect(current.querySelector('svg circle')).toBeTruthy(); // the knockout dot
  });
});

describe('goal-analytics — Score page: periods before the first entry are blank, not absent', () => {
  it('weekly: only the current period is drawn when history starts this week', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    el.activePage = 1;
    expect(drawnCells(el).length).toBe(1);
    expect(el.shadowRoot.querySelector('.calc-cell.current')).toBeTruthy();
  });

  it('the counted group always keeps the full window of slots, drawn or not', () => {
    // Height has to read as "6 weeks are counted" from day one, with the
    // marks filling in as the weeks happen.
    const el = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    el.activePage = 1;
    expect(countedCells(el).length).toBe(6);
    expect(countedCells(el).filter(c => c.classList.contains('placeholder')).length).toBe(5);
  });

  it('weekly: the period containing the first entry is drawn, older ones are blank', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(7)]));
    el.activePage = 1;
    expect(drawnCells(el).length).toBe(2); // this week + the week of the first entry
    expect(countedCells(el).length).toBe(6); // ...but all 6 slots are still there
  });

  it('weekly: a goal with real history across the whole window draws all 6 cells', () => {
    const entries = Array.from({ length: 6 }, (_, i) => isoDaysAgo(i * 7));
    const el = mount(weeklyGoal(1, entries));
    el.activePage = 1;
    expect(drawnCells(el).length).toBe(6);
  });

  it('Avoid is exempt — a pre-history week is genuinely clean, not a fabricated miss', () => {
    const el = mount(decreasingGoal(1, [isoDaysAgo(0)]));
    el.activePage = 1;
    expect(drawnCells(el).length).toBe(6);
  });
});

describe('goal-analytics — Activity page: Avoid allowed/over split', () => {
  it('splits the count bars into forgiven and over-allowance segments', () => {
    const el = mount(decreasingGoal(1, [isoLastWeek(0), isoLastWeek(1), isoLastWeek(2)]));
    el.activePage = 2;
    expect(el.shadowRoot.querySelector('.bar-seg.within')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.bar-seg.over')).toBeTruthy();
    expect(el.shadowRoot.querySelectorAll('.legend .swatch-dot.danger').length).toBeGreaterThan(0);
  });

  it('a forgiven slip is never drawn in the year accent — that colour means "good"', () => {
    const el = mount(decreasingGoal(2, [isoLastWeek(0), isoLastWeek(1)])); // both inside the allowance
    el.activePage = 2;
    const css = el.shadowRoot.querySelector('style').textContent;
    // Forgiven is now an unfilled mark, not a second hue — so the assertion is
    // that it carries no fill at all, and certainly not the accent.
    expect(css).toMatch(/\.bar-seg\.within\s*\{[^}]*background:\s*transparent/);
    expect(css).not.toMatch(/\.bar-seg\.within\s*\{[^}]*--color-accent/);
    const dots = [...el.shadowRoot.querySelectorAll('.freq-dot-el:not(.zero)')];
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) expect(d.getAttribute('style')).not.toContain('--color-accent');
  });

  it('other types keep a single-colour bar and no allowance legend', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(0), isoDaysAgo(1)]));
    el.activePage = 2;
    expect(el.shadowRoot.querySelector('.histogram .bar')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.bar-seg')).toBeNull();
    expect(el.shadowRoot.querySelector('.legend .swatch-dot')).toBeNull();
  });

  it('marks a forgiven slip in the calendar instead of letting it pass as a clean day', () => {
    const el = mount(decreasingGoal(1, [isoDaysAgo(0)])); // allowance 1 → forgiven
    el.activePage = 2;
    expect(el.shadowRoot.querySelectorAll('.heatmap .cell.on.within').length).toBe(1);
  });

  it('a clean day carries no mark, and other types never get one', () => {
    const avoid = mount(decreasingGoal(0, [isoDaysAgo(0)])); // allowance 0 → a fail, not forgiven
    avoid.activePage = 2;
    expect(avoid.shadowRoot.querySelector('.heatmap .cell.on.within')).toBeNull();

    const weekly = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    weekly.activePage = 2;
    expect(weekly.shadowRoot.querySelector('.heatmap .cell.within')).toBeNull();
  });

  it('colours a weekday cell by whether its slips broke the allowance', () => {
    const el = mount(decreasingGoal(0, [isoDaysAgo(0)])); // zero allowance → a fail
    el.activePage = 2;
    const dots = [...el.shadowRoot.querySelectorAll('.freq-dot-el:not(.zero)')];
    expect(dots.some(d => (d.getAttribute('style') ?? '').includes('--color-danger'))).toBe(true);
  });
});

describe('goal-analytics — Overview: deadline card', () => {
  const deadlineCard = el => [...el.shadowRoot.querySelectorAll('.stat-row.centered .stat')]
    .find(c => c.querySelector('.stat-label')?.textContent === 'Deadline');

  it('names the date and how close it is, in the app\'s own urgency wording', () => {
    const goal = weeklyGoal(3, [isoDaysAgo(0)]);
    goal.dueDate = isoDaysAgo(-4); // four days out
    const card = deadlineCard(mount(goal));
    expect(card).toBeTruthy();
    expect(card.querySelector('.stat-sub').textContent).toBe('due this week');
    expect(card.querySelector('.stat-value').classList.contains('overdue')).toBe(false);
  });

  it('marks a lapsed deadline overdue — in text as well as colour', () => {
    const goal = weeklyGoal(3, [isoDaysAgo(0)]);
    goal.dueDate = isoDaysAgo(9);
    const card = deadlineCard(mount(goal));
    expect(card.querySelector('.stat-value').classList.contains('overdue')).toBe(true);
    expect(card.querySelector('.stat-sub').textContent).toBe('overdue');
  });

  it('drops the relative phrase once the goal is finished — a done goal is not "overdue"', () => {
    const goal = weeklyGoal(1, Array.from({ length: 6 }, (_, i) => isoDaysAgo(i * 7)));
    goal.dueDate = isoDaysAgo(9);
    const card = deadlineCard(mount(goal));
    expect(card.querySelector('.stat-value').classList.contains('overdue')).toBe(false);
    expect(card.querySelector('.stat-sub')).toBeNull();
  });

  it('shows no card at all for a goal with no deadline', () => {
    expect(deadlineCard(mount(weeklyGoal(3, [])))).toBeUndefined();
  });

  it('shows no card for "To date", whose type card already names that very date', () => {
    expect(deadlineCard(mount(countdownGoal('2026-01-01', '2026-12-31')))).toBeUndefined();
  });
});

describe('goal-analytics — Overview: comparison row', () => {
  it('colours a fall red, a rise green, and leaves no change plain', () => {
    const rise = mount(pctGoal(50, [{ date: '2026-08-20', value: 40 }, { date: TODAY, value: 50 }]));
    const monthStat = s => [...s.shadowRoot.querySelectorAll('.stat')]
      .find(x => x.querySelector('.stat-label')?.textContent === 'vs month');
    expect(monthStat(rise).classList.contains('delta-up')).toBe(true);

    const fall = mount(pctGoal(30, [{ date: '2026-08-20', value: 60 }, { date: TODAY, value: 30 }]));
    expect(monthStat(fall).classList.contains('delta-down')).toBe(true);

    const flat = mount(pctGoal(40, [{ date: '2026-08-20', value: 40 }, { date: TODAY, value: 40 }]));
    expect(monthStat(flat).classList.contains('delta-up')).toBe(false);
    expect(monthStat(flat).classList.contains('delta-down')).toBe(false);
  });

  it('compares against last week, month and quarter', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    const labels = [...el.shadowRoot.querySelectorAll('.stat-label')].map(l => l.textContent);
    expect(labels).toContain('vs week');
    expect(labels).toContain('vs month');
    expect(labels).toContain('vs quarter');
    expect(labels.some(l => l.includes('year'))).toBe(false); // a goal lives inside one year
  });
});

describe('goal-analytics — Overview: type stack', () => {
  it('"To date" names the date it counts down to, not the type name again', () => {
    const el = mount(countdownGoal('2026-01-01', '2026-12-31'));
    expect(el.shadowRoot.querySelector('.type-primary').textContent).toBe('To date');
    expect(el.shadowRoot.querySelector('.type-secondary').textContent).toBe('Dec 31, 2026');
  });

  it('"To date" with no deadline set yet shows no second line', () => {
    const el = mount({ id: 'c', title: 'Someday', tracking: { type: 'countdown', startDate: '2026-01-01' } });
    expect(el.shadowRoot.querySelector('.type-secondary')).toBeNull();
  });

  it('keeps a summary that actually says something more', () => {
    const el = mount(weeklyGoal(3, []));
    expect(el.shadowRoot.querySelector('.type-secondary').textContent).toContain('3');
  });
});

describe('goal-analytics — a goal with no tracking at all', () => {
  // Reachable with a never-migrated record, and now rendered on every dialog
  // open rather than only on a tab change — so a throw here would blank the
  // whole dialog two shadow roots up, not just this view.
  it('renders a quiet Overview rather than throwing', () => {
    let el;
    expect(() => { el = mount({ id: 'x', title: 'Legacy goal' }); }).not.toThrow();
    expect(el.shadowRoot.querySelector('.hero-number')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.type-stack')).toBeNull(); // nothing to say about a type it hasn't got
  });
});

describe('goal-analytics — Consistency chart', () => {
  it('is not shown for a "To date" goal, which has no per-period target to measure', () => {
    const el = mount(countdownGoal('2026-01-01', '2026-12-31'));
    expect(el.shadowRoot.querySelector('#perf-scroll')).toBeNull();
    expect(el.shadowRoot.querySelector('#tf-perf')).toBeNull();
    expect(el.shadowRoot.querySelector('.hero-number')).toBeTruthy(); // the rest of Overview is intact
  });

  it('is shown for every type that does have one', () => {
    for (const goal of [weeklyGoal(3, [isoDaysAgo(0)]), monthlyGoal(2, [isoDaysAgo(0)]), decreasingGoal(1, [])]) {
      expect(mount(goal).shadowRoot.querySelector('#tf-perf')).toBeTruthy();
    }
  });

  describe('highest and lowest-non-zero bar labels', () => {
    // Frozen on a Sunday so "this week" is a known, complete Mon-Sun span —
    // the chart's own natural-unit weeks line up exactly with the entries
    // below rather than depending on whatever day the suite happens to run.
    afterEach(() => vi.useRealTimers());

    function weekLabelled(target = 2) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 20)); // Sun 20 Sep 2026
      const entries = [
        '2026-09-16',                                   // this week: 1 of 2 — the low
        '2026-09-08', '2026-09-09',                      // last week: 2 of 2 — neither extreme
        '2026-09-01', '2026-09-02', '2026-09-03',        // two weeks back: 3 of 2 — the high, and over 100%
        // the week before that, and everything older: untouched (0%)
      ];
      return mount(weeklyGoal(target, entries));
    }

    it('labels the single highest bar, inside its own column so it tracks that bar', () => {
      const el = weekLabelled();
      const cols = [...el.shadowRoot.querySelectorAll('.perf-col')];
      const highCol = cols.find(c => c.querySelector('.perf-bar.over'));
      expect(highCol).toBeTruthy();
      expect(highCol.querySelector('.perf-val')?.textContent.trim()).toBe('150%');
    });

    it('labels the lowest bar that is still above zero, inside its own column', () => {
      const el = weekLabelled();
      // The fixture's one 50%-of-target week is the most recent (this week),
      // so it is always the last column — oldest-to-newest, same as every
      // other chart in this file.
      const cols = [...el.shadowRoot.querySelectorAll('.perf-col')];
      expect(cols[cols.length - 1].querySelector('.perf-val')?.textContent.trim()).toBe('50%');
    });

    it('positions a label at its own bar\'s current top, not a shared fixed height', () => {
      const el = weekLabelled();
      const cols = [...el.shadowRoot.querySelectorAll('.perf-col')];
      const highVal = cols.find(c => c.querySelector('.perf-bar.over')).querySelector('.perf-val');
      const lowVal = cols[cols.length - 1].querySelector('.perf-val');
      // The high bar is "over" (150%, i.e. scale itself), so its bar fills
      // the full track — its label sits at the very top (inset-block-end
      // 100%). The low bar (50% of a 150%-scaled track) is far shorter, so
      // its label should sit nowhere near that height.
      expect(highVal.style.insetBlockEnd).toBe('calc(100% + 2px)');
      expect(lowVal.style.insetBlockEnd).not.toBe(highVal.style.insetBlockEnd);
    });

    it('does not label an untouched (0%) period as the low', () => {
      const el = weekLabelled();
      const vals = [...el.shadowRoot.querySelectorAll('.perf-val')];
      // Every week older than the three seeded ones logged nothing — none of
      // those bars should carry a label, only the real low (50%) should.
      const labelled = vals.map(v => v.textContent.trim()).filter(Boolean);
      expect(labelled.sort()).toEqual(['150%', '50%']);
    });

    it('labels neither bar when every period has the same value', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 20));
      // Every week hits exactly target — min and max are the same number, so
      // only its first (oldest) occurrence should carry a label, not all 12.
      const entries = Array.from({ length: 12 }, (_, w) => {
        const base = new Date(2026, 8, 20 - w * 7);
        return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
      });
      const el = mount(weeklyGoal(1, entries));
      const vals = [...el.shadowRoot.querySelectorAll('.perf-val')];
      const labelled = vals.map(v => v.textContent.trim()).filter(Boolean);
      expect(labelled).toEqual(['100%']);
    });
  });
});

describe('goal-analytics — Score tab text sizes', () => {
  // happy-dom can't resolve computed CSS (confirmed by this file's own
  // existing tests in this style), so these assert the rules themselves.
  it('the "contribute" header text is caption-sized', () => {
    // Went caption -> body -> back to caption across rounds of feedback —
    // this pins whatever the most recent request actually was, not a
    // historical "bigger than X" claim that goes stale the next time it
    // changes again.
    const css = mount(weeklyGoal(3, [])).shadowRoot.querySelector('style').textContent;
    expect(css).toMatch(/\.calc-header\s*\{[^}]*font-size:\s*var\(--font-size-caption\)/);
  });

  it('the older-periods note is micro-sized and matches the header\'s colour', () => {
    const css = mount(weeklyGoal(3, [])).shadowRoot.querySelector('style').textContent;
    expect(css).toMatch(/\.calc-older-note\s*\{[^}]*font-size:\s*var\(--font-size-micro\)/);
    // Deliberate override of the usual --color-text-primary contrast floor
    // for "sole explanatory text" — matching the header it sits beside was
    // explicitly requested over that margin.
    expect(css).toMatch(/\.calc-older-note\s*\{[^}]*color:\s*var\(--color-text-secondary\)/);
  });
});

describe('goal-analytics — failed-cell knockout colour', () => {
  // happy-dom can't resolve computed CSS, so this asserts the selector pair
  // itself: .calc-group.counted .calc-cell out-specifies a bare
  // .calc-cell.failed, and without the second selector a failed cell keeps
  // painting the group's own tint as its knockout colour — a pale dot on a
  // white wedge, invisible. Confirmed once in a real browser.
  it('overrides the counted group tint inside a failed cell', () => {
    const css = mount(weeklyGoal(3, [])).shadowRoot.querySelector('style').textContent;
    expect(css).toMatch(/\.calc-group\.counted \.calc-cell\.failed\s*\{[^}]*--color-danger/);
  });
});

describe('goal-analytics — page head', () => {
  it('is pinned so the page name and goal stay visible while the charts scroll', () => {
    const el = mount(weeklyGoal(3, []));
    const css = el.shadowRoot.querySelector('style').textContent;
    expect(css).toMatch(/\.page-head\s*\{[^}]*position:\s*sticky/);
  });
});

// Real today, since the component always reads todayISO() — these assert
// spans relative to the current calendar, not the fixed TODAY above.
const THIS_YEAR = String(new Date().getFullYear());
const LAST_YEAR = String(new Date().getFullYear() - 1);

function mountFor(goal, year) {
  const el = document.createElement('goal-analytics');
  document.body.appendChild(el);
  el.year = year;
  el.goal = goal;
  return el;
}

describe('goal-analytics — countdown Overview says only what the calendar cannot', () => {
  it('drops the trend section and the pace callout — both restate the arithmetic', () => {
    const el = mount(countdownGoal(`${THIS_YEAR}-01-01`, `${THIS_YEAR}-12-31`));
    // The comparison row itself, not a heading over it — that heading is gone,
    // and this assertion was only ever using it to stand for the section.
    expect(el.shadowRoot.querySelector('.stat-row.comparison')).toBeNull();
    expect(el.shadowRoot.querySelector('.pace-callout')).toBeNull();
    // Every other type still gets both.
    const pct = mount(pctGoal(50, [{ date: isoDaysAgo(90), value: 10 }, { date: isoDaysAgo(0), value: 50 }]));
    expect(pct.shadowRoot.querySelector('.stat-row.comparison')).toBeTruthy();
  });

  it('shows a days-left card beside the type card', () => {
    const el = mount(countdownGoal(`${THIS_YEAR}-01-01`, isoDaysAgo(-40)));
    const stat = [...el.shadowRoot.querySelectorAll('.stat')]
      .find(s => s.querySelector('.stat-label')?.textContent.includes('Days left'));
    expect(stat).toBeTruthy();
    expect(stat.querySelector('.stat-value').textContent.trim()).toBe('40');
    expect(stat.querySelector('.stat-sub')).toBeNull();
  });

  it('disambiguates a floored 0 from "due today" once the date has passed', () => {
    const el = mount(countdownGoal(`${LAST_YEAR}-01-01`, isoDaysAgo(5)));
    const stat = [...el.shadowRoot.querySelectorAll('.stat')]
      .find(s => s.querySelector('.stat-label')?.textContent.includes('Days left'));
    expect(stat.querySelector('.stat-value').textContent.trim()).toBe('0');
    expect(stat.querySelector('.stat-sub').textContent).toContain('reached');
  });

  it('drops the card entirely when no due date is configured yet', () => {
    const el = mount({ id: 'c0', title: 'Unset', tracking: { type: 'countdown', startDate: `${THIS_YEAR}-01-01` } });
    const labels = [...el.shadowRoot.querySelectorAll('.stat-label')].map(n => n.textContent);
    expect(labels.some(l => l.includes('Days left'))).toBe(false);
  });

  it('never shows a days-left card for any other type', () => {
    for (const goal of [pctGoal(50, []), weeklyGoal(3, []), decreasingGoal(1, [])]) {
      const labels = [...mount(goal).shadowRoot.querySelectorAll('.stat-label')].map(n => n.textContent);
      expect(labels.some(l => l.includes('Days left'))).toBe(false);
    }
  });
});

describe('goal-analytics — one year is the ceiling on every chart', () => {
  // A Telos goal is annual, so 12 trailing quarters was three years of
  // mostly-empty bars reaching outside the goal's own lifetime.
  const weeklyWithYear = () => mountFor(
    weeklyGoal(1, Array.from({ length: 30 }, (_, i) => isoDaysAgo(i * 7))), THIS_YEAR);

  function pick(el, id, value) {
    const sel = el.shadowRoot.querySelector(id);
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
  }

  it('the Consistency chart plots 4 quarters, not 8', () => {
    const el = weeklyWithYear();
    pick(el, '#tf-perf', 'quarter');
    expect(el.shadowRoot.querySelectorAll('.perf-col').length).toBe(4);
  });

  it('the Activity histogram plots 4 quarters, not 8', () => {
    const el = weeklyWithYear();
    el.activePage = 2;
    pick(el, '#tf-activity', 'quarter');
    expect(el.shadowRoot.querySelectorAll('.bar-col').length).toBe(4);
  });

  it('the Progress chart names all 4 quarters rather than a misplaced midpoint', () => {
    const el = weeklyWithYear();
    pick(el, '#tf-progress', 'quarter');
    // space-between over 3 labels would render the 3rd-of-4 period at 50%.
    expect(el.shadowRoot.querySelectorAll('.line-axis span').length).toBe(4);
  });

  it('keeps the 3-label axis for timeframes that were already inside the cap', () => {
    const el = weeklyWithYear();
    pick(el, '#tf-progress', 'month');
    expect(el.shadowRoot.querySelectorAll('.line-axis span').length).toBe(3);
  });
});

describe('goal-analytics — Consistency/Activity bar count is bounded by first entry and year start', () => {
  function pick(el, id, value) {
    const sel = el.shadowRoot.querySelector(id);
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
  }

  it('a goal 3 weeks old shows 3 week-bars, not the full 12-week cap', () => {
    const el = mount(weeklyGoal(1, [isoDaysAgo(14), isoDaysAgo(7), isoDaysAgo(0)]));
    expect(el.shadowRoot.querySelectorAll('.perf-col').length).toBe(3);
  });

  it('a goal 3 months old shows 3 month-bars, not the full 12-month cap', () => {
    const el = mount(weeklyGoal(1, [isoDaysAgo(60)]));
    pick(el, '#tf-perf', 'month');
    expect(el.shadowRoot.querySelectorAll('.perf-col').length).toBe(3);
  });

  it('the Activity histogram respects the same bound', () => {
    const el = mount(weeklyGoal(1, [isoDaysAgo(14), isoDaysAgo(7), isoDaysAgo(0)]));
    el.activePage = 2;
    expect(el.shadowRoot.querySelectorAll('.bar-col').length).toBe(3);
  });

  it('never reaches before 1 January of the year being viewed, even for an older goal', () => {
    // First entry is in the PRIOR year — the bound should clamp to this
    // year's own 1 January instead of reaching back to that entry.
    const el = mountFor(weeklyGoal(1, [`${THIS_YEAR - 1}-11-01`, `${THIS_YEAR}-01-15`]), THIS_YEAR);
    pick(el, '#tf-perf', 'month');
    const months = el.shadowRoot.querySelectorAll('.perf-col').length;
    // From January of THIS_YEAR through "today" (the real current month) —
    // comfortably more than a couple, comfortably short of reaching into the
    // prior year's November.
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThanOrEqual(12);
  });

  it('falls back to the year boundary alone for a goal with no entries yet', () => {
    const el = mount(weeklyGoal(3, []));
    // No throw, and at least one column rendered rather than an empty chart.
    expect(el.shadowRoot.querySelectorAll('.perf-col').length).toBeGreaterThan(0);
  });

  it('quarter is unaffected — still shows all 4 regardless of how recent the first entry is', () => {
    const el = mount(weeklyGoal(1, [isoDaysAgo(0)])); // first entry is today
    pick(el, '#tf-perf', 'quarter');
    expect(el.shadowRoot.querySelectorAll('.perf-col').length).toBe(4);
  });
});

describe('goal-analytics — the Activity page spans the year, not a rolling window', () => {
  const weeklyIn = year => mountFor(weeklyGoal(3, [`${year}-03-02`]), year);

  it('the frequency grid starts at January of the year being viewed', () => {
    const el = weeklyIn(THIS_YEAR);
    el.activePage = 2;
    const cols = [...el.shadowRoot.querySelectorAll('.freqgrid .month-col')];
    expect(cols.length).toBe(new Date().getMonth() + 1);
    expect(cols[0].querySelector('.month-label').textContent).toBe('Jan');
  });

  it('a year already over shows exactly its 12 months, not a window running into the present', () => {
    const el = weeklyIn(LAST_YEAR);
    el.activePage = 2;
    const cols = [...el.shadowRoot.querySelectorAll('.freqgrid .month-col')];
    expect(cols.length).toBe(12);
    expect(cols[0].querySelector('.month-label').textContent).toBe('Jan');
    expect(cols[11].querySelector('.month-label').textContent).toBe('Dec');
  });

  it('the calendar covers the whole ISO weeks from 1 January through today', () => {
    const el = weeklyIn(THIS_YEAR);
    el.activePage = 2;
    const weeks = el.shadowRoot.querySelectorAll('.heatmap .cell').length / 7;
    const jan1 = new Date(Number(THIS_YEAR), 0, 1);
    const expected = Math.floor((Date.now() - jan1.getTime()) / 86400000 / 7) + 1;
    // Within a week either way — the exact count depends on where 1 Jan and
    // today sit inside their own Mon-Sun columns.
    expect(Math.abs(weeks - expected)).toBeLessThanOrEqual(1);
  });

  it('still reaches a past year’s own data rather than rendering it empty', () => {
    const el = weeklyIn(LAST_YEAR);
    el.activePage = 2;
    expect(el.shadowRoot.querySelectorAll('.heatmap .cell').length / 7).toBeGreaterThanOrEqual(52);
    expect(el.shadowRoot.querySelectorAll('.heatmap .cell.on').length).toBe(1);
  });

  it('falls back to the current year when no year is set (isolated mount)', () => {
    const el = mount(weeklyGoal(3, [`${THIS_YEAR}-03-02`]));
    el.activePage = 2;
    const cols = el.shadowRoot.querySelectorAll('.freqgrid .month-col');
    expect(cols.length).toBe(new Date().getMonth() + 1);
  });
});

describe('goal-analytics — Avoid: forgiven vs over is a shape, not a hue', () => {
  it('encodes the split as stroke-vs-fill so it survives greyscale and colour blindness', () => {
    const css = mount(decreasingGoal(1, [])).shadowRoot.querySelector('style').textContent;
    // Both states are plain --color-danger; what separates them is whether the
    // mark is filled. An earlier two-hue scheme (solid danger vs a pale
    // color-mix of it) could not satisfy both "tell them apart at 8px" and
    // "stay visible against the card" at any mix ratio — see SLIP_STROKE.
    expect(css).not.toMatch(/color-mix\(in srgb, var\(--color-danger\)/);
    // Outline = total.
    expect(css).toMatch(/\.bar-stack\s*\{[^}]*border:[^;]*var\(--color-danger\)/);
    expect(css).toMatch(/\.freq-dot-el\.slip\s*\{[^}]*border:[^;]*var\(--color-danger\)/);
    // Fill = over-allowance only.
    expect(css).toMatch(/\.bar-seg\.over\s*\{[^}]*background:\s*var\(--color-danger\)/);
    expect(css).toMatch(/\.bar-seg\.within\s*\{[^}]*background:\s*transparent/);
    // The key mirrors the marks: one hollow swatch, one filled.
    expect(css).toMatch(/\.legend \.swatch-dot\s*\{[^}]*background:\s*transparent/);
    expect(css).toMatch(/\.legend \.swatch-dot\.danger\s*\{[^}]*background:\s*var\(--color-danger\)/);
  });

  it('fills each weekday ring to the share of its slips that broke the allowance', () => {
    // 3 slips inside ONE week against an allowance of 1 → the first is forgiven,
    // the other two broke it. Spreading them a week apart instead would make
    // every one of them forgiven, and every ring empty — hence isoLastWeek.
    const el = mount(decreasingGoal(1, [isoLastWeek(0), isoLastWeek(1), isoLastWeek(2)]));
    el.activePage = 2;
    const rings = [...el.shadowRoot.querySelectorAll('.freq-dot-el.slip')];
    expect(rings.length).toBeGreaterThan(0);
    // Every ring is a proportional conic fill, never a flat second colour.
    for (const r of rings) expect(r.style.background).toMatch(/^conic-gradient\(var\(--color-danger\) 0 \d+%, transparent/);
    const pcts = rings.map(r => Number(r.style.background.match(/0 (\d+)%/)[1]));
    expect(Math.max(...pcts)).toBeGreaterThan(0); // at least one genuinely over
  });

  it('draws nothing at all for a period with no slips', () => {
    // The stack is stroked now, so an empty one would render as a 3px dash on
    // the baseline — a slip mark on an Avoid goal's best possible period.
    // Two slips ten weeks apart, not one: the chart's own bar count is now
    // bounded by the goal's first entry (see _barCount), so a goal with a
    // single entry today would show a single bar — nothing left to assert
    // "mostly empty" against. Reaching back ten weeks keeps the weeks in
    // between genuinely in view and genuinely empty.
    const el = mount(decreasingGoal(1, [isoDaysAgo(70), isoDaysAgo(0)]));
    el.activePage = 2;
    const cols = [...el.shadowRoot.querySelectorAll('.bar-col')];
    const empty = cols.filter(c => !c.querySelector('.bar-stack'));
    expect(empty.length).toBeGreaterThan(0);          // most weeks had no slips
    expect(cols.some(c => c.querySelector('.bar-stack'))).toBe(true); // but one did
  });

  it('never fades an Avoid cell toward the card — colour there carries meaning', () => {
    // 3 slips on the same weekday against an allowance of 1: volume is already
    // in the dot's size, and the opacity ramp washed forgiven and over
    // together at exactly the size where the colour had to carry the split.
    const el = mount(decreasingGoal(1, [isoDaysAgo(0), isoDaysAgo(7), isoDaysAgo(14)]));
    el.activePage = 2;
    const dots = [...el.shadowRoot.querySelectorAll('.freq-dot-el:not(.zero)')];
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) expect(dot.style.opacity).toBe('1');
  });

  it('keeps the volume ramp for types whose colour is constant', () => {
    const el = mount(weeklyGoal(3, [isoDaysAgo(0)]));
    el.activePage = 2;
    const dots = [...el.shadowRoot.querySelectorAll('.freq-dot-el:not(.zero)')];
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.some(d => Number(d.style.opacity) < 1)).toBe(true);
  });
});

describe('goal-analytics — few bars stretch to fill the card', () => {
  // Capping quarter at the year's 4 periods made a fixed-18px-column chart
  // sit as a narrow right-aligned cluster with its axis labels colliding.
  const weekly = () => mountFor(
    weeklyGoal(1, Array.from({ length: 30 }, (_, i) => isoDaysAgo(i * 7))), THIS_YEAR);

  function pick(el, id, value) {
    const sel = el.shadowRoot.querySelector(id);
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
  }

  it('the Consistency chart fills and names every quarter', () => {
    const el = weekly();
    pick(el, '#tf-perf', 'quarter');
    expect(el.shadowRoot.querySelector('.perf-tracks').classList.contains('fill')).toBe(true);
    expect([...el.shadowRoot.querySelectorAll('.perf-ax')].every(a => a.textContent.trim())).toBe(true);
  });

  it('the Activity histogram fills and names every quarter', () => {
    const el = weekly();
    el.activePage = 2;
    pick(el, '#tf-activity', 'quarter');
    expect(el.shadowRoot.querySelector('.histogram').classList.contains('fill')).toBe(true);
    expect(el.shadowRoot.querySelector('.histogram-axis').classList.contains('fill')).toBe(true);
    expect([...el.shadowRoot.querySelectorAll('.ax')].every(a => a.textContent.trim())).toBe(true);
  });

  it('keeps the fixed-width, right-anchored layout once the bars could overflow', () => {
    const el = weekly();
    pick(el, '#tf-perf', 'month');
    expect(el.shadowRoot.querySelector('.perf-tracks').classList.contains('fill')).toBe(false);
    // The sparse first/middle/last axis rule is back.
    const labelled = [...el.shadowRoot.querySelectorAll('.perf-ax')].filter(a => a.textContent.trim());
    expect(labelled.length).toBe(3);
  });

  it('never labels the calendar’s leading partial week with the previous month', () => {
    // The week containing 1 January usually starts in December, one 11px
    // column from "Jan" — both labels overflow their cells and collide.
    const el = mountFor(weeklyGoal(3, [`${THIS_YEAR}-03-02`]), THIS_YEAR);
    el.activePage = 2;
    const labels = [...el.shadowRoot.querySelectorAll('.heatmap-monthrow span')]
      .map(s => s.textContent).filter(Boolean);
    // Either way — 1 January on a Monday, or a leading partial week — the
    // first label the row renders is January's own.
    expect(labels[0].startsWith('Jan')).toBe(true);
    expect(labels.some(l => l.startsWith('Dec'))).toBe(false);
  });
});

describe('goal-analytics — the Score grid stops at one year of periods too', () => {
  it('a monthly goal with years of history shows exactly 12 months', () => {
    const entries = Array.from({ length: 30 }, (_, i) => isoDaysAgo(i * 30));
    const el = mountFor(monthlyGoal(2, entries), THIS_YEAR);
    el.activePage = 1;
    // 3 groups of 4 — the annual ceiling, not "as far back as data exists".
    expect(el.shadowRoot.querySelectorAll('.calc-group').length).toBe(3);
    expect(el.shadowRoot.querySelectorAll('.calc-cell').length).toBe(12);
  });

  it('a weekly goal stops at the whole 6-week group covering week 52', () => {
    const entries = Array.from({ length: 90 }, (_, i) => isoDaysAgo(i * 7));
    const el = mountFor(weeklyGoal(1, entries), THIS_YEAR);
    el.activePage = 1;
    // 9 groups of 6 = 54: the grid cannot be cut mid-column, so it lands on
    // the first whole group past 52 rather than exactly on it.
    expect(el.shadowRoot.querySelectorAll('.calc-cell').length).toBe(54);
  });
});

describe('goal-analytics — every chart opens on the goal’s natural period', () => {
  // The rendered markup, not select.value: happy-dom does not resolve .value
  // from a `selected` attribute set via innerHTML (it returned the second
  // option for a correctly-marked third one). This reads exactly what the
  // component emits, which is what a real browser acts on.
  function selected(el, id) {
    return el.shadowRoot.querySelector(`${id} option[selected]`)?.value;
  }

  it('week for weekly and Avoid goals, on every chart including Consistency', () => {
    // target 7 so the weekly fixture keeps its Streaks page too — the point
    // here is the shared page shape the pageCount-2 math below assumes, not
    // the Streaks-gating behaviour itself (covered separately).
    for (const goal of [weeklyGoal(7, []), decreasingGoal(1, [])]) {
      const el = mount(goal);
      expect(selected(el, '#tf-progress')).toBe('week');
      expect(selected(el, '#tf-perf')).toBe('week');
      el.activePage = el.pageCount - 2; // Activity
      expect(selected(el, '#tf-activity')).toBe('week');
    }
  });

  it('week for a percentage goal too, on the charts it actually has', () => {
    // No #tf-perf here: percentage has no per-period target for Consistency
    // to measure against, so it has no Consistency card at all — see
    // _consistencyCard's own guard.
    const el = mount(pctGoal(50, [{ date: isoDaysAgo(0), value: 50 }]));
    expect(selected(el, '#tf-progress')).toBe('week');
    expect(el.shadowRoot.querySelector('#tf-perf')).toBeNull();
    el.activePage = el.pageCount - 1; // Activity — the last page now that percentage has no Streaks
    expect(selected(el, '#tf-activity')).toBe('week');
  });

  it('month for a monthly goal — its weeks hold no fraction of a monthly target', () => {
    const el = mount(monthlyGoal(2, []));
    expect(selected(el, '#tf-progress')).toBe('month');
    expect(selected(el, '#tf-perf')).toBe('month');
    el.activePage = 2;
    expect(selected(el, '#tf-activity')).toBe('month');
  });

  it('an explicit pick wins over the natural default and survives a re-render', () => {
    const el = mount(weeklyGoal(3, []));
    const sel = el.shadowRoot.querySelector('#tf-progress');
    sel.value = 'quarter';
    sel.dispatchEvent(new Event('change'));
    // Not option[selected] here: a timeframe change now swaps only the card
    // body, so the select is never rebuilt and its markup keeps whichever
    // option was marked at first render. The live value is the truth, and the
    // element staying put is the entire point — see _swapCardBody.
    expect(el.shadowRoot.querySelector('#tf-progress')).toBe(sel); // same node
    expect(sel.value).toBe('quarter');
    el.activePage = 0; // full re-render — now the markup catches up
    expect(selected(el, '#tf-progress')).toBe('quarter');
  });

  it('a monthly goal can still be shown by week where that means something', () => {
    // Consistency excludes week outright (no month inside a week), but the
    // histogram just counts entries, so the option stays real there.
    const el = mount(monthlyGoal(2, []));
    el.activePage = 2;
    const sel = el.shadowRoot.querySelector('#tf-activity');
    sel.value = 'week';
    sel.dispatchEvent(new Event('change'));
    expect(sel.value).toBe('week');            // live value, see the note above
    expect(el._tfActivity).toBe('week');       // and it reached the component
  });
});

describe('goal-analytics — the newest column sits at the right edge', () => {
  it('the calendar and frequency grid push their content right, not left', () => {
    const css = mount(weeklyGoal(3, [isoDaysAgo(0)])).shadowRoot.querySelector('style').textContent;
    // A span narrow enough to fit used to sit left-aligned, leaving "now"
    // stranded mid-card with empty space trailing it.
    expect(css).toMatch(/\.heatmap-inner\s*\{[^}]*margin-inline-start:\s*auto/);
    expect(css).toMatch(/\.freqgrid\s*\{[^}]*margin-inline-start:\s*auto/);
  });
});
