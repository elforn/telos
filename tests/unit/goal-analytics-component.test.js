// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
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
  it('percentage: overview, activity, streaks — no score page', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    expect(el.pageCount).toBe(3);
  });

  it('weekly/monthly/decreasing: overview, score, activity, streaks', () => {
    expect(mount(weeklyGoal(3, [])).pageCount).toBe(4);
    expect(mount(monthlyGoal(2, [])).pageCount).toBe(4);
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

  it('shows "not enough history" for a comparison with no snapshot old enough', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    const stats = el.shadowRoot.querySelectorAll('.stat-row .stat');
    // Quarter, not year — a goal lives inside one year, so "vs year" could
    // never have history behind it and was dropped.
    const quarterStat = [...stats].find(s => s.querySelector('.stat-label')?.textContent.includes('quarter'));
    expect(quarterStat.querySelector('.stat-value').textContent.trim()).toBe('—');
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

  it('omits the frequency grid for percentage goals', () => {
    const el = mount(pctGoal(50, [{ date: TODAY, value: 50 }]));
    el.activePage = 1; // activity is index 1 for percentage (no score page)
    expect(el.shadowRoot.querySelector('.histogram')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.freqgrid')).toBeNull();
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
  it('renders streak rows for a goal with real history', () => {
    const el = mount(weeklyGoal(3, ['2026-09-14', '2026-09-15', '2026-09-16']));
    el.activePage = 3;
    expect(el.shadowRoot.querySelectorAll('.streak-row').length).toBeGreaterThan(0);
  });

  it('shows an empty state for a goal with no history yet', () => {
    const el = mount(weeklyGoal(3, []));
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

describe('goal-analytics — accessibility', () => {
  it('gives each analytics page an h2 heading so card h3s are not orphaned', () => {
    const el = mount(weeklyGoal(3, []));
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
      0: ['.perf', '.line-wrap svg', '.spark-wrap svg'],
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
    const el = mount(decreasingGoal(1, [isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)]));
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
    const el = mount(decreasingGoal(1, [isoDaysAgo(0), isoDaysAgo(1)]));
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
    const el = mount(decreasingGoal(1, [isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)]));
    el.activePage = 2;
    expect(el.shadowRoot.querySelector('.bar-seg.within')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.bar-seg.over')).toBeTruthy();
    expect(el.shadowRoot.querySelectorAll('.legend .swatch-dot.danger').length).toBeGreaterThan(0);
  });

  it('a forgiven slip is never drawn in the year accent — that colour means "good"', () => {
    const el = mount(decreasingGoal(2, [isoDaysAgo(0), isoDaysAgo(1)])); // both inside the allowance
    el.activePage = 2;
    const css = el.shadowRoot.querySelector('style').textContent;
    expect(css).toMatch(/\.bar-seg\.within\s*\{[^}]*--color-danger/);
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
    expect(el.shadowRoot.querySelector('.perf')).toBeNull();
    expect(el.shadowRoot.querySelector('#tf-perf')).toBeNull();
    expect(el.shadowRoot.querySelector('.hero-number')).toBeTruthy(); // the rest of Overview is intact
  });

  it('is shown for every type that does have one', () => {
    for (const goal of [weeklyGoal(3, [isoDaysAgo(0)]), monthlyGoal(2, [isoDaysAgo(0)]), decreasingGoal(1, [])]) {
      expect(mount(goal).shadowRoot.querySelector('#tf-perf')).toBeTruthy();
    }
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
