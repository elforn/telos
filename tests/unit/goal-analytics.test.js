import { describe, it, expect } from 'vitest';
import {
  percentValueAt, dateListFor, rawLoggedDates, computeStreaks, topStreaks, MIN_STREAK_DAYS, countByBucket,
  completionSeries, periodPerformanceSeries, recoveryCurve,
  expectedRampSeries,
  comparisonDelta, updateCount, projectPace,
  slipStates, slipDatesByState, firstRecordIso,
  denseSamples, periodSamples, completionSeriesAt, expectedRampSeriesAt, recoveryCurveAt,
} from '../../app/utils/goal-analytics.js';

const TODAY = '2026-09-20'; // a Sunday

function pctGoal(value, history = []) { return { tracking: { type: 'percentage', value, history } }; }
function weeklyGoal(target, entries, extra = {}) { return { tracking: { type: 'weekly', target, entries }, ...extra }; }
function monthlyGoal(target, entries) { return { tracking: { type: 'monthly', target, entries } }; }
function decreasingGoal(target, entries) { return { tracking: { type: 'decreasing', target, entries } }; }
function countdownGoal(startDate, dueDate) { return { dueDate, tracking: { type: 'countdown', startDate } }; }

describe('goal-analytics — percentValueAt', () => {
  it('percentage type: exact-date match', () => {
    const goal = pctGoal(50, [{ date: '2026-08-01', value: 30 }, { date: '2026-09-01', value: 50 }]);
    expect(percentValueAt(goal, '2026-09-01')).toBe(50);
  });

  it('percentage type: carry-forward to the last snapshot before the requested date', () => {
    const goal = pctGoal(50, [{ date: '2026-08-01', value: 30 }, { date: '2026-09-01', value: 50 }]);
    expect(percentValueAt(goal, '2026-08-15')).toBe(30);
    expect(percentValueAt(goal, '2026-12-01')).toBe(50);
  });

  it('percentage type: undefined (not 0) when no snapshot predates the date at all', () => {
    const goal = pctGoal(50, [{ date: '2026-09-01', value: 50 }]);
    expect(percentValueAt(goal, '2026-01-01')).toBeUndefined();
  });

  it('percentage type: undefined when history is empty (legacy goal, never resaved)', () => {
    expect(percentValueAt(pctGoal(50, []), TODAY)).toBeUndefined();
  });

  it('delegates straight through to percentValue for weekly/monthly/decreasing/countdown', () => {
    const weekly = weeklyGoal(3, ['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(percentValueAt(weekly, '2026-09-03')).toBe(percentValueAt(weekly, '2026-09-03'));
    const countdown = countdownGoal('2026-01-01', '2026-12-31');
    expect(percentValueAt(countdown, '2026-07-02')).toBeGreaterThan(0);
  });
});

describe('goal-analytics — percentValueAt is a point-in-time reading', () => {
  // percentValue's todayIso moves the scoring window but still reads the
  // whole entries array, so a period was credited (or charged) with days
  // that had not happened yet at the date being asked about. Harmless for
  // live callers — no entry can be in the future — and wrong in both
  // directions when sampling the past for a chart.
  it('Avoid: a date before any slip is unaffected by slips that came later', () => {
    // Slips Thu/Fri/Sat against an allowance of 2 — one real fail, on the Sat.
    const goal = decreasingGoal(2, ['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(percentValueAt(goal, '2026-09-21')).toBe(100); // Monday: nothing had happened
    expect(percentValueAt(goal, '2026-09-23')).toBe(100);
  });

  it('Avoid: forgiven slips never deduct, and only the over-allowance one does', () => {
    const goal = decreasingGoal(2, ['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(percentValueAt(goal, '2026-09-24')).toBe(100); // first slip, inside the allowance
    expect(percentValueAt(goal, '2026-09-25')).toBe(100); // second, still inside
    expect(percentValueAt(goal, '2026-09-26')).toBeLessThan(100); // third breaks it
  });

  it('Avoid: a run entirely inside the allowance is a flat 100 line', () => {
    const goal = decreasingGoal(3, ['2026-09-24', '2026-09-25', '2026-09-26']);
    for (const iso of ['2026-09-21', '2026-09-24', '2026-09-26', TODAY]) {
      expect(percentValueAt(goal, iso)).toBe(100);
    }
  });

  it('frequency: a date is not credited with entries logged after it', () => {
    const goal = weeklyGoal(3, ['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(percentValueAt(goal, '2026-09-21')).toBe(0); // Monday: nothing logged yet
    expect(percentValueAt(goal, '2026-09-27')).toBeGreaterThan(0);
  });
});

describe('goal-analytics — dateListFor', () => {
  it('percentage: history dates within the cutoff', () => {
    const goal = pctGoal(50, [{ date: '2025-01-01', value: 10 }, { date: '2026-09-01', value: 50 }]);
    expect(dateListFor(goal, TODAY, 60)).toEqual(['2026-09-01']);
  });

  it('weekly/monthly: raw entries within the cutoff', () => {
    const goal = weeklyGoal(3, ['2020-01-01', '2026-09-15']);
    expect(dateListFor(goal, TODAY, 30)).toEqual(['2026-09-15']);
  });

  it('countdown: always empty — no discrete per-day log exists', () => {
    expect(dateListFor(countdownGoal('2026-01-01', '2026-12-31'), TODAY)).toEqual([]);
  });

  it('decreasing: "on track" dates, not raw slip entries — a slip day is excluded, a clean day is included', () => {
    // No entries at all this week → every day should read as on-track (clean).
    const goal = decreasingGoal(1, []);
    const dates = dateListFor(goal, TODAY, 7);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).not.toContain(undefined);
  });

  it('decreasing: a slip beyond the allowance is excluded from the on-track list', () => {
    // Monday this week (TODAY is Sunday 2026-09-20, so Monday is 2026-09-14) slips once, allowance 0.
    const goal = decreasingGoal(0, ['2026-09-14']);
    const dates = dateListFor(goal, TODAY, 7);
    expect(dates).not.toContain('2026-09-14');
  });
});

describe('goal-analytics — computeStreaks / topStreaks', () => {
  it('finds consecutive runs, ignoring gaps', () => {
    const streaks = computeStreaks(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05']);
    expect(streaks).toEqual([
      { start: '2026-01-01', end: '2026-01-03', length: 3 },
      { start: '2026-01-05', end: '2026-01-05', length: 1 },
    ]);
  });

  it('dedupes duplicate dates', () => {
    const streaks = computeStreaks(['2026-01-01', '2026-01-01', '2026-01-02']);
    expect(streaks).toEqual([{ start: '2026-01-01', end: '2026-01-02', length: 2 }]);
  });

  it('empty input yields no streaks', () => {
    expect(computeStreaks([])).toEqual([]);
  });

  it('a single date is its own length-1 streak', () => {
    expect(computeStreaks(['2026-01-01'])).toEqual([{ start: '2026-01-01', end: '2026-01-01', length: 1 }]);
  });

  // A lone logged day is a run of one — computeStreaks reports it (above),
  // but it is not a streak and the Streaks page must not list it.
  it('topStreaks drops runs shorter than MIN_STREAK_DAYS', () => {
    expect(MIN_STREAK_DAYS).toBe(2);
    const dates = ['2026-01-01', '2026-01-05', '2026-01-10', '2026-01-11'];
    expect(computeStreaks(dates).map(s => s.length)).toEqual([1, 1, 2]);
    expect(topStreaks(dates).map(s => s.length)).toEqual([2]);
  });

  it('topStreaks returns nothing when every logged day stands alone', () => {
    expect(topStreaks(['2026-01-01', '2026-01-03', '2026-01-05'])).toEqual([]);
  });

  it('topStreaks keeps a bare two-day run — the shortest thing that counts', () => {
    expect(topStreaks(['2026-01-01', '2026-01-02'])).toEqual([
      { start: '2026-01-01', end: '2026-01-02', length: 2 },
    ]);
  });

  // Filtered before the top-N slice, so single days can't consume slots that
  // genuine streaks would otherwise fill.
  it('topStreaks fills its N slots with real streaks, not single days', () => {
    const dates = [
      '2026-01-01',                              // lone day
      '2026-01-05',                              // lone day
      '2026-02-01', '2026-02-02',                // 2d
      '2026-03-01', '2026-03-02', '2026-03-03',  // 3d
    ];
    expect(topStreaks(dates, 2).map(s => s.length).sort()).toEqual([2, 3]);
  });

  it('topStreaks selects the N longest, then re-sorts by recency — not by length', () => {
    // Two streaks: an 5-day one further back, a 2-day one more recent.
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-02-10', '2026-02-11'];
    const top = topStreaks(dates, 10);
    expect(top[0]).toEqual({ start: '2026-02-10', end: '2026-02-11', length: 2 }); // more recent, shown first
    expect(top[1]).toEqual({ start: '2026-01-01', end: '2026-01-05', length: 5 }); // longer, but older
  });

  // Every date here is part of a two-day run: the original version of this
  // test used five isolated days, which the MIN_STREAK_DAYS floor now
  // discards before the cap is ever reached.
  it('caps at n results', () => {
    const dates = [
      '2026-01-01', '2026-01-02',
      '2026-01-05', '2026-01-06',
      '2026-01-09', '2026-01-10',
    ];
    expect(topStreaks(dates).length).toBe(3);
    expect(topStreaks(dates, 2).length).toBe(2);
  });
});

describe('goal-analytics — countByBucket', () => {
  it('groups by week/month/quarter/year', () => {
    const dates = ['2026-01-05', '2026-01-06', '2026-02-01', '2026-04-01', '2027-01-01'];
    expect([...countByBucket(dates, 'month').values()].reduce((a, b) => a + b, 0)).toBe(5);
    expect(countByBucket(dates, 'quarter').get('2026-Q1')).toBe(3);
    expect(countByBucket(dates, 'year').get('2026')).toBe(4);
    expect(countByBucket(dates, 'year').get('2027')).toBe(1);
  });

  it('handles an ISO-week year-boundary date correctly (delegates to isoWeekKey)', () => {
    // 2026-01-01 is a Thursday, so it belongs to ISO week 1 of 2026, not the tail of 2025.
    const counts = countByBucket(['2026-01-01'], 'week');
    expect(counts.get('2026-W01')).toBe(1);
  });
});

describe('goal-analytics — completionSeries', () => {
  it('returns `count` points, oldest first, ending at todayIso\'s own period', () => {
    const goal = pctGoal(50, [{ date: '2026-09-01', value: 50 }]);
    const series = completionSeries(goal, 'month', 3, TODAY);
    expect(series.length).toBe(3);
    expect(series[series.length - 1].iso).toBe(TODAY);
    expect(series[series.length - 1].value).toBe(50);
  });

  it('leaves undefined values in place for points before any snapshot existed', () => {
    const goal = pctGoal(50, [{ date: TODAY, value: 50 }]);
    const series = completionSeries(goal, 'month', 3, TODAY);
    expect(series[0].value).toBeUndefined(); // 2 months ago — before the only snapshot
    expect(series[2].value).toBe(50);
  });
});

describe('goal-analytics — recoveryCurve is a monotonic ceiling', () => {
  // The ideal goal's synthetic entries sit on the first `target` days of each
  // period. Filtering them to the sampled date (as the achieved line must be)
  // made every Monday read 1-of-3, so the line saw-toothed down at each
  // period boundary and recovered by midweek — true about what is achievable
  // *by Monday*, wrong for a line that answers "if you play every period
  // perfectly, where does the score go".
  it('never dips within a week for a weekly goal', () => {
    const goal = weeklyGoal(3, ['2026-08-18', '2026-09-01', '2026-09-22']);
    const samples = denseSamples('week', 12, TODAY);
    const curve = recoveryCurveAt(goal, samples, TODAY);
    // The last 5 weeks are the ideal half (PERIOD_WINDOW.weekly - 1).
    const tail = curve.slice(samples.findIndex(iso => iso >= '2026-08-17'));
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i], `sample ${i} fell from ${tail[i - 1]} to ${tail[i]}`).toBeGreaterThanOrEqual(tail[i - 1]);
    }
  });

  it('still tracks real history before the window, where a fall is legitimate', () => {
    const goal = weeklyGoal(3, ['2026-06-01', '2026-06-02', '2026-06-03']);
    const curve = recoveryCurveAt(goal, denseSamples('month', 12, TODAY), TODAY);
    expect(curve.some((v, i) => i > 0 && v < curve[i - 1])).toBe(true);
  });
});

describe('goal-analytics — comparisonDelta', () => {
  it('returns null when no snapshot predates the comparison point', () => {
    const goal = pctGoal(50, [{ date: TODAY, value: 50 }]);
    expect(comparisonDelta(goal, 'year', TODAY)).toBeNull();
  });

  it('returns the real delta when history covers the comparison point', () => {
    const goal = pctGoal(50, [{ date: '2026-08-20', value: 40 }, { date: TODAY, value: 50 }]);
    expect(comparisonDelta(goal, 'month', TODAY)).toBe(10);
  });

  it('a negative delta is a plain negative number, not clamped', () => {
    const goal = pctGoal(50, [{ date: '2026-08-20', value: 60 }, { date: TODAY, value: 50 }]);
    expect(comparisonDelta(goal, 'month', TODAY)).toBe(-10);
  });
});

describe('goal-analytics — updateCount', () => {
  it('matches dateListFor\'s own length for weekly/monthly/percentage', () => {
    const goal = weeklyGoal(3, ['2026-09-01', '2026-09-02']);
    expect(updateCount(goal, TODAY, 60)).toBe(dateListFor(goal, TODAY, 60).length);
  });

  it('decreasing: counts real slips, not the much larger on-track-day count from dateListFor', () => {
    const goal = decreasingGoal(1, ['2026-09-14', '2026-09-15']); // 2 real slips
    expect(updateCount(goal, TODAY, 60)).toBe(2);
    // dateListFor's on-track complement for the same goal is a much bigger number
    // (most days in the window read as clean) — confirms the two are genuinely different.
    expect(dateListFor(goal, TODAY, 60).length).toBeGreaterThan(10);
  });
});

describe('goal-analytics — rawLoggedDates', () => {
  it('is identical to dateListFor for weekly/monthly/percentage', () => {
    const goal = monthlyGoal(2, ['2026-08-01', '2026-09-01']);
    expect(rawLoggedDates(goal, TODAY, 90)).toEqual(dateListFor(goal, TODAY, 90));
  });

  it('for decreasing, returns the real slip entries — the inverse of dateListFor', () => {
    const goal = decreasingGoal(0, ['2026-09-14']);
    expect(rawLoggedDates(goal, TODAY, 60)).toEqual(['2026-09-14']);
    expect(dateListFor(goal, TODAY, 60)).not.toContain('2026-09-14');
  });
});

describe('goal-analytics — projectPace', () => {
  it('returns null once already at 100%', () => {
    expect(projectPace(pctGoal(100, [{ date: TODAY, value: 100 }]), TODAY)).toBeNull();
  });

  it('returns null with fewer than 2 known history points', () => {
    expect(projectPace(pctGoal(50, [{ date: TODAY, value: 50 }]), TODAY)).toBeNull();
  });

  it('flags insufficient momentum when the recent trend is flat or declining', () => {
    const goal = pctGoal(50, [{ date: '2026-06-20', value: 52 }, { date: TODAY, value: 50 }]);
    expect(projectPace(goal, TODAY)).toEqual({ insufficientMomentum: true });
  });

  it('projects a finish date from a real upward trend, with no deadline', () => {
    const goal = pctGoal(50, [{ date: '2026-06-20', value: 20 }, { date: TODAY, value: 50 }]);
    const result = projectPace(goal, TODAY);
    expect(result.projectedIso).toBeTruthy();
    expect(result.deadlineIso).toBeUndefined();
  });

  it('compares the projection against a real dueDate when one is set', () => {
    const goal = { ...pctGoal(50, [{ date: '2026-06-20', value: 20 }, { date: TODAY, value: 50 }]), dueDate: '2026-12-31' };
    const result = projectPace(goal, TODAY);
    expect(result.deadlineIso).toBe('2026-12-31');
    expect(typeof result.diffMonths).toBe('number');
  });
});

// Entries placed inside the ISO week N weeks before TODAY. Naively adding N
// days to a week-offset spills across the Monday boundary, which silently
// mis-attributes counts — worth keeping explicit.
function weekEntries(weeksAgo, count, today = TODAY) {
  const [y, m, d] = today.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  const mon = new Date(y, m - 1, d - ((t.getDay() + 6) % 7) - weeksAgo * 7);
  const pad = n => String(n).padStart(2, '0');
  return Array.from({ length: count }, (_, i) => {
    const x = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  });
}

describe('goal-analytics — periodPerformanceSeries', () => {
  it('reports the raw uncapped value when the timeframe is the goal\'s own period', () => {
    const goal = weeklyGoal(3, weekEntries(0, 6)); // 6 of 3 this week
    const [point] = periodPerformanceSeries(goal, 'week', 1, TODAY);
    expect(point.value).toBe(200);
    expect(point.aggregated).toBe(false);
  });

  it('caps each period at 100% before averaging a coarser timeframe', () => {
    // One 200% week and one 0% week: uncapped they average to 100, capped to 50.
    const goal = weeklyGoal(3, [...weekEntries(0, 6), ...weekEntries(1, 0)]);
    const [point] = periodPerformanceSeries(goal, 'quarter', 1, TODAY);
    expect(point.aggregated).toBe(true);
    expect(point.value).toBeLessThan(100);
  });

  it('never lets an over-target period mask a missed one in an aggregate', () => {
    const lumpy  = weeklyGoal(3, [...weekEntries(0, 6), ...weekEntries(1, 0)]);
    const steady = weeklyGoal(3, [...weekEntries(0, 3), ...weekEntries(1, 3)]);
    const lumpyVal  = periodPerformanceSeries(lumpy,  'quarter', 1, TODAY)[0].value;
    const steadyVal = periodPerformanceSeries(steady, 'quarter', 1, TODAY)[0].value;
    // Same total effort, but consistency differs — that is the whole point of
    // capping, and is what distinguishes this from total-over-total.
    expect(steadyVal).toBeGreaterThan(lumpyVal);
  });

  it('aggregates every period in the timebox rather than point-sampling one', () => {
    // The bug this replaced sampled a single week per quarter, so a quarter
    // containing plenty of activity could read 0.
    const goal = weeklyGoal(3, [0,1,2,3,4,5,6,7].flatMap(w => weekEntries(w, 3)));
    const [point] = periodPerformanceSeries(goal, 'quarter', 1, TODAY);
    expect(point.value).toBeGreaterThan(0);
  });

  it('excludes future periods so an in-progress timebox is not dragged down', () => {
    const goal = weeklyGoal(3, weekEntries(0, 3));
    const [point] = periodPerformanceSeries(goal, 'year', 1, TODAY);
    expect(point.value).toBeGreaterThan(0);
  });
});

describe('goal-analytics — recoveryCurve', () => {
  it('reaches exactly 100 at today, since a full window of perfect play is the score', () => {
    const goal = weeklyGoal(3, weekEntries(4, 1));
    const curve = recoveryCurve(goal, 'week', 8, TODAY);
    expect(curve.at(-1)).toBe(100);
  });

  it('is front-loaded, not linear — early perfect periods carry the most weight', () => {
    const goal = weeklyGoal(3, []);
    const curve = recoveryCurve(goal, 'week', 7, TODAY);
    const gains = curve.slice(1).map((v, i) => v - curve[i]);
    // Each later gain is no larger than the one before it; a straight line
    // would make them all equal.
    gains.slice(1).forEach((g, i) => expect(g).toBeLessThanOrEqual(gains[i] + 1));
    expect(gains[0]).toBeGreaterThan(gains.at(-1));
  });

  it('follows real history before the window rather than projecting over it', () => {
    const goal = weeklyGoal(3, [6, 7, 8].flatMap(w => weekEntries(w, 3)));
    const curve = recoveryCurve(goal, 'week', 10, TODAY);
    // Points older than the 6-period window must equal the goal's actual past
    // score — the projection only applies from the window's start onward.
    const older = curve.slice(0, 4);
    expect(older.some(v => v > 0)).toBe(true); // real history is reflected, not flattened
    expect(curve.at(-1)).toBe(100);
  });

  it('returns null for types with no rolling window, leaving their own expected line alone', () => {
    expect(recoveryCurve(pctGoal(50, []), 'month', 6, TODAY)).toBeNull();
    expect(recoveryCurve(countdownGoal('2026-01-01', '2026-12-31'), 'month', 6, TODAY)).toBeNull();
  });
});

describe('goal-analytics — expectedRampSeries (percentage)', () => {
  const hist = (d, v) => ({ date: d, value: v });

  it('draws nothing at all until a percentage has actually been recorded', () => {
    expect(expectedRampSeries(pctGoal(0, []), 'month', 6, TODAY)).toBeNull();
  });

  it('starts at the first recorded value, not an assumed zero', () => {
    const goal = pctGoal(40, [hist('2026-02-10', 25)]);
    const s = expectedRampSeries(goal, 'month', 12, TODAY);
    const firstDrawn = s.find(v => v !== undefined);
    expect(firstDrawn).toBeGreaterThanOrEqual(25);
  });

  it('leaves points before the first snapshot undrawn rather than plotting zero', () => {
    const goal = pctGoal(40, [hist('2026-08-01', 30)]);
    const s = expectedRampSeries(goal, 'month', 12, TODAY);
    expect(s.slice(0, 5).every(v => v === undefined)).toBe(true);
  });

  it('rises monotonically — never the old year-boundary sawtooth', () => {
    const goal = pctGoal(40, [hist('2025-11-01', 10)]);
    const drawn = expectedRampSeries(goal, 'month', 12, TODAY).filter(v => v !== undefined);
    drawn.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(drawn[i]));
  });

  it('aims at the due date when it lands before year end, so the ramp is steeper', () => {
    const base = [hist('2026-02-01', 0)];
    const toYearEnd = expectedRampSeries(pctGoal(40, base), 'month', 12, TODAY);
    const early = { ...pctGoal(40, base), dueDate: '2026-06-30' };
    const toDueDate = expectedRampSeries(early, 'month', 12, TODAY);
    const at = s => s.filter(v => v !== undefined).at(-1);
    expect(at(toDueDate)).toBeGreaterThan(at(toYearEnd));
  });

  it('holds at 100 past the end date instead of running beyond it', () => {
    const goal = { ...pctGoal(40, [hist('2026-01-10', 0)]), dueDate: '2026-05-31' };
    const drawn = expectedRampSeries(goal, 'month', 12, TODAY).filter(v => v !== undefined);
    expect(Math.max(...drawn)).toBe(100);
    expect(drawn.at(-1)).toBe(100);
  });
});

describe('goal-analytics — slipStates / slipDatesByState (Avoid)', () => {
  // TODAY is Sunday 2026-09-20, so 09-14..09-20 is the current ISO week.
  it('ranks slips chronologically against the allowance: the first N are forgiven', () => {
    const goal = decreasingGoal(1, ['2026-09-15', '2026-09-17', '2026-09-18']);
    const states = slipStates(goal, TODAY, 180);
    expect(states.get('2026-09-15')).toBe('within');
    expect(states.get('2026-09-17')).toBe('over');
    expect(states.get('2026-09-18')).toBe('over');
  });

  it('a zero allowance makes every slip a fail', () => {
    const { within, over } = slipDatesByState(decreasingGoal(0, ['2026-09-15', '2026-09-16']), TODAY, 180);
    expect(within).toEqual([]);
    expect(over).toEqual(['2026-09-15', '2026-09-16']);
  });

  it('the allowance refills each week', () => {
    // One slip in each of two weeks, allowance 1/week — both forgiven.
    const goal = decreasingGoal(1, ['2026-09-08', '2026-09-15']);
    const { within, over } = slipDatesByState(goal, TODAY, 180);
    expect(within).toEqual(['2026-09-08', '2026-09-15']);
    expect(over).toEqual([]);
  });

  it('never classifies clean days — only real entries appear at all', () => {
    const states = slipStates(decreasingGoal(1, ['2026-09-15']), TODAY, 180);
    expect(states.size).toBe(1);
  });

  it('is empty for every non-Avoid type (no allowance to sit inside or outside of)', () => {
    expect(slipStates(weeklyGoal(3, ['2026-09-15']), TODAY, 180).size).toBe(0);
    expect(slipStates(monthlyGoal(2, ['2026-09-15']), TODAY, 180).size).toBe(0);
  });

  it('drops slips older than daysBack', () => {
    const goal = decreasingGoal(0, ['2026-01-05', '2026-09-15']);
    expect([...slipStates(goal, TODAY, 30).keys()]).toEqual(['2026-09-15']);
  });
});

describe('goal-analytics — firstRecordIso', () => {
  it('entry types: the earliest entry, whatever order entries are stored in', () => {
    expect(firstRecordIso(weeklyGoal(3, ['2026-09-15', '2026-03-02', '2026-07-01']))).toBe('2026-03-02');
  });

  it('percentage: the first history snapshot', () => {
    expect(firstRecordIso(pctGoal(50, [{ date: '2026-04-01', value: 10 }, { date: TODAY, value: 50 }]))).toBe('2026-04-01');
  });

  it('undefined when nothing has ever been recorded', () => {
    expect(firstRecordIso(weeklyGoal(3, []))).toBeUndefined();
    expect(firstRecordIso(pctGoal(50, []))).toBeUndefined();
  });
});

describe('goal-analytics — denseSamples / completionSeriesAt', () => {
  it('covers the same span as the period samples, ending on today', () => {
    const coarse = periodSamples('month', 12, TODAY);
    const dense = denseSamples('month', 12, TODAY);
    expect(dense[dense.length - 1]).toBe(TODAY);
    expect(dense.length).toBeGreaterThan(coarse.length * 5);
    expect(dense[0] >= coarse[0]).toBe(true);
    expect(daysBetweenIso(dense[0], coarse[0])).toBeLessThanOrEqual(4); // within one sampling step
  });

  it('keeps a uniform step so x position stays linear in time', () => {
    const dense = denseSamples('week', 12, TODAY);
    const gaps = dense.slice(1).map((iso, i) => daysBetweenIso(dense[i], iso));
    expect(new Set(gaps).size).toBe(1);
  });

  it('caps the point count on a long span', () => {
    expect(denseSamples('quarter', 12, TODAY).length).toBeLessThanOrEqual(141);
  });

  // The bug this resolution exists for: a percentage goal set to 10% on 1 May
  // and 100% on 14 May had no monthly sample inside that window at all, so the
  // 10% leg vanished and the line read as a flat 100 from May onward.
  it('percentage: plots a short-lived value as a real step instead of skipping it', () => {
    const goal = pctGoal(100, [{ date: '2026-05-01', value: 10 }, { date: '2026-05-14', value: 100 }]);
    const series = completionSeriesAt(goal, denseSamples('month', 12, TODAY));
    const known = series.filter(p => p.value !== undefined);
    expect(known[0].value).toBe(10);                       // the line starts at 10, not 100
    expect(known.some(p => p.value === 10)).toBe(true);
    expect(known[known.length - 1].value).toBe(100);
    // Nothing before the first snapshot is fabricated.
    expect(series.find(p => p.iso < '2026-05-01').value).toBeUndefined();
    // ...and the step happens where it really happened, not at a period edge.
    const lastTen = known.filter(p => p.value === 10).pop();
    expect(lastTen.iso < '2026-05-14').toBe(true);
    expect(daysBetweenIso(lastTen.iso, '2026-05-14')).toBeLessThanOrEqual(4);
  });

  it('the recovery curve returns one value per sample date, and matches its period-stepping form', () => {
    const goal = weeklyGoal(3, ['2026-09-15', '2026-09-16']);
    const samples = denseSamples('month', 12, TODAY);
    expect(recoveryCurveAt(goal, samples, TODAY).length).toBe(samples.length);
    // The wrapper is the same call over period-boundary dates.
    expect(recoveryCurveAt(goal, periodSamples('month', 12, TODAY), TODAY))
      .toEqual(recoveryCurve(goal, 'month', 12, TODAY));
  });

  it('a goal whose tracking was never migrated produces a series instead of throwing', () => {
    const bare = { id: 'x', title: 'Legacy' };
    expect(() => completionSeriesAt(bare, denseSamples('month', 12, TODAY))).not.toThrow();
    expect(() => periodPerformanceSeries(bare, 'week', 4, TODAY)).not.toThrow();
  });

  it('the expected-pace line is sampled at the same dates, so the two align', () => {
    const goal = pctGoal(100, [{ date: '2026-05-01', value: 10 }]);
    const samples = denseSamples('month', 12, TODAY);
    expect(expectedRampSeriesAt(goal, samples).length).toBe(samples.length);
  });
});

function daysBetweenIso(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da)) / 86400000);
}
