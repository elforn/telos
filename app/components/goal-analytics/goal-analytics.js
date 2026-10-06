import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { todayISO } from '../../utils/today-iso.js';
import {
  isFrequency, isDecreasing, isCountdown, isoWeekKey, monthKey, PERIOD_WINDOW, weekDayStates, daysBetween,
  WEEKDAYS, countdownDaysRemaining,
} from '../../utils/tracking.js';
import {
  pagesFor, percentValueAt, dateListFor, rawLoggedDates, topStreaks, countByBucket,
  periodPerformanceSeries,
  denseSamples, completionSeriesAt, expectedRampSeriesAt, recoveryCurveAt,
  comparisonDelta, updateCount, projectPace,
  slipStates, slipDatesByState, firstRecordIso, naturalUnitFor,
} from '../../utils/goal-analytics.js';
import { urgencyOf } from '../../utils/urgency.js';
import { attachScrollClaim, dominantAxis } from '../../../_lib/core/scroll-claim.js';
import { septagonWedgePath, septagonWedgeState, septagonWedgeCentroid } from '../goal-item/goal-item.js';

// Knockout dot marking a forgiven slip, the same mark the row's septagon
// uses. currentColor, not a fixed token: every surface it can land on — the
// plain card, the tinted counted group, a failed week's solid red — sets its
// own colour on the cell, so one value covers all three rather than three
// hardcoded background guesses that would drift the moment a surface changes.
const SEPTAGON_DOT_FILL = 'currentColor';

// A generous safety cap, not the normal driver — real context group count is
// computed per-goal in _renderScore from how much history actually exists.
const SCORE_CONTEXT_GROUPS_MAX = 12;
const HISTORY_DAYS_BACK = 365; // floor for the data window — see _daysBack

// A goal has no createdAt/first-logged timestamp anywhere in its schema, so
// "how far back does real history go" isn't reliably knowable — a 365-day
// floor is used instead of trying to detect a true start (_daysBack widens it
// when the year being viewed reaches further back than that). Periods within
// that window that happen to be genuinely empty (a goal younger than the
// window) render as real zero-count periods, which is honest, not
// fabricated — there is no synthetic data being invented, just an honestly
// empty result for a period that really has none.

// One year's worth of each timeframe unit — the hard ceiling on how many
// periods any chart here plots. A Telos goal is annual (it is filed under one
// year and nothing carries across), so a chart reaching further back than a
// year is reaching outside the goal's own lifetime: 12 trailing quarters was
// three years of mostly-empty bars. Each chart still picks its own count
// below; this only caps it.
const TIMEFRAME_MAX = { week: 52, month: 12, quarter: 4, year: 1 };

// How many periods each chart asks for, per timeframe. Editorial preferences,
// not a shared rule — the charts answer different questions, so the histogram
// wants a longer run (26 weeks ≈ 6 months of raw volume) than Consistency does
// (12 periods is plenty to read a pass/fail trend). clampPeriods still caps
// every one of these at TIMEFRAME_MAX, so a number raised past a year's worth
// quietly won't take effect — keep them at or under the ceiling.
//
// No 'year' key: _timeframeSelect only ever offers week/month/quarter, so a
// year entry could never be read. There used to be one in each of these, plus
// a quarter of 8 that the annual cap silently overrode — both read like live
// settings while having no effect at all.
const BARS_PROGRESS    = { week: 12, month: 12, quarter: 4 };
const BARS_CONSISTENCY = { week: 12, month: 12, quarter: 4 };
const BARS_HISTOGRAM   = { week: 26, month: 12, quarter: 4 };
// How many calendar months the Overview sparkline covers at most. Seven, not
// six, because the marks are month *boundaries* and the segments between
// them are what reads as a period — the two end marks also trim their own
// line caps, so N months draw N-1 segments. Seven gives six.
//
// Anchored
// to the calendar rather than counted back from today's date, and clamped to
// the year the goal is filed under — a goal is annual, so a window reaching
// before 1 January is reaching outside its own lifetime. Early in the year it
// simply draws fewer segments (March → Jan, Feb, Mar) instead of padding
// empty months in front of them. One unit for every tracking type on purpose:
// the value plotted is the rolling score, which is a continuously-running
// number sampleable at any date, so there is no per-type period to match.
const SPARK_MONTHS = 7;
// Momentum for the hand-rolled chart scroll (see _attachDragScroll). Decay is
// per 16.67ms frame and scaled by real elapsed time, so a janky frame slows the
// coast by the same amount it would have at 60fps rather than overshooting.
const FLING_DECAY = 0.94;
const FLING_MIN_VELOCITY = 0.02; // px/ms — below this a coast is imperceptible

// Score grid glyph sizes (px), named rather than left as bare literals
// because they went through many rounds of live visual tuning this session
// and will likely be tuned again — one spot to change instead of hunting
// through _scoreCell's body. Septagon gets its own, larger size: it draws 7
// wedges where wedge/squareSweep draw at most 4, and needs more room per
// wedge to stay legible at the same overall scale.
const SCORE_GLYPH_SIZE = 27;
const SCORE_SEPTAGON_SIZE = 31.5;

// Frequency-by-weekday dot sizing (px): an untouched day is a fixed small
// dot; a logged day starts at FREQ_DOT_BASE and grows by FREQ_DOT_STEP per
// entry, capped at 4 entries (_weekdayGridCard's own Math.min(count, 4)).
// Same reasoning as the Score sizes above — tuned live, likely to move again.
const FREQ_DOT_ZERO = 5;
const FREQ_DOT_BASE = 7.5;
const FREQ_DOT_STEP = 3;
function clampPeriods(unit, count) { return Math.min(count, TIMEFRAME_MAX[unit] ?? count); }

function pad(n) { return String(n).padStart(2, '0'); }

// goal.title is free user text and this component renders via innerHTML
// (goal-item can use textContent because it updates a node directly).
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function localDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
// Reuses goal-dialog's already-translated month keys rather than defining a
// parallel goal-analytics.month-* set — these render inside the goal dialog
// (analytics is one of its tabs), and duplicating 12 keys across 3 locales to
// say the same words would just be drift waiting to happen. Unlike
// export-markdown.js, which deliberately stays English, this is live UI and
// must follow the locale.
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function monthAbbr(monthIndex) { return t(`goal-dialog.month-${MONTH_KEYS[monthIndex]}`); }
// "Dec 31, 2026" — the one full-date spelling this view uses, shared by the
// countdown type card and the pace callout's own deadline mention so the two
// can't drift. Month name follows the locale (see MONTH_KEYS above).
function fullDate(iso) {
  const d = localDate(iso);
  return `${monthAbbr(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}
// Year dropped when it matches the year being viewed — a goal lives inside
// one year, so repeating it is noise in a narrow card. When it does differ,
// the short 'YY form keeps the value on one line (a wrapped "Jan 25, 2027"
// reads as two values); same abbreviation the charts' own axes use.
function shortDate(iso, todayIso) {
  const d = localDate(iso);
  const label = `${monthAbbr(d.getMonth())} ${d.getDate()}`;
  return iso.slice(0, 4) === todayIso.slice(0, 4) ? label : `${label} '${iso.slice(2, 4)}`;
}

function monthOnOrBefore(monthsAgo, todayIso) {
  const d = localDate(todayIso);
  return new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1);
}

function mondayOfWeek(weeksAgo, todayIso) {
  const d = localDate(todayIso);
  const day = (d.getDay() + 6) % 7;
  const thisMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - weeksAgo * 7);
}

function quarterOf(d) { return Math.floor(d.getMonth() / 3) + 1; }

// How many calendar months the inclusive [startIso, endIso] range touches.
function monthSpan(startIso, endIso) {
  const a = localDate(startIso), b = localDate(endIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

// monthSpan's week-grained counterpart: how many ISO (Mon-Sun) weeks the
// inclusive [startIso, endIso] range touches. Used only to decide how many
// bars a chart actually needs — see _barCount.
function weekStartIso(iso) {
  const d = localDate(iso);
  const dow = (d.getDay() + 6) % 7; // Monday-based, matching isoWeekKey
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow));
}
function weekSpan(startIso, endIso) {
  return Math.floor(daysBetween(weekStartIso(startIso), weekStartIso(endIso)) / 7) + 1;
}

function periodLabel(unit, indexFromEnd, todayIso) {
  if (unit === 'month') { const d = monthOnOrBefore(indexFromEnd, todayIso); return monthAbbr(d.getMonth()) + (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(2)}` : ''); }
  if (unit === 'week') { const d = mondayOfWeek(indexFromEnd, todayIso); return `${monthAbbr(d.getMonth())} ${d.getDate()}`; }
  // t() only for the visible label — resampleSumFromDates' own `${year}-Q${n}`
  // bucket keys below stay ASCII, since those are Map lookup keys that must
  // match countByBucket's format, not anything the user reads.
  if (unit === 'quarter') { const monthsBack = indexFromEnd * 3, d = monthOnOrBefore(monthsBack, todayIso); return `${t('goal-analytics.quarter-prefix')}${quarterOf(d)} '${String(d.getFullYear()).slice(2)}`; }
  const d = monthOnOrBefore(indexFromEnd * 12, todayIso); return String(d.getFullYear());
}

function resampleSumFromDates(dates, unit, count, todayIso) {
  const counts = countByBucket(dates, unit);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    let key;
    if (unit === 'month') key = monthKey(toIso(monthOnOrBefore(i, todayIso)));
    else if (unit === 'week') key = isoWeekKey(toIso(mondayOfWeek(i, todayIso)));
    else if (unit === 'quarter') { const d = monthOnOrBefore(i * 3, todayIso); key = `${d.getFullYear()}-Q${quarterOf(d)}`; }
    else key = String(monthOnOrBefore(i * 12, todayIso).getFullYear());
    out.push(counts.get(key) ?? 0);
  }
  return out;
}

// A failed period is marked the way the year view marks a failed goal: the
// whole cell goes solid --color-danger and the glyph inside re-themes onto
// --color-text-inverse, keeping its own filled/empty contrast rather than
// turning the mark itself red. That's deliberately the same treatment (and
// the same token pair) as goal-item's :host([data-failed]) row, so a week
// that reads failed on the row reads failed here too — the Score page is the
// per-week breakdown of exactly that state.
const FILL_ON = { normal: 'var(--color-accent)', failed: 'var(--color-text-inverse)' };
const FILL_OFF = {
  normal: 'var(--color-border)',
  failed: 'color-mix(in srgb, var(--color-text-inverse) 30%, transparent)',
};
function fillsFor(failed) {
  const k = failed ? 'failed' : 'normal';
  return { on: FILL_ON[k], off: FILL_OFF[k] };
}

// ── generic N-wedge pie (weekly's Score page: N = target) ────────────────
function wedgeGlyph(states, size, failed = false) {
  const n = states.length, r = size / 2, cx = r, cy = r;
  const { on, off } = fillsFor(failed);
  let paths = '';
  for (let i = 0; i < n; i++) {
    const a0 = (-90 + i * 360 / n) * Math.PI / 180;
    const a1 = (-90 + (i + 1) * 360 / n) * Math.PI / 180;
    const x1 = (cx + r * Math.cos(a0)).toFixed(1), y1 = (cy + r * Math.sin(a0)).toFixed(1);
    const x2 = (cx + r * Math.cos(a1)).toFixed(1), y2 = (cy + r * Math.sin(a1)).toFixed(1);
    const fill = states[i] === 'on' ? on : off;
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${fill}" />`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

// Same 7-wedge geometry the goal-item row's own septagon strip uses (via the
// exported pure helpers), simplified for this smaller secondary view: no
// clock-line/today-boundary marker, no "within" knockout dot — just the
// plain accent/border fill per wedge.
// The same four states the row's septagon draws, read through the shared
// on/off pair above so a failed week re-themes with everything else: a clean
// day is a solid wedge, a forgiven (within-allowance) slip the same wedge
// plus the row's own knockout dot at its centre, an over-allowance slip is
// drained to the cell's background (transparent — red inside a failed week,
// which by definition is the only kind of week an over day can occur in),
// and a future day is the neutral empty fill.
function septagonGlyph(weekStates, size, failed = false) {
  const { on, off } = fillsFor(failed);
  const marks = weekStates.map((day, i) => {
    const state = septagonWedgeState(day);
    const fill = state === 'clean' || state === 'within' ? on
      : state === 'over' ? 'transparent'
      : off;
    const wedge = `<path d="${septagonWedgePath(i)}" fill="${fill}" />`;
    if (state !== 'within') return wedge;
    const [cx, cy] = septagonWedgeCentroid(i);
    return `${wedge}<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${SEPTAGON_DOT_FILL}" />`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">${marks}</svg>`;
}

// Monthly's Score cell. A conic sweep around the box, not a bottom-up
// linear fill — deliberately the same mechanic (and the same soft-square
// 5px radius) as the goal-item row's own monthly dot, .freq-dot.partial, so
// a month reads identically in both places. Monthly can't use weekly's
// discrete wedges: target runs to 31, and 31 hairline wedges at 22px is
// noise, so the sweep is the continuous stand-in for the same idea.
function squareSweepGlyph(frac, size, failed = false) {
  const pct = Math.round(Math.min(Math.max(frac, 0), 1) * 100);
  const { on, off } = fillsFor(failed);
  return `<div style="width:${size}px;height:${size}px;border-radius:5px;background:conic-gradient(${on} 0 ${pct}%, ${off} ${pct}% 100%);flex-shrink:0;"></div>`;
}

// Avoid's forgiven-vs-over encoding, in the two charts that count slips as
// events (the timebox histogram and the weekday grid): **outline means total,
// fill means over-allowance**. A slip inside the allowance is drawn as a bare
// stroke; one that broke the allowance is drawn solid; a mark holding both is
// a stroke partly filled, in proportion.
//
// This replaces an earlier two-hue scheme (solid --color-danger against a pale
// color-mix of it) that had no way to work. The two reds had to be far enough
// apart to tell apart at the weekday grid's 8-14px dots, yet the paler one had
// to stay visible against the card — and those pull in opposite directions, so
// every mix ratio failed one of them: at 38% the pair was 2.13:1 against each
// other, at 26% it reached 2.53:1 but the pale fill dropped to 1.42:1 against
// the card. Neither end cleared the 3:1 needed for a graphical object.
//
// Fill-vs-stroke sidesteps the trade entirely, because it is not a colour
// distinction at all: both states are plain --color-danger (3.58:1 light,
// 3.33:1 dark against the card — passing), and what separates them is a
// channel that survives greyscale, low vision and colour blindness alike. It
// is also the only encoding here that still reads once a mark is both, since
// "partly filled" is a spectrum where "a third hue" would be a guess.
// The stroke weight itself is the --slip-stroke custom property on :host, set
// the same way as --chart-scrollbar-room so the two locally-defined chart
// dimensions in this file share one mechanism and both stay inspectable.

function naturalUnitIsMonth(goal) { return naturalUnitFor(goal) === 'month'; }

function unitWord(unit, n) { return n === 1 ? t(`goal-analytics.unit-${unit}`) : t(`goal-analytics.unit-${unit}-plural`); }

class GoalAnalytics extends AppElement {
  // Every analytics page leads with which goal it belongs to — the edit form
  // shows the title in its own input, but the analytics pages otherwise give
  // no clue which goal you swiped into.
  // The goal name leads and carries the weight — it is what the whole dialog
  // is about; the page name trails it as a quieter locator. The <h2> stays on
  // the page name regardless of visual order: it is the part that differs
  // between the four pages, so it is what makes the heading useful to a
  // screen reader moving between them.
  _pageHead(goal, titleKey) {
    return `<div class="page-head">
      <p class="page-goal" title="${esc(goal?.title)}">${esc(goal?.title)}</p>
      <h2 class="page-title">${t(titleKey)}</h2>
    </div>`;
  }

  template() {
    return `
      <style>
        :host {
          display: block; font-family: var(--font-family); color: var(--color-text-primary);
          /* Room a horizontal overlay scrollbar paints in — see .histogram-scroll. */
          --chart-scrollbar-room: var(--space-2);
          /* Stroke weight for Avoid's outline marks — see the forgiven-vs-over
             note above the class. A local value rather than a token because
             tokens.css defines no border width at all. */
          --slip-stroke: 1.5px;
          /* How many bar columns span one screenful on the Consistency and
             Count-per-timebox charts, at week/month timeframes (quarter stays
             on its own stretch-to-fill rule below — it already reads well).
             Not a round number on purpose: 12 lets a 12-bar month view show
             every bar at a glance with no scrolling, while the same per-bar
             width applied to a longer run (26 weeks) leaves a sliver of the
             13th bar visible at the edge — the ordinary "there's more, keep
             scrolling" affordance, rather than a hard-edged cutoff that reads
             as the end of the data. The per-bar width formula below
             subtracts the gaps a 12-bar row actually has (11 of them) before
             dividing by this span — without that, a real 12-bar chart
             overflowed by about a bar-and-a-half purely from gap width,
             scrolling exactly where "at a glance" promised it wouldn't. */
          --chart-bar-span: 12.25;
          /* Same idea as --chart-bar-span above, for the Activity calendar's
             day-cells: there's no "N fit with no scroll" target here the way
             a 12-bar month view has — the calendar always spans a full year
             (52+ columns), so it always scrolls regardless of cell size. This
             is really just "how big should one cell be," expressed as a
             fit-count because that's the only lever this formula has. 16
             landed on ~17.5px on the viewport this was tuned against — there
             is no fixed-px route to that number that stays correct across
             different screen widths, so the fit-count is the target instead,
             picked to land close to the requested size on a typical phone. */
          --calendar-col-span: 16;
        }
        .page { display: flex; flex-direction: column; gap: calc(var(--space-5) + 3px); }
        /* One line: goal name at the start, page name at the end. The page
           name never shrinks, so a long goal name ellipsises rather than
           squeezing the label that identifies which page you are on. */
        /* Pinned to the top of modal-dialog's own scrolling .body: which page
           you are on and which goal it belongs to are the two things that
           must never scroll out of reach, since the charts below repeat the
           same shapes from page to page. Padded and given the dialog's own
           surface so content passing underneath is covered. Block padding
           only — an earlier version also bled the cover outward with a
           negative inline margin, which made this element wider than the
           dialog body and gave every analytics page its own horizontal
           scrollbar. The cards below span exactly the content box anyway, so
           there is nothing out there to cover.

           No block padding and no negative start margin. Both used to be
           here, cancelling out to put the element at the body top while still
           pushing the text 8px down from it — the whole reason the title sat
           low under the sheet handle. Neither buys anything: sticky pins this
           element flush to the top of the scrollport, so there is never
           content above it left to cover (and anything above that line is
           outside the scrollport and clipped regardless), which also made the
           negative margin inert — a flow position above the clamp could never
           paint. The line box's own internal leading is the breathing room on
           both edges now. */
        .page-head { position: sticky; inset-block-start: 0; z-index: 2; display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); background: var(--color-surface); }
        .page-goal { margin: 0; min-inline-size: 0; flex: 1; font-size: var(--font-size-subheading); font-weight: var(--font-weight-bold); color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .page-title { margin: 0; flex-shrink: 0; font-size: var(--font-size-subheading); font-weight: var(--font-weight-regular); color: var(--color-text-secondary); }

        /* Entrance-only transition on page change (swipe, dot tap, or arrow key) —
           direction follows whether the new page index is higher or lower than the
           previous one. Deliberately not a full outgoing+incoming choreography
           (that would need the old page's DOM kept alive during the swap): a
           one-sided "the new content arrives from the right/left" reads as
           enough motion to not feel dry, without the complexity/fragility of
           coordinating two elements through a re-render that replaces innerHTML. */
        @keyframes ga-enter-fwd  { from { opacity: 0; transform: translateX(14px);  } to { opacity: 1; transform: translateX(0); } }
        @keyframes ga-enter-back { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        .page.enter-fwd  { animation: ga-enter-fwd 0.22s ease-out; }
        .page.enter-back { animation: ga-enter-back 0.22s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .page.enter-fwd, .page.enter-back { animation: none; }
        }
        .card { background: var(--color-surface-raised); border-radius: var(--radius-md); padding: var(--space-4); }
        .card-head { display: flex; justify-content: space-between; align-items: baseline; margin-block-end: var(--space-3); gap: var(--space-2); }
        .card-head h3 { margin: 0; font-size: var(--font-size-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
        /* 32px, not the project's 40px --touch-target: a deliberate, accepted
           middle ground (was 24px). A full 40px pill would visually outweigh
           the card heading it sits beside, and changing timeframe is a
           secondary refinement rather than a primary action. */
        .card-head select { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); font-size: var(--font-size-micro); font-weight: var(--font-weight-medium); border-radius: var(--radius-full); padding: 4px 10px; min-block-size: 32px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .footnote { font-size: var(--font-size-micro); color: var(--color-text-muted); line-height: 1.5; }
        /* Matches .calc-older-note exactly, same reasoning and same
           override: this used to be --color-text-primary specifically
           because it's the entire content of the page when a goal has no
           streaks yet, so it had to clear 4.5:1 (secondary fails that at
           this size) — overridden on request, consistency with the other
           empty-state note outweighing that margin here too. */
        .empty-note { font-size: var(--font-size-micro); color: var(--color-text-secondary); line-height: 1.5; text-align: center; padding: var(--space-6) var(--space-2); }

        /* Overview */
        /* Number centred with the spark stacked under it, rather than the two
           sitting side by side: the spark is a footnote to the number, not a
           second reading of equal weight. */
        /* No padding of its own on any edge — the page's own section gap is
           the only separation this needs, and stacking a second helping on top
           of it is what left the number floating well down the card. */
        .hero-number { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
        .hero-number .big { font-size: var(--font-size-hero); font-weight: var(--font-weight-bold); line-height: 1; color: var(--color-text-primary); }
        .hero-number .big .pct-unit { font-size: var(--font-size-heading); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
        .stat-row { display: flex; gap: var(--space-2); }
        /* Label at the start, value centred under it. The value is the thing
           being compared across the three cards, so centring lines all three
           up on one optical axis; the label reads as a caption on the card
           rather than a heading over the number, so it stays at the start. */
        .stat-row.comparison .stat-value { justify-content: center; }
        .stat-row.centered .stat { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-block-size: 78px; }
        .stat { flex: 1; background: var(--color-surface-raised); border-radius: var(--radius-md); padding: var(--space-3); min-width: 0; }
        .stat-label { font-size: var(--font-size-micro); color: var(--color-text-secondary); font-weight: var(--font-weight-medium); margin-block-end: var(--space-1); }
        .stat-value { font-size: var(--font-size-subheading); font-weight: var(--font-weight-bold); color: var(--color-text-primary); display: flex; align-items: baseline; gap: 3px; }
        /* The three card values that can hold real words rather than a short
           number — the goal's type, its logged count, its deadline. One size
           with every other value on the page; the class exists for the
           ellipsis, which the type label genuinely needs ("Hebdomadaire" in
           fr, "Fins la data" in ca, in a three-card row). Blocks rather than
           flex rows so text-overflow applies: none of the three carries a
           .unit child, which is the only thing the flex row was for.
           max-inline-size is load-bearing — .stat-row.centered .stat centres
           on the inline axis, so without a cap these shrink-to-fit and
           overflow the card instead of ellipsising inside it. */
        .stat-headline { font-size: var(--font-size-subheading); display: block; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* The one value allowed out of the shared size — "how many times have
           I done this" is the figure this card exists to answer, and at the
           shared size it read as a caption rather than a count. Safe to grow
           where the type label was not: it is at most three digits (a year
           holds 365 days), so it cannot run out of card the way a word like
           "Hebdomadaire" does. Two classes deep to out-specify .stat-headline
           above, whose size it is overriding. The countdown card's days-left
           figure deliberately stays at the shared size. */
        .stat-headline.stat-count { font-size: var(--font-size-title); }
        .stat-value .unit { font-size: var(--font-size-micro); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
        .stat.delta-up .stat-value { color: var(--color-success); }
        .stat.delta-down .stat-value { color: var(--color-danger); }
        .stat-value.overdue { color: var(--color-danger); }
        .stat-value.muted { color: var(--color-text-muted); font-weight: var(--font-weight-medium); }
        /* Every piece of supporting text inside a stat card is one size:
           --font-size-micro, the same token .stat-label and .stat-value .unit
           already used. Two sizes in these cards total — the value, and
           everything around it — so the value is the only thing that reads as
           the value. There used to be four (a bare 10px here, caption on the
           two second lines, micro on the labels), which made "3×/week", the
           M/T/W strip, "entries" and "overdue" all subtly disagree with each
           other for no reason any of them could justify. Weight and colour
           still separate them; size no longer does. */
        .stat-sub { font-size: var(--font-size-micro); color: var(--color-text-muted); margin-block-start: 2px; }
        /* The slips breakdown sits opposite the type stack in the same row, so
           it carries that stack's own second-line weight and colour — size is
           shared with everything else now, so only those two are left here. */
        .stat-sub.stat-sub-lg { font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-block-start: 3px; }
        .type-stack { display: flex; flex-direction: column; gap: 3px; max-inline-size: 100%; min-inline-size: 0; }
        .type-stack .type-primary { font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
        .type-stack .type-secondary { font-size: var(--font-size-micro); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
        /* Scheduled-days strip (weekly goals on specific days). Fixed slot
           width so the 7 letters keep their Mon-Sun positions whatever the
           locale's day initials are — position is what tells Tue from Thu.
           Colour-only distinction is deliberate and matches day-strip.js;
           the strip carries its own aria-label naming the scheduled days, so
           the letters themselves stay purely visual. */
        .sched-strip { display: inline-flex; gap: 2px; margin-block-start: 2px; }
        .sched-slot { min-inline-size: 12px; text-align: center; font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); color: var(--color-border); }
        .sched-slot.on { color: var(--color-accent); }
        .legend { display: flex; gap: var(--space-4); font-size: var(--font-size-micro); color: var(--color-text-secondary); margin-block-start: var(--space-2); }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        /* Avoid's allowed/over-allowance key, shared by the count histogram
           and the weekday grid — a filled block rather than the line swatch
           above, matching the solid marks those two charts actually draw. */
        /* The key mirrors the marks exactly: a bare stroke for a forgiven slip,
           the same box filled for one that broke the allowance. */
        .legend .swatch-dot { inline-size: 9px; block-size: 9px; border-radius: 2px; display: inline-block; box-sizing: border-box; background: transparent; border: var(--slip-stroke) solid var(--color-danger); }
        .legend .swatch-dot.danger { background: var(--color-danger); }
        /* Deliberately never --color-accent-light/-dark/-subtle anywhere in
           this file: Telos's own blue override (index.html) only sets bare
           :root, and tokens.css's own [data-theme="dark"] block redefines
           all three back to Socle's default *orange* — --color-accent
           itself is the only one of the four that stays blue in both
           themes. Every tint/shade here is color-mix()'d from --color-accent
           and the already theme-correct surface/text tokens instead. */
        .pace-callout { display: flex; align-items: flex-start; gap: var(--space-2); background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface-raised)); border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-caption); color: var(--color-text-primary); line-height: 1.5; }
        .pace-callout svg { inline-size: 16px; block-size: 16px; flex-shrink: 0; margin-block-start: 1px; color: var(--color-accent); }

        /* Per-period result (Overview bar chart). .perf-scroll is the real
           scroll surface — container-type lets its bar/axis columns size
           themselves as a fraction of ITS width (cqi) rather than their own
           overflowed content width, which is what makes "~12 columns per
           screen" mean anything. .perf-tracks/.perf-axis are its two rows,
           direct children rather than wrapped in a shared flex-column parent
           — deliberately mirroring the Activity histogram's own
           .histogram/.histogram-axis structure exactly (same max-content +
           margin-inline-start:auto right-alignment on each row independently).
           An earlier version here used a wrapping .perf div instead, which
           broke two things a direct structural match avoids: that wrapper's
           own box, sized separately from its cqi-driven children, measurably
           added a few stray px of overflow even for an exactly-fitting bar
           count (confirmed by direct measurement); and — the more serious
           one — a chart showing *fewer* than a full screenful of bars (a
           young goal, see firstRecordIso below) would stretch that wrapper to
           the full scroll width while its actual bars stayed left-aligned
           inside it, floating the newest bar in the middle of the card
           instead of hanging it against the right edge. Two independent
           max-content rows, exactly like the histogram, right-align correctly
           regardless of how many bars are actually present. */
        .perf-scroll { padding-block-end: var(--chart-scrollbar-room); container-type: inline-size; }
        .perf-tracks, .perf-axis { display: flex; gap: var(--space-1); inline-size: max-content; margin-inline-start: auto; }
        /* .fill is quarter-only now (see _perfChart's own comment) — always
           exactly 4 bars (TIMEFRAME_MAX.quarter), stretched to fill the card
           rather than sitting in a right-aligned 80px cluster. Week/month
           never get this class, however few bars a young goal has: they keep
           the fixed --chart-bar-span width so a 3-bar chart's bars are the
           same width as a 12-bar chart's, not fatter. */
        .perf-tracks.fill, .perf-axis.fill { inline-size: 100%; margin-inline-start: 0; }
        .perf-tracks.fill .perf-col, .perf-axis.fill .perf-ax { flex: 1 1 0; min-inline-size: 0; }
        /* Matches the Overview line chart's own plot height below, and the
           Activity histogram's — three bar/line charts at one height so
           switching between them doesn't involve a size jump. 14px of that is
           reserved headroom for a label sitting above a bar at its tallest
           (100%) — see .perf-val — the same reservation the histogram makes
           via its own separate .bar-val-slot row. */
        .perf-tracks { block-size: 96px; padding-block-start: 14px; position: relative; align-items: stretch; }
        .perf-axis { margin-block-start: var(--space-1); min-block-size: 11px; }
        /* The column width: a fraction of the scroll surface's own layout
           width (cqi, via .perf-scroll's container-type above), not a fixed
           pixel value — see --chart-bar-span on :host for why 12.15 and not a
           round number, and for why the gap count is subtracted before
           dividing. min-inline-size:0 keeps a labelled slot from growing past
           that fraction to fit its own text (a labelled axis slot once grew
           to its label's width instead, 26.5px for "Sep 21" against an 18px
           slot — same failure mode, just against a now-dynamic rather than
           fixed basis). Labels are still free to paint outside their slot
           (overflow: visible on .perf-ax) — they just no longer push it
           wider. */
        .perf-col { position: relative; flex: 0 0 calc((100cqi - (var(--chart-bar-span) - 1) * var(--space-1)) / var(--chart-bar-span)); min-inline-size: 0; display: flex; align-items: flex-end; }
        .perf-bar { inline-size: 100%; background: var(--color-accent); border-radius: 3px 3px 0 0; min-block-size: 3px; }
        /* Over-target reads as a distinct colour rather than just a taller bar —
           at the week timeframe the value is uncapped, so a 200% week would
           otherwise just look like "a tall bar" with no cue that it crossed the
           line. Paired with the dashed 100% rule below, which only appears when
           the scale actually exceeds 100 (otherwise 100% is the top edge). */
        .perf-bar.over { background: var(--color-success); }
        .perf-100 { position: absolute; inline-size: 100%; inset-inline-start: 0; border-block-start: 1px dashed var(--color-text-secondary); pointer-events: none; }
        /* Anchored to its own bar's current top, inline (the same
           inset-block-end percentage the bar's own block-size uses, plus a
           2px gap folded into the calc) — rather than sitting in one shared
           row at a fixed height above every bar regardless of how tall it is.
           The previous shared-row version put the highest and lowest labels
           at the exact same height — the two numbers furthest apart in value,
           rendered closest together on screen, reading as a collision rather
           than a range. Tracking each bar's own top instead spreads them
           exactly as far apart as their values actually are. No transform:
           inset-block-end alone already parks the label's bottom edge at that
           line (height is intrinsic, so the text extends upward from there on
           its own) — a translateY on top of that re-shifted it up by a second,
           unwanted full line-height, caught in a real render (the label
           floated a whole line above its bar, not snug against it). */
        .perf-val { position: absolute; inset-inline: 0; text-align: center; font-size: var(--font-size-micro); color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); white-space: nowrap; pointer-events: none; }
        /* The trailing label is the one label that must not paint outside its
           slot — see the Activity histogram's own .ax:last-child, the exact
           same fix for the exact same cause, ported here after it turned out
           to still apply: bleed past the inline-END edge of the LAST slot
           inflates #perf-scroll's own scrollWidth even though it never
           changes the slot's own rendered box (confirmed by direct
           measurement — every .perf-ax measured exactly its intended cqi
           width regardless). A week/month's "Sep 28"-style trailing label is
           wider than its ~24px slot, so without this the chart reported a
           few px of scroll range that led nowhere — no content actually
           lived past the visible edge, just an unreachable sliver of air.
           Every other label bleeding symmetrically is harmless (mid-row
           bleed lands over a neighbour, inline-start bleed isn't reachable by
           scrolling); only the last one's end-ward bleed extends the
           scrollable area itself. */
        .perf-axis:not(.fill) .perf-ax:last-child { display: flex; justify-content: flex-end; }
        .perf-ax { flex: 0 0 calc((100cqi - (var(--chart-bar-span) - 1) * var(--space-1)) / var(--chart-bar-span)); min-inline-size: 0; font-size: var(--font-size-micro); color: var(--color-text-muted); text-align: center; white-space: nowrap; overflow: visible; }

        .line-wrap { position: relative; }
        .line-start-val { position: absolute; font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); white-space: nowrap; pointer-events: none; }
        .line-axis { display: flex; justify-content: space-between; margin-block-start: var(--space-1); }
        .line-axis span { font-size: var(--font-size-micro); color: var(--color-text-muted); white-space: nowrap; }

        /* Score */
        .calc-header { display: flex; justify-content: space-between; align-items: center; margin-block-end: var(--space-3); font-size: var(--font-size-caption); color: var(--color-text-secondary); }
        .calc-header-pct { display: inline-flex; align-items: center; justify-content: center; inline-size: 44px; block-size: 44px; flex-shrink: 0; font-size: var(--font-size-body); font-weight: var(--font-weight-bold); color: var(--color-text-primary); background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-raised)); border-radius: var(--radius-md); }
        /* justify-content: flex-end so a goal with little enough real
           history to fit without scrolling still anchors to the right
           (where "now" lives) instead of sitting stuck to the left edge —
           independent of the scrollLeft fix in _wireInteractive, which only
           matters once there's enough content to actually need scrolling.
           overflow-x deliberately NOT set here — see .scrollable-x, applied
           conditionally by _wireInteractive once real overflow is confirmed, so
           a chart that doesn't overflow never becomes a scroll surface and can
           still be swiped across to change tabs. */
        .calc-scroll-outer { display: flex; justify-content: flex-end; padding: var(--space-2) 0; }
        /* flex:1 absorbs the space that would otherwise sit empty to the
           left of the counted group — .calc-grid keeps its own natural
           width, so it still ends up flush against the right edge exactly
           as it does with no note present, via the container's own
           justify-content:flex-end. */
        /* Matches .calc-header's own colour by deliberate choice, not an
           oversight — it used to be --color-text-primary specifically
           because it's the only text explaining the blank area (the same
           reasoning .empty-note used to carry too, before the identical
           override was applied there as well), which --color-text-secondary
           doesn't clear at this size. Overridden on request: matching the
           header text it sits beside outweighs that margin here. */
        .calc-older-note { flex: 1; align-self: center; margin: 0; text-align: center; font-size: var(--font-size-micro); color: var(--color-text-secondary); line-height: 1.4; }
        /* No touch-action here. modal-dialog's .body.has-tabs declares
           "pan-y pinch-zoom" while tabs are active, and touch-action intersects
           down the whole ancestor chain — a descendant can never loosen what an
           ancestor restricted, so "pan-x" could not grant horizontal panning
           back. All it did was subtract: pan-x ∩ pan-y pinch-zoom is nothing at
           all, i.e. the "none" that leaves the browser flinging invisibly and
           eating the next tap. Native horizontal panning of these charts inside
           a tabbed dialog is a platform constraint, not something to solve here
           (Socle 1.3.0, docs/gestures.md "Axis ownership"); keyboard scrolling
           and the scroll-to-now pass in _wireInteractive still work. */
        .scrollable-x { overflow-x: auto; overflow-y: hidden; }
        .calc-grid { display: flex; align-items: stretch; gap: 0; inline-size: max-content; }
        .calc-group { display: flex; flex-direction: column; gap: 7px; padding: 6px 7px; flex-shrink: 0; }
        .calc-group.counted { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-raised)); border-radius: var(--radius-md); margin-inline-start: var(--space-2); padding-inline-start: var(--space-3); padding-inline-end: 8px; }
        .calc-group-label { font-size: var(--font-size-micro); color: var(--color-text-muted); text-align: center; margin-block-end: 2px; }
        /* The cell's own text colour is what the septagon's knockout dot
           punches through to
           (SEPTAGON_DOT_FILL is currentColor), so every cell carries its own
           background as its text colour — plain card here, the tinted counted
           group below, solid danger on a failed week. */
        .calc-cell { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); color: var(--color-surface-raised); }
        .calc-group.counted .calc-cell { color: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-raised)); }
        .calc-shape-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .calc-cell.current .calc-shape-wrap { background: color-mix(in srgb, var(--color-text-primary) 12%, transparent); border-radius: var(--radius-sm); padding: 3px; margin: -3px; }
        /* A failed period gets the year view's own failed-row treatment — the
           whole cell solid --color-danger, the glyph re-themed onto
           --color-text-inverse (see fillsFor) rather than the mark itself
           turning red. Same geometry as the .current chip above so the two
           line up in the column. */
        /* Both selectors, deliberately: .calc-group.counted .calc-cell above
           is more specific than a bare .calc-cell.failed, so the counted
           group would otherwise keep painting its own tint as the knockout
           colour inside a failed cell — a pale dot on a white wedge, i.e.
           invisible. */
        .calc-cell.failed,
        .calc-group.counted .calc-cell.failed { color: var(--color-danger); }
        .calc-cell.failed .calc-shape-wrap { background: var(--color-danger); border-radius: var(--radius-sm); padding: 3px; margin: -3px; }
        /* Reserved space for a period the goal did not exist for yet:
           invisible, but still occupying its slot so the counted group keeps
           the full height of everything it will eventually count. */
        .calc-cell.placeholder { visibility: hidden; }
        .calc-badge { position: absolute; top: -4px; right: -6px; background: var(--color-accent); color: var(--color-text-on-accent); font-size: var(--font-size-micro); font-weight: var(--font-weight-bold); padding: 1px 3px; border-radius: var(--radius-full); line-height: 1.3; }
        .calc-label-slot { block-size: 9px; font-size: 7px; font-weight: var(--font-weight-semibold); color: var(--color-accent); white-space: nowrap; }

        /* Activity */
        /* margin-inline-start:auto on the children (below), not flex+align-items
           on this container — flexbox cross-axis alignment other than stretch
           (i.e. align-items:flex-end on a column-direction flex container) has
           a real quirk where an overflowing child's true width stops
           registering in the container's own scrollWidth, silently breaking
           horizontal scroll entirely. Confirmed by direct measurement: with
           that approach, .histogram itself still rendered at its full 568px
           intrinsic width while #hist-scroll reported scrollWidth === clientWidth.
           auto margins on a block child have no such issue — they collapse to 0
           (no visual effect) once the child is wider than its container, so
           the existing scrollLeft-to-end logic in _wireInteractive still
           anchors the "now" edge exactly as before. */
        /* --chart-scrollbar-room: the strip a horizontal overlay scrollbar
           paints in. It sits at the scroll container's block-end padding edge,
           so without padding here it lands ON the chart — on the calendar's
           Sunday row and the frequency grid's last weekday, i.e. over real
           data rather than beside it.
           Unconditional, deliberately not tied to .scrollable-x: that class is
           applied in a rAF after render (see _wireInteractive), so conditional
           padding would resize the card a frame late, every time the timeframe
           changed. A few dead px on a chart that doesn't scroll is the cheaper
           trade. The Score grid is exempt — .calc-scroll-outer already carries
           --space-2 of block padding for its own reasons. */
        /* container-type: see .perf-scroll's own comment — same purpose, so
           .bar-col/.ax below can size against this element's real width
           rather than their own overflowed content width. */
        .histogram-scroll { padding-block-end: var(--chart-scrollbar-room); container-type: inline-size; }
        .histogram { display: flex; align-items: stretch; gap: var(--space-1); block-size: 96px; inline-size: max-content; margin-inline-start: auto; }
        /* Same stretch-to-fill rule as .perf above, for the same reason — see
           its comment. The axis row is a sibling, so it carries the class too
           and its slots stay aligned with the bars. */
        .histogram.fill, .histogram-axis.fill { inline-size: 100%; margin-inline-start: 0; }
        .histogram.fill .bar-col, .histogram-axis.fill .ax { flex: 1 1 0; min-inline-size: 0; }
        /* Width: see .perf-col's own comment — same --chart-bar-span fraction
           of the scroll surface's layout width, shared across both this chart
           and Consistency so the two read at one bar width. */
        .bar-col { flex: 0 0 calc((100cqi - (var(--chart-bar-span) - 1) * var(--space-1)) / var(--chart-bar-span)); min-inline-size: 0; display: flex; flex-direction: column; align-items: center; }
        .bar-val-slot { block-size: 14px; display: flex; align-items: flex-end; justify-content: center; }
        .bar-val { font-size: var(--font-size-micro); color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); white-space: nowrap; }
        .bar-track { flex: 1; inline-size: 100%; display: flex; align-items: flex-end; min-height: 0; }
        .bar { inline-size: 100%; background: var(--color-accent); border-radius: 3px 3px 0 0; min-height: 3px; }
        /* Avoid's split bar: one rounded, clipped column holding the
           over-allowance segment above the forgiven one, so the pair reads as
           a single bar with a red cap rather than two bars stacked. */
        /* The whole stack is stroked — that outline is every slip in the period.
           Only the over-allowance segment is filled, and it sits at the top, so
           a bar reads "this many slips, this much of it past the line". */
        .bar-stack { inline-size: 100%; display: flex; flex-direction: column; border-radius: 3px 3px 0 0; overflow: hidden; min-height: 3px; box-sizing: border-box; background: transparent; border: var(--slip-stroke) solid var(--color-danger); }
        .bar-seg.within { background: transparent; }
        .bar-seg.over { background: var(--color-danger); }
        .histogram-axis { display: flex; gap: var(--space-1); inline-size: max-content; margin-block-start: var(--space-1); margin-inline-start: auto; min-height: 11px; }
        /* The trailing label is the one label that must not paint outside its
           slot. Every other one bleeding symmetrically is fine — bleed past the
           inline-start edge isn't reachable by scrolling, and mid-row bleed
           lands over a neighbouring slot. But bleed past the inline-END edge
           extends the scroll container's scrollWidth, so scrolling fully right
           stopped 6px short of the newest bar. End-aligning just that slot
           removes the overhang without touching the row's width. It has to be
           flex justification rather than text-align: when a line box is
           narrower than its own content, the alignment offset clamps to zero
           and text-align does nothing at all (measured: the label still hung
           6.2px past its slot). Flexbox's default "unsafe" justification has
           no such clamp — flex-end genuinely pushes the overflow to the start
           side. Only while
           the slots are the narrow fixed 18px: .fill's slots are wide enough
           to hold a label outright, and end-aligning one there would visibly
           shove it off the bar it names. */
        .histogram-axis:not(.fill) .ax:last-child { display: flex; justify-content: flex-end; }
        .ax { flex: 0 0 calc((100cqi - (var(--chart-bar-span) - 1) * var(--space-1)) / var(--chart-bar-span)); min-inline-size: 0; font-size: var(--font-size-micro); color: var(--color-text-muted); text-align: center; white-space: nowrap; overflow: visible; }
        .heatmap-outer { display: flex; gap: var(--space-2); align-items: flex-start; }
        /* container-type: lets .heatmap/.heatmap-monthrow size their own
           columns as a fraction of THIS element's real width (cqi) — same
           mechanism as .histogram-scroll/.perf-scroll, see their own
           comments for the general idea. */
        .heatmap-scroll { flex: 1; min-width: 0; padding-block-end: var(--chart-scrollbar-room); container-type: inline-size; }
        /* margin-inline-start:auto pins the newest column to the right edge.
           Without it a span narrow enough to fit (early in the year, or a
           short frequency grid) sat left-aligned with the gap on the right,
           i.e. "now" floating in the middle of the card while empty space
           trailed it. Same idiom, and the same reasoning, as .histogram's own
           auto margin — it collapses to 0 once the content is wider than the
           container, so the scroll-to-right-edge pass in _wireInteractive
           keeps working unchanged for the overflowing case. */
        .heatmap-inner { inline-size: max-content; margin-inline-start: auto; }
        /* Column width: a fraction of .heatmap-scroll's own layout width
           (cqi), sized so --calendar-col-span columns span it exactly — see
           that token on :host. Gap (3px, literal below — this block never
           used a token for it) is subtracted before dividing, same reason
           --chart-bar-span's own formula does: without it a 15-column fit
           overflows by almost a column purely from gap width. Shared with
           .heatmap below so month labels stay aligned with their columns. */
        .heatmap-monthrow { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100cqi - (var(--calendar-col-span) - 1) * 3px) / var(--calendar-col-span)); gap: 3px; block-size: 12px; margin-block-end: 3px; }
        .heatmap-monthrow span { font-size: var(--font-size-micro); color: var(--color-text-muted); white-space: nowrap; }
        /* Row height uses the exact same formula as the column width above,
           rather than a separate fixed value — cells stay square at whatever
           size that formula resolves to, on any viewport. */
        .heatmap { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100cqi - (var(--calendar-col-span) - 1) * 3px) / var(--calendar-col-span)); grid-template-rows: repeat(7, calc((100cqi - (var(--calendar-col-span) - 1) * 3px) / var(--calendar-col-span))); gap: 3px; }
        /* No explicit inline-size/block-size — a grid item's default
           align-items/justify-items is stretch, so the cell already fills
           its track (the calc above) exactly; repeating that same formula a
           third time here would just be another place for the two to drift
           apart. */
        .heatmap .cell { border-radius: 5px; background: var(--color-border); }
        .heatmap .cell.on { background: var(--color-accent); }
        /* Avoid only: a day shaded because the slip on it was forgiven, not
           because it was clean. Without this the calendar showed allowed
           slips as ordinary on-track days and only over-allowance ones
           registered at all (as gaps). The mark is the septagon's own
           knockout dot, punched through to the card behind it. */
        .heatmap .cell.on.within { display: flex; align-items: center; justify-content: center; }
        .heatmap .cell.on.within::after { content: ''; inline-size: 5px; block-size: 5px; border-radius: 50%; background: var(--color-surface-raised); }
        .heatmap-daylabels { flex-shrink: 0; display: flex; flex-direction: column; }
        .heatmap-daylabels .spacer { block-size: 12px; margin-block-end: 3px; }
        /* .daylabel-grid sits outside .heatmap-scroll entirely (a structural
           sibling, not a descendant — see .heatmap-outer's own markup), so it
           cannot read the cqi-based row height above via CSS at all:
           container query units only resolve for elements actually inside
           the query container's own subtree. --cal-row-h is the measured
           value instead, written by _syncCalendarRowHeight once the real
           cell size has settled post-layout — same cross-branch problem
           _syncScorePillWidth solves for the Score header's pill, same fix.
           The 11px fallback is what renders for the one frame before that
           measurement lands. */
        .daylabel-grid { display: grid; grid-template-rows: repeat(7, var(--cal-row-h, 11px)); gap: 3px; }
        .daylabel-grid span { font-size: var(--font-size-micro); color: var(--color-text-muted); line-height: var(--cal-row-h, 11px); }
        .freqgrid-wrap { display: flex; }
        /* flex:1 + min-width:0, matching .heatmap-scroll above — without it,
           this flex item (child of .freqgrid-wrap) defaults to min-width:auto
           and never shrinks to fit, so it grows past the card and bleeds
           into the page instead of scrolling internally. That also silently
           broke the scrollWidth>clientWidth overflow check in
           _wireInteractive: without the constraint, both values reflect the
           same already-overflowed size, so real overflow never registered. */
        .freqgrid-scroll { flex: 1; min-width: 0; padding-block-end: var(--chart-scrollbar-room); }
        .freqgrid { display: grid; grid-auto-flow: column; gap: 13px; inline-size: max-content; margin-inline-start: auto; }
        /* Row height 16->20px and gap 4->5px (a literal, not --space-2's
           8px — that jump read as too loose): both just wide enough for the
           dot size below's new max (~19.5px) to sit inside its own row
           without touching its neighbours, which a plain dot-size increase
           on its own stopped being true for. */
        .month-col { display: grid; grid-template-rows: 12px repeat(7, 20px); gap: 5px; text-align: center; }
        .month-label { font-size: var(--font-size-micro); color: var(--color-text-muted); }
        .dot-cell { display: flex; align-items: center; justify-content: center; }
        .freq-dot-el { border-radius: 50%; background: var(--color-accent); }
        /* Avoid only: same stroke-is-total/fill-is-over rule as the bars above.
           box-sizing keeps the ring inside the size the count already chose, so
           adding the stroke doesn't quietly inflate every dot by 3px. */
        .freq-dot-el.slip { box-sizing: border-box; border: var(--slip-stroke) solid var(--color-danger); background: transparent; }
        .freq-dot-el.zero { inline-size: 5px; block-size: 5px; background: var(--color-border); border: none; }
        .weekday-rail { display: grid; grid-template-rows: 12px repeat(7, 20px); gap: 5px; margin-inline-end: 6px; }
        .weekday-rail span { font-size: var(--font-size-micro); color: var(--color-text-muted); display: flex; align-items: center; }

        /* Streaks */
        .streak-list { display: flex; flex-direction: column; gap: 9px; }
        .streak-row { display: grid; grid-template-columns: 46px 1fr 32px; align-items: center; gap: var(--space-2); }
        .streak-date { font-size: var(--font-size-micro); color: var(--color-text-muted); white-space: nowrap; }
        .streak-track { block-size: 9px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; }
        .streak-fill { block-size: 100%; background: var(--color-accent); border-radius: var(--radius-full); }
        .streak-len { font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); text-align: end; }
      </style>
      <div class="page"></div>
    `;
  }

  subscribe() {
    this._root = this.shadowRoot.querySelector('.page');
    this._goal = null;
    this._year = null;
    this._activePage = 0;
    // null means "the user hasn't picked one" — every chart then opens on the
    // goal's own natural period (see _timeframe). Kept as null rather than
    // seeded with 'week' so an explicit pick of 'week' on a monthly goal is
    // still distinguishable from never having touched the select.
    //
    // Nothing here is persisted. The choice lives on this element instance, so
    // it survives swiping between analytics pages and switching goals while
    // the dialog stays mounted, and resets when a fresh element is mounted.
    this._tfProgress = null;
    this._tfActivity = null;
    this._tfPerf = null;
  }

  // Reference-guarded, like the year setter below. goal-dialog re-sets this on
  // every tab change (alongside activePage), which cost a second full render of
  // a page that was about to be rebuilt anyway — measured at 2 renders per tab
  // change, now 1. Identity is a safe test here because nothing mutates a goal
  // in place: every update in goal-dialog replaces the object (an object
  // literal, a spread, or one of tracking.js's pure helpers), so a genuinely
  // changed goal always arrives as a new reference.
  set goal(g) {
    if (g === this._goal) return;
    this._goal = g;
    this._render();
  }
  get goal() { return this._goal; }

  // Which year's analytics these are. Goals are annual, so this is what the
  // calendar/frequency spans anchor to (see _span) — set by goal-dialog from
  // the year the goal is filed under. Absent, it falls back to the current
  // year, which is what an isolated UI-tier mount (tests, storybook-style
  // use) gets.
  set year(y) {
    const next = y == null ? null : String(y);
    if (next === this._year) return; // goal-dialog re-sets it on every tab change
    this._year = next;
    this._render();
  }
  get year() { return this._year; }

  // The inclusive calendar range the Activity page's two full-history charts
  // cover: 1 January of the year being viewed through today, or through 31
  // December once that year is over — a past year shows exactly that year
  // rather than a rolling window running on into the present. Clamped so a
  // year that hasn't started yet can't produce a backwards range.
  _span(todayIso) {
    const year = this._year ?? todayIso.slice(0, 4);
    const start = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const end = todayIso < yearEnd ? todayIso : yearEnd;
    return { start, end: end < start ? start : end };
  }

  // How far back the underlying date arrays are gathered. At least a year (so
  // nothing that used to be counted stops being counted), and further when the
  // span itself reaches further — a past year's Jan 1 is more than 365 days
  // behind today, and its charts would otherwise render empty.
  _daysBack(todayIso) {
    return Math.max(HISTORY_DAYS_BACK, daysBetween(this._span(todayIso).start, todayIso));
  }

  // How many of a week/month chart's own fixed-cap bars should actually be
  // plotted: never more than `maxCount` (BARS_CONSISTENCY/BARS_HISTOGRAM's own
  // ceiling), and never reaching further back than whichever is LATER of the
  // goal's first-ever recorded entry or 1 January of the year being viewed —
  // a Telos goal lives inside one year, and a period before its own first
  // entry has nothing to show but empty padding ahead of the real data.
  // Quarter is deliberately excluded from callers of this (it's already
  // year-bound via TIMEFRAME_MAX.quarter=4, and always short enough to use
  // the stretch-to-fill layout regardless). Falls back to the year boundary
  // alone for a goal with no entries yet — there's nothing to bound against
  // — and never returns fewer than 1 (an empty chart still needs one period's
  // width to lay out against, and an all-empty count would hit MAX_BARS_TO_
  // STRETCH's fill path anyway, the same as any other sparse case).
  _barCount(goal, unit, maxCount, todayIso) {
    const yearStart = this._span(todayIso).start;
    const first = firstRecordIso(goal);
    const earliest = first && first > yearStart ? first : yearStart;
    const elapsed = unit === 'month' ? monthSpan(earliest, todayIso) : weekSpan(earliest, todayIso);
    return Math.max(1, Math.min(maxCount, elapsed));
  }

  // The sparkline's x-axis: up to SPARK_MONTHS calendar months of the year
  // being viewed, oldest first. Each month is read on the last day it
  // actually reaches — its own final day, or the span's end for the month
  // still in progress — so one segment means one calendar month and the
  // readings run strictly oldest to newest.
  _sparkSamples(todayIso) {
    const { start, end } = this._span(todayIso);
    const endDate = localDate(end);
    const months = Math.min(SPARK_MONTHS, monthSpan(start, end));
    const out = [];
    for (let back = months - 1; back >= 0; back--) {
      const m = new Date(endDate.getFullYear(), endDate.getMonth() - back, 1);
      const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0); // day 0 of next month
      out.push(toIso(monthEnd < endDate ? monthEnd : endDate));
    }
    return out;
  }

  // A chart's timeframe: whatever the user last picked on it, else the goal's
  // own natural period — 'week', or 'month' for a monthly goal, whose weeks
  // hold no meaningful fraction of a monthly target. One resolver for all
  // three selects so they can't drift apart on what "default" means.
  _timeframe(current, goal) { return current ?? naturalUnitFor(goal); }

  set activePage(i) { this._activePage = i; this._render(); }
  get activePage() { return this._activePage; }

  get pageCount() { return this._goal ? pagesFor(this._goal).length : 0; }

  _render() {
    if (!this._goal) { this._root.innerHTML = ''; return; }
    const pages = pagesFor(this._goal);
    const kind = pages[Math.min(this._activePage, pages.length - 1)] ?? pages[0];
    const renderers = { overview: this._renderOverview, score: this._renderScore, activity: this._renderActivity, streaks: this._renderStreaks };
    const prevPage = this._renderedPage;
    this._root.innerHTML = renderers[kind].call(this, this._goal);
    this._wireInteractive(kind);
    if (prevPage !== undefined && prevPage !== this._activePage) {
      const pageEl = this._root.querySelector('.page');
      pageEl?.classList.add(this._activePage > prevPage ? 'enter-fwd' : 'enter-back');
    }
    this._renderedPage = this._activePage;
  }

  // Timeframe changes update only the card that owns the select, never the
  // whole page. Two reasons, and the second is the one that actually bit:
  //
  //  - The page rule is targeted DOM updates after first mount; rebuilding the
  //    hero number, every stat card and every other chart because one select
  //    moved is the opposite of that.
  //  - _render() replaces .page's innerHTML wholesale, which destroys the
  //    <select> the user is mid-interaction with. It is recreated with the same
  //    id, so it looks fine — but it is a different node, so focus lands on
  //    <body>. Measured: a keyboard user changing the timeframe was thrown to
  //    the top of the document every time. Swapping only .card-body leaves
  //    .card-head, and therefore the select, untouched — so focus simply stays
  //    where it was and the listener bound here stays bound.
  _wireInteractive(kind) {
    if (kind === 'overview') this._wireOverviewSelects();
    if (kind === 'activity') this._wireActivitySelect();
    this._schedulePostRenderSync();
  }

  _wireOverviewSelects() {
    const today = () => todayISO();
    const sel = this.shadowRoot.querySelector('#tf-progress');
    sel?.addEventListener('change', () => {
      this._tfProgress = sel.value;
      this._swapCardBody('progress-body', this._progressBody(this._goal, today()));
    });
    const perf = this.shadowRoot.querySelector('#tf-perf');
    perf?.addEventListener('change', () => {
      this._tfPerf = perf.value;
      this._swapCardBody('perf-body', this._consistencyBody(this._goal, today()));
      this._syncScrollable('perf-scroll');
    });
  }

  _wireActivitySelect() {
    const sel = this.shadowRoot.querySelector('#tf-activity');
    sel?.addEventListener('change', () => {
      this._tfActivity = sel.value;
      const todayIso = todayISO();
      // Recomputed for this card alone. _renderActivity derives these once
      // for all three of its cards; here only the histogram is changing.
      const daysBack = this._daysBack(todayIso);
      const loggedDates = rawLoggedDates(this._goal, todayIso, daysBack);
      const slipSplit = isDecreasing(this._goal) ? slipDatesByState(this._goal, todayIso, daysBack) : null;
      const slipLegend = slipSplit ? this._slipLegend() : '';
      this._swapCardBody('hist-body', this._histogramBody(this._goal, loggedDates, slipSplit, slipLegend, todayIso));
      this._syncScrollable('hist-scroll');
    });
  }

  // Deferred a frame: scrollWidth read immediately after an innerHTML
  // replacement can still reflect pre-layout dimensions, silently scrolling
  // to the wrong (often 0/left) position — the same class of timing bug
  // fixed once already for the due-date/notes reveal flash in
  // goal-dialog.js, per its own _flashField timing note. The pill-width
  // sync below needs the same deferral for the same reason — the counted
  // group's real width (glyphs + its own range label) isn't settled until
  // after this render's own layout pass.
  _schedulePostRenderSync() {
    requestAnimationFrame(() => {
      ['perf-scroll', 'hist-scroll', 'cal-scroll', 'freq-scroll', 'calc-scroll'].forEach(id => this._syncScrollable(id));
      this._syncScorePillWidth();
      this._syncCalendarRowHeight();
    });
  }

  // The header's percentage pill has no width of its own to answer to — the
  // thing it needs to line up with, the counted (rightmost, highlighted)
  // group below it, is sized by its own content (glyphs plus however wide
  // its own month-range label turns out to be), which varies per goal. A
  // no-op on every page but Score, where either element doesn't exist.
  _syncScorePillWidth() {
    const pill = this.shadowRoot.querySelector('.calc-header-pct');
    const counted = this.shadowRoot.querySelector('.calc-group.counted');
    if (!pill || !counted) return;
    pill.style.inlineSize = `${counted.getBoundingClientRect().width}px`;
  }

  // The day-of-week labels (.daylabel-grid) sit outside .heatmap-scroll
  // entirely — a structural sibling, not a descendant — so they can't read
  // the calendar's cqi-based cell size via CSS at all (container query units
  // only resolve inside the query container's own subtree). Measures the
  // real rendered cell size instead and writes it as a custom property the
  // labels' own CSS falls back to — see .daylabel-grid's own comment. A
  // no-op on every page but Activity, where neither element exists.
  _syncCalendarRowHeight() {
    const cell = this.shadowRoot.querySelector('.heatmap .cell');
    const labels = this.shadowRoot.querySelector('.daylabel-grid');
    if (!cell || !labels) return;
    labels.style.setProperty('--cal-row-h', `${cell.getBoundingClientRect().height}px`);
  }

  // Replace one card's body in place. Falls back to a full render when the body
  // comes back empty — that means the card should no longer exist at all (see
  // _consistencyBody), and only _render can drop it without leaving a stranded
  // header behind. Rare enough that losing focus on that path is acceptable.
  _swapCardBody(id, html) {
    const el = this.shadowRoot.querySelector('#' + id);
    if (!el || !html) { this._render(); return; }
    el.innerHTML = html;
  }

  // Opting one scroll container into being a native scroll surface, but only
  // once it genuinely overflows. scrollWidth/clientWidth are measurable
  // regardless of the overflow-x value in effect, so this reads real overflow
  // first and only then applies .scrollable-x — never the reverse order (see
  // that class's own note on why it cannot be unconditional). Also where the
  // chart is anchored to its "now" edge.
  _syncScrollable(id) {
    const el = this.shadowRoot.querySelector('#' + id);
    if (!el) return;
    const overflows = el.scrollWidth > el.clientWidth;
    el.classList.toggle('scrollable-x', overflows);
    // tabindex only while it genuinely overflows: Chrome (unlike Firefox)
    // doesn't make scroll containers focusable on their own, so without this a
    // keyboard user can't reach the off-screen part at all. Gating it on real
    // overflow keeps the tab order free of dead stops on a chart with nothing
    // to scroll — and since these charts always open scrolled to "now", the
    // most relevant data is already in view without any scrolling.
    if (overflows) el.setAttribute('tabindex', '0');
    else el.removeAttribute('tabindex');
    if (overflows) this._attachDragScroll(el);
    el.scrollLeft = el.scrollWidth;
  }

  // Pointer-driven horizontal scrolling for a chart, because native panning is
  // not available to it. modal-dialog's .body declares `pan-y pinch-zoom` while
  // tabs are active, touch-action intersects down the whole ancestor chain, and
  // a descendant can never loosen what an ancestor restricted — so no value on
  // this element can hand horizontal panning back. That is a platform
  // constraint, and the remedy Socle prescribes for it is to replicate the
  // scroll by hand (docs/gestures.md, "Axis ownership"), exactly as
  // modal-dialog replicates its own vertical scroll for the same reason.
  //
  // The dialog's tab swipe does not fight this: _bodyDown bails out of tracking
  // whenever the press lands inside a genuinely overflowing horizontal scroller,
  // which since Socle 1.3.1 it can actually see across a shadow boundary.
  _attachDragScroll(el) {
    if (el.__dragScroll) return;
    el.__dragScroll = true;
    let drag = null, flingId = null;
    const scrollable = () => el.scrollWidth > el.clientWidth;
    const stopFling = () => { if (flingId !== null) cancelAnimationFrame(flingId); flingId = null; };

    // Momentum has to be written by hand too. Replicating the scroll 1:1 gave a
    // drag that stopped dead the instant the finger lifted — correct, and
    // immediately wrong-feeling next to every other scroll surface on the
    // platform. Velocity comes from the last two moves rather than the whole
    // gesture, so a drag that slows to a stop before release coasts nowhere,
    // which is what a reader expects when they are lining a chart up.
    //
    // This fling is ours, not the browser's, so a tap landing on it costs
    // nothing — it just stops here. That is the whole difference from the
    // compositor fling this module spent a session chasing.
    const fling = v => {
      if (Math.abs(v) < FLING_MIN_VELOCITY || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let last = performance.now();
      const step = now => {
        const dt = Math.min(now - last, 32); // a dropped frame must not teleport it
        last = now;
        const max = el.scrollWidth - el.clientWidth;
        const next = Math.max(0, Math.min(max, el.scrollLeft - v * dt));
        if (next === el.scrollLeft) { flingId = null; return; } // hit an edge
        el.scrollLeft = next;
        v *= Math.pow(FLING_DECAY, dt / 16.67);
        flingId = Math.abs(v) < FLING_MIN_VELOCITY ? null : requestAnimationFrame(step);
      };
      flingId = requestAnimationFrame(step);
    };

    // Registered once, permanently, and never per-gesture inside pointerdown:
    // Chrome only leaves touchmove cancelable when a blocking listener already
    // existed as the sequence began (see core/scroll-claim.js).
    attachScrollClaim(el, () => drag?.claim === 'x' && scrollable());

    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !scrollable()) return;
      // No stopPropagation needed: modal-dialog yields to a nested horizontal
      // scroller on its own, and since Socle 1.3.1 that check walks
      // composedPath() so it reaches this element inside goal-analytics' shadow
      // root. The intended split still holds either way — a chart wider than
      // the card scrolls, one that fits stays a tab-swipe surface — because
      // both sides gate on the same "does it actually overflow" test.
      stopFling(); // a press on a coasting chart stops it, as it would natively
      drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, id: e.pointerId,
               claim: undefined, lastX: e.clientX, lastT: performance.now(), v: 0 };
    });
    el.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.claim === undefined) {
        // Same 6px decision as the library's, for the same reason: at flick
        // speed the first touchmove is already a large jump, so deciding later
        // arrives after the browser has committed.
        drag.claim = dominantAxis(dx, dy);
        // Vertical belongs to the dialog body — stop tracking entirely so the
        // claim predicate goes false and native scrolling takes over.
        if (drag.claim === 'y') { drag = null; return; }
        if (drag.claim === 'x') el.setPointerCapture(drag.id);
      }
      if (drag.claim !== 'x') return;
      el.scrollLeft = drag.left - dx;
      // Only the most recent movement feeds the release velocity.
      const t = performance.now(), gap = t - drag.lastT;
      if (gap > 0) { drag.v = (e.clientX - drag.lastX) / gap; drag.lastX = e.clientX; drag.lastT = t; }
    });
    const end = () => {
      if (drag?.claim === 'x' && performance.now() - drag.lastT < 60) fling(drag.v);
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  _timeframeSelect(id, current, exclude = []) {
    // No year option: a Telos goal lives inside a single year, so a yearly
    // bucket can only ever hold one meaningful point (and TIMEFRAME_MAX caps
    // every chart at one year's worth of periods regardless). Quarter is the
    // coarsest grouping that still says anything. 'year' stays valid in the
    // utils below — the "vs year" comparison stat still uses it.
    const opts = ['week', 'month', 'quarter'].filter(v => !exclude.includes(v)).map(v =>
      `<option value="${v}" ${v === current ? 'selected' : ''}>${t('goal-analytics.timeframe-' + v)}</option>`).join('');
    return `<select id="${id}" aria-label="${t('goal-analytics.timeframe-label')}">${opts}</select>`;
  }

  // Bars are the per-period result: uncapped at the goal's own natural period
  // (an over-target week genuinely reads above 100%), capped-then-averaged at
  // any coarser timeframe. The scale stretches past 100 only when some bar
  // actually exceeds it, and the dashed rule marks where 100% sits once it is
  // no longer the top edge.
  // `fill`: quarter only, passed in by the caller rather than derived from
  // the bar count here. Week/month always keep the fixed --chart-bar-span
  // column width, however few bars a young goal has to show — stretching a
  // sparse chart to fill the card would mean its bars are a DIFFERENT width
  // than a fuller chart's, defeating the point of a fixed per-bar width in
  // the first place (12.25 bars per screen stops meaning anything if "how
  // wide is a bar" also depends on how many there are). Quarter is the one
  // exception: it is always exactly 4 bars (TIMEFRAME_MAX.quarter), already
  // year-bound by construction, and reads better stretched full-width than
  // left mostly empty.
  _perfChart(points, fill) {
    const vals = points.map(p => p.value).filter(v => v !== undefined);
    if (vals.length === 0) return '';
    const scale = Math.max(100, ...vals);
    // The best period, and the worst one that still has *something* in it —
    // an untouched 0% period isn't "low", it's absent, and labelling it would
    // read as a floor that was never actually attempted. Ties resolve to
    // whichever occurs first (oldest), via indexOf/findIndex, so at most one
    // bar ever carries each label even when several periods share the value
    // — a flat, all-100% run gets exactly one callout, not one per bar.
    const maxVal = Math.max(...vals);
    const nonZero = vals.filter(v => v > 0);
    const minVal = nonZero.length ? Math.min(...nonZero) : undefined;
    const maxIdx = points.findIndex(p => p.value === maxVal);
    const minIdx = minVal === undefined ? -1 : points.findIndex(p => p.value === minVal);
    let tracks = '', axis = '';
    points.forEach((p, i) => {
      const v = p.value;
      const over = v !== undefined && v > 100;
      // "over" already covers any bar that broke 100%, regardless of whether
      // it's the single highest — that is its own, pre-existing callout, kept
      // as-is and simply joined by the two new ones.
      const labelled = over || i === maxIdx || i === minIdx;
      const heightPct = v === undefined ? 0 : Math.max(v > 0 ? 4 : 0, (v / scale) * 100);
      // The label's own inset-block-end matches the bar's block-size exactly,
      // so it tracks that specific bar's current top — see .perf-val's own
      // comment on why that beats one shared row at a fixed height.
      const label = labelled ? `<span class="perf-val tabular" style="inset-block-end:calc(${heightPct}% + 2px)">${v}%</span>` : '';
      tracks += `<div class="perf-col">${label}${v === undefined ? '' :
        `<div class="perf-bar${over ? ' over' : ''}" style="block-size:${heightPct}%"></div>`}</div>`;
      const showLabel = fill || i === 0 || i === points.length - 1 || i === Math.floor((points.length - 1) / 2);
      axis += `<div class="perf-ax">${showLabel ? p.label : ''}</div>`;
    });
    const rule = scale > 100
      ? `<div class="perf-100" style="inset-block-end:${((100 / scale) * 100).toFixed(1)}%"></div>` : '';
    // All one line, deliberately: a newline + indentation here used to sit
    // between the opening tag and .perf-tracks, which turns out not to be
    // cosmetic — it leaves a whitespace-only text node as this element's
    // first child, invisible to any .children-based child count (text nodes
    // aren't elements) but still factored into the parent's own scrollable
    // overflow area in this browser, inflating #perf-scroll's scrollWidth by
    // several px even though every real element measured correctly. Confirmed
    // by direct comparison: the histogram's own equivalent template has never
    // had that whitespace and has never shown the discrepancy.
    return `<div class="perf-scroll" id="perf-scroll" role="img" aria-label="${t('goal-analytics.a11y-consistency')}"><div class="perf-tracks${fill ? ' fill' : ''}">${rule}${tracks}</div><div class="perf-axis${fill ? ' fill' : ''}">${axis}</div></div>`;
  }

  // Min-max autoscaled, deliberately not a 0-100 axis: the signal in a run of
  // score snapshots is usually a few points of movement, which a full-range
  // axis flattens into a straight line. The cost is that the shape says
  // nothing about absolute level — that is the hero number's job, directly
  // above it.
  _sparkline(values) {
    const w = 120, h = 26, pad = 3; // h was 30, compressed 4px on request
    const finite = values.filter(v => v !== undefined);
    if (finite.length < 2) return '';
    const min = Math.min(...finite), max = Math.max(...finite), range = (max - min) || 1;
    // x still comes from the index over the full array, so a gap of
    // undefined values keeps its real position on the timeline.
    const pts = values.map((v, i) => {
      if (v === undefined) return null;
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return { x: +x.toFixed(1), y: +y.toFixed(1) };
    }).filter(Boolean);
    // Per-month marks (one punched into the line per month, matching the
    // a11y label below) were tried and dropped on request — plain line reads
    // better. The aria-label still names the month count: that describes the
    // data span, not the marks, and stays true either way.
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${t('goal-analytics.a11y-sparkline', { n: values.length })}">
      <polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  }

  _lineChart(seriesA, seriesB, axisLabels = []) {
    // 96: matches the Consistency bar chart's .perf-tracks height and the
    // Activity histogram's .histogram height, so the two Overview charts
    // read at one plot size instead of each picking its own.
    const w = 268, h = 96, padTop = 8, padBottom = 4;
    // Undefined points are skipped, not drawn as 0 — completionSeries leaves
    // them in precisely so "no snapshot existed yet" stays distinguishable
    // from a real 0%. Plotting them flattened the line along the axis and
    // read as "you were at zero" for every period before a goal's first
    // recorded value.
    const path = series => {
      let d = '', started = false;
      series.forEach((v, i) => {
        if (v === undefined) return;
        const x = series.length === 1 ? w / 2 : (i / (series.length - 1)) * w;
        const y = padTop + (1 - v / 100) * (h - padTop - padBottom);
        d += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
        started = true;
      });
      return d.trim();
    };
    const grid = [0, 50, 100].map(v => {
      const y = padTop + (1 - v / 100) * (h - padTop - padBottom);
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="var(--color-border)" stroke-width="1" />`;
    }).join('');
    const known = seriesA.filter(v => v !== undefined);
    const lastVal = known[known.length - 1] ?? 0;
    const lastX = w, lastY = padTop + (1 - lastVal / 100) * (h - padTop - padBottom);
    const dashed = seriesB ? `<path d="${path(seriesB)}" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-dasharray="4 3" />` : '';
    // Only the first point is labelled: the last one is already the hero
    // number at the top of the page, so repeating it is noise. Rendered as
    // positioned HTML rather than an SVG <text>, because the chart uses
    // preserveAspectRatio="none" — any text inside it would be stretched
    // horizontally along with the plot.
    const firstIdx = seriesA.findIndex(v => v !== undefined);
    const startLabel = firstIdx === -1 ? '' : (() => {
      const v = seriesA[firstIdx];
      const y = padTop + (1 - v / 100) * (h - padTop - padBottom);
      const leftPct = (seriesA.length === 1 ? 0.5 : firstIdx / (seriesA.length - 1)) * 100;
      return `<span class="line-start-val tabular" style="inset-block-start:${(y - 16).toFixed(1)}px; inset-inline-start:${leftPct.toFixed(1)}%">${v}%</span>`;
    })();
    const axis = axisLabels.length
      ? `<div class="line-axis">${axisLabels.map(l => `<span>${l}</span>`).join('')}</div>` : '';
    return `<div class="line-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="${t('goal-analytics.a11y-progress-chart')}">${grid}${dashed}
      <path d="${path(seriesA)}" fill="none" stroke="var(--color-accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastX}" cy="${lastY.toFixed(1)}" r="4" fill="var(--color-accent)" />
      </svg>${startLabel}</div>${axis}`;
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  // Four cards, each built by its own method below. This one owns only the
  // hero number and the page's assembly order.
  _renderOverview(goal) {
    const todayIso = todayISO();
    const current = percentValueAt(goal, todayIso) ?? 0;
    // Countdown gets no trend section and no pace callout. Its percentage is
    // the calendar running down — nothing else feeds it — so every trend
    // reading is a restatement of the arithmetic the user already set up: the
    // week/month/quarter deltas are a fixed rate the goal cannot deviate from,
    // and the projected finish is the due date by construction ("on pace,
    // projected right around your 31 Dec deadline" — it could never say
    // anything else). The days-left card below carries the one figure here
    // that actually tells the user something.
    const trend = !isCountdown(goal);
    const recent = completionSeriesAt(goal, this._sparkSamples(todayIso)).map(p => p.value);
    const spark = this._sparkline(recent);

    return `<div class="page">
      ${this._pageHead(goal, 'goal-analytics.page-title-overview')}
      <div class="hero-number"><div class="big tabular">${current}<span class="pct-unit">%</span></div>
        ${spark}
      </div>
      <div class="stat-row centered">${this._typeCard(goal, todayIso)}${this._deadlineCard(goal, todayIso)}${this._daysLeftCard(goal, todayIso)}</div>
      ${trend ? `<div class="stat-row comparison">${this._comparisonRow(goal, todayIso)}</div>` : ''}
      ${trend ? this._renderPaceCallout(projectPace(goal, todayIso)) : ''}
      ${this._progressCard(goal, todayIso)}
      ${this._consistencyCard(goal, todayIso)}
    </div>`;
  }

  // What kind of goal this is, and how much has been logged — the two stats
  // sitting side by side under the hero number.
  _typeCard(goal, todayIso) {
    // Every read here goes through `tr` rather than goal.tracking directly: a
    // goal whose tracking was never migrated (or a caller passing a bare
    // {id,title}) must render a quiet, empty Overview rather than throwing
    // two shadow roots deep and blanking the whole dialog.
    const tr = goal?.tracking ?? {};
    const typeLabel = tr.type ? t(`goal-dialog.type-${tr.type}`) : null;
    // Only weekly/monthly/decreasing have a target/allowance worth
    // summarising on a second line — percentage has no per-period target at
    // all, so it stays a single-line stack. Mirrors goal-dialog.js's own
    // type-summary key construction exactly so the two never drift apart.
    // Countdown is the one type whose summary isn't a target — its own
    // type-summary string is the words "To date" again, which just repeats
    // the label above it. The date it counts down *to* is the thing worth
    // saying, and it lives on the goal's dueDate rather than in tracking.
    const summaryKey = !tr.type || tr.type === 'percentage' || tr.type === 'countdown' ? null
      : `goal-dialog.type-summary-${tr.type}`;
    const summary = tr.type === 'countdown'
      ? (goal.dueDate ? fullDate(goal.dueDate) : null) // no deadline set yet — nothing to count down to
      : summaryKey ? t(summaryKey, { target: tr.target }) : null;
    // A weekly goal on a specific-days schedule says which days right here,
    // under its own "N×/week" line — that schedule *is* the goal ("Mon/Wed/
    // Fri", not just "3 times somewhere in the week"), and it was otherwise
    // visible nowhere outside the edit form's own tracking summary. Times-
    // per-week ('any') goals have no days to name and keep the two-line
    // stack unchanged.
    const scheduledDays = tr.type === 'weekly' && Array.isArray(tr.reminderDays) && tr.reminderDays.length > 0
      ? tr.reminderDays : null;
    const typeStack = typeLabel
      ? `<div class="type-stack"><span class="type-primary stat-headline">${typeLabel}</span>${
          summary ? `<span class="type-secondary">${summary}</span>` : ''}${
          scheduledDays ? this._scheduleStrip(scheduledDays) : ''}</div>`
      : null;

    const count = isCountdown(goal) ? null : updateCount(goal, todayIso, this._daysBack(todayIso));
    const countLabel = isDecreasing(goal) ? 'goal-analytics.stat-slips' : tr.type === 'percentage' ? 'goal-analytics.stat-updates' : 'goal-analytics.stat-entries';
    // The Avoid count is every slip logged, forgiven ones included — that's
    // what "slips" means, and hiding the allowed ones would make the number
    // disagree with the histogram and the calendar. The split is what's
    // actually interesting, so how many of them actually broke the allowance
    // reads underneath it.
    const overCount = isDecreasing(goal)
      ? [...slipStates(goal, todayIso, this._daysBack(todayIso)).values()].filter(st => st === 'over').length : 0;
    const countSub = isDecreasing(goal) && count > 0
      ? `<div class="stat-sub stat-sub-lg">${t('goal-analytics.stat-slips-over', { n: overCount })}</div>` : '';

    return `${typeStack ? `<div class="stat">${typeStack}</div>` : ''}
      ${count !== null ? `<div class="stat"><div class="stat-label">${t(countLabel)}</div><div class="stat-value stat-headline stat-count tabular">${count}</div>${countSub}</div>` : ''}`;
  }

  // A goal with a deadline says so here rather than only on its row — this
  // page is where you come to ask "how am I doing", and against what date is
  // half of that answer. Countdown is excluded: its whole percentage is
  // derived from this date, which its own type card already names, so a
  // second card would say the same thing twice. The relative phrase reuses
  // the app's own urgency vocabulary (t('urgency.*'), the same wording the
  // rows' aria-labels use) rather than inventing a second way to say "due
  // this week". Only overdue takes a colour, matching the rule everywhere
  // else that overdue is the one loud state — and the phrase underneath
  // carries the same meaning in text, so colour is never the only cue.
  _deadlineCard(goal, todayIso) {
    if (!goal?.dueDate || isCountdown(goal)) return '';
    const active = (percentValueAt(goal, todayIso) ?? 0) < 100 && !goal.archived;
    const bucket = urgencyOf(goal.dueDate, active);
    return `<div class="stat">
      <div class="stat-label">${t('goal-analytics.stat-deadline')}</div>
      <div class="stat-value stat-headline${bucket === 'overdue' ? ' overdue' : ''}">${shortDate(goal.dueDate, todayIso)}</div>
      ${bucket === 'none' ? '' : `<div class="stat-sub">${t(`urgency.${bucket}`)}</div>`}
    </div>`;
  }

  // Countdown's counterpart to _deadlineCard, which is excluded for this type
  // because its own type card already names the target date. What that card
  // can't say is the part that actually moves: how much runway is left. Only
  // rendered for countdown — every other type either has no date at all or
  // gets the deadline card above, whose relative phrase ("due this week")
  // already covers the same ground at the granularity those goals need.
  _daysLeftCard(goal, todayIso) {
    if (!isCountdown(goal)) return '';
    // null, not 0: no due date set yet (the dialog force-opens the field when
    // countdown is picked, but a goal can sit mid-edit without one) — there is
    // nothing to count down to, so the card is dropped rather than reading 0.
    const days = countdownDaysRemaining(goal, todayIso);
    if (days === null) return '';
    // countdownDaysRemaining floors at 0, so a passed date reads 0 — which on
    // its own is ambiguous with "due today". The sub-line disambiguates it.
    const reached = todayIso >= goal.dueDate;
    return `<div class="stat">
      <div class="stat-label">${t('goal-analytics.stat-days-left')}</div>
      <div class="stat-value tabular">${days}</div>
      ${reached ? `<div class="stat-sub">${t('goal-analytics.countdown-reached')}</div>` : ''}
    </div>`;
  }

  // Week, month and quarter. No "vs year": a goal lives inside a single year,
  // so that one always reached back to before the goal existed and
  // permanently read "not enough history" — a third of the row spent saying
  // nothing. If goals ever span years, it can come back.
  _comparisonRow(goal, todayIso) {
    return ['week', 'month', 'quarter'].map(unit => {
      const delta = comparisonDelta(goal, unit, todayIso);
      const label = t(`goal-analytics.vs-${unit}`);
      if (delta === null) return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value muted tabular">—</div></div>`;
      // Zero is neither gain nor loss and stays the default text colour —
      // only a real move in either direction gets coloured.
      const dir = delta > 0 ? ' delta-up' : delta < 0 ? ' delta-down' : '';
      return `<div class="stat${dir}"><div class="stat-label">${label}</div><div class="stat-value tabular">${delta}<span class="unit">${t('goal-analytics.pts')}</span></div></div>`;
    }).join('');
  }

  // Achieved score over time against the pace that was available.
  _progressCard(goal, todayIso) {
    // A monthly goal has no week inside a month — same exclusion
    // Consistency already applies to its own timeframe select, and for the
    // same reason: offering it isn't just unhelpful, it's also how a stale
    // selection could leak in (this element is reused across different
    // goals in one session, and _tfProgress is never reset on goal change —
    // a goal viewed right after a weekly one could otherwise inherit its
    // 'week' pick with no way for that choice to make sense here).
    const exclude = naturalUnitIsMonth(goal) ? ['week'] : [];
    const picked = this._timeframe(this._tfProgress, goal);
    const tf = exclude.includes(picked) ? 'month' : picked;
    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.progress-chart-title')}</h3>${this._timeframeSelect('tf-progress', tf, exclude)}</div>
      <div class="card-body" id="progress-body">${this._progressBody(goal, todayIso)}</div>
    </div>`;
  }

  // Everything in the Progress card that depends on the timeframe — i.e.
  // everything below .card-head. Split out so a timeframe change can replace
  // just this and leave the <select> that triggered it alive in the DOM; see
  // _swapCardBody for why that matters.
  _progressBody(goal, todayIso) {
    const exclude = naturalUnitIsMonth(goal) ? ['week'] : [];
    const picked = this._timeframe(this._tfProgress, goal);
    const tf = exclude.includes(picked) ? 'month' : picked;
    const maxCount = clampPeriods(tf, BARS_PROGRESS[tf]);
    // Month only, matching the request precisely: never reach before 1
    // January of the year being viewed, or before the goal's own first
    // entry if that's later — the same bound Consistency/Histogram already
    // apply to their own bar counts (_barCount). Week/quarter are left at
    // their plain fixed cap — a 12-week (~3-month) reach rarely crosses a
    // year boundary, and quarter is already year-bound by construction
    // (TIMEFRAME_MAX.quarter = 4).
    const count = tf === 'month' ? this._barCount(goal, tf, maxCount, todayIso) : maxCount;
    // Sampled by day, not by period — see denseSamples for why (a percentage
    // goal's shorter-lived values fell through the gaps between period
    // boundaries entirely). Both lines read the same sample dates, so they
    // stay aligned on the x-axis.
    const samples = denseSamples(tf, count, todayIso);
    const achieved = completionSeriesAt(goal, samples).map(p => p.value);
    // null means no dashed line at all. Percentage anchors its ramp on the
    // first recorded value and draws nothing before one exists. Countdown
    // draws nothing ever: its value is driven purely by the calendar, so an
    // "expected" line is identical to the achieved one by construction.
    // Weekly/monthly/Avoid use the recovery curve; for Avoid that is a flat
    // 100, kept deliberately as a reference showing that a clean run is the
    // whole target.
    const type = goal?.tracking?.type;
    const expected = type === 'percentage' ? expectedRampSeriesAt(goal, samples)
      : type === 'countdown' ? null
      : recoveryCurveAt(goal, samples, todayIso);
    // Three labels — oldest, midpoint, newest — matching the Consistency
    // chart's own axis so the two read the same way. Four or fewer periods
    // (quarter, capped at the year's 4) name every one instead: the axis row is
    // justify-content:space-between, so a "midpoint" picked out of only four
    // renders at 50% of the width while standing for a period two thirds along.
    const axisIdx = count <= 4
      ? Array.from({ length: count }, (_, k) => count - 1 - k)
      : [count - 1, Math.floor((count - 1) / 2), 0];
    const axis = axisIdx.map(i => periodLabel(tf, i, todayIso));
    // No legend: the card title says what's being measured, and the solid
    // vs. dashed line is explained by the chart itself (the callout above it
    // names the projected finish, which only makes sense read against the
    // dashed pace line it is compared to).
    return this._lineChart(achieved, expected, axis);
  }

  // How each individual period went against its own target. Only weekly,
  // monthly, and decreasing goals have one — countdown ("To date") and
  // percentage don't, so there's nothing for a bar to measure a period
  // against: every one of them silently came back 0% forever, a chart saying
  // nothing (confirmed directly for percentage — .perf-bar rendered at
  // block-size:0% across the board, just the 3px min-height floor repeated
  // as a flat line). Written as what the card DOES need (a target) rather
  // than an exclusion list of types that lack one, so a future type without
  // a per-period target doesn't silently repeat this. Countdown's progress
  // is the calendar running down, and percentage's is its own cumulative
  // number — both already shown in full by the hero number and the Progress
  // chart above.
  _consistencyCard(goal, todayIso) {
    if (!isFrequency(goal) && !isDecreasing(goal)) return '';
    // A monthly goal has no month inside a week, so that timeframe is dropped
    // rather than shown returning a repeated or empty figure.
    const exclude = naturalUnitIsMonth(goal) ? ['week'] : [];
    const picked = this._timeframe(this._tfPerf, goal);
    const tf = exclude.includes(picked) ? 'month' : picked;
    const body = this._consistencyBody(goal, todayIso);
    if (!body) return '';

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.consistency-title')}</h3>${this._timeframeSelect('tf-perf', tf, exclude)}</div>
      <div class="card-body" id="perf-body">${body}</div>
    </div>`;
  }

  // Empty string when there is nothing to plot at all — the caller drops the
  // whole card in that case, and _swapCardBody falls back to a full render so
  // the card can disappear rather than leaving a stranded header.
  _consistencyBody(goal, todayIso) {
    const exclude = naturalUnitIsMonth(goal) ? ['week'] : [];
    const picked = this._timeframe(this._tfPerf, goal);
    const tf = exclude.includes(picked) ? 'month' : picked;
    const maxCount = clampPeriods(tf, BARS_CONSISTENCY[tf]);
    const count = tf === 'quarter' ? maxCount : this._barCount(goal, tf, maxCount, todayIso);
    const points = periodPerformanceSeries(goal, tf, count, todayIso)
      .map((p, i) => ({ ...p, label: periodLabel(tf, count - 1 - i, todayIso) }));
    const chart = this._perfChart(points, tf === 'quarter');
    if (!chart) return '';
    return `${chart}
      ${tf === naturalUnitFor(goal) ? '' : `<p class="footnote">${t('goal-analytics.consistency-note-avg')}</p>`}`;
  }

  // Fixed 7-slot Mon-Sun strip, scheduled days lit — the same "position
  // disambiguates the day, one letter per slot" idiom as day-strip.js (the
  // edit form's and Upcoming dialog's shared widget). Not that component
  // itself: its five states are all *live* progress states (missed/logged/
  // pending/...) and carry a colour assumption about sitting on
  // --color-surface, where this says only which days the goal is set for —
  // a static property of the goal, not this week's outcome, which the
  // Score/Activity pages already cover in full.
  _scheduleStrip(days) {
    const named = WEEKDAYS.filter(d => days.includes(d)).map(d => t(`goal-dialog.dow-${d}`)).join(', ');
    const slots = WEEKDAYS
      .map(d => `<span class="sched-slot${days.includes(d) ? ' on' : ''}">${t(`goal-dialog.reminder-day-${d}`)}</span>`)
      .join('');
    return `<span class="sched-strip" role="img" aria-label="${esc(t('goal-analytics.a11y-scheduled-days', { days: named }))}">${slots}</span>`;
  }

  _renderPaceCallout(pace) {
    if (!pace) return '';
    const monthsLabel = n => n === 1 ? t('goal-analytics.month-singular') : t('goal-analytics.month-plural', { n });
    let text;
    if (pace.insufficientMomentum) text = t('goal-analytics.pace-insufficient');
    else if (pace.deadlineIso) {
      const label = monthAbbr(localDate(pace.projectedIso).getMonth()) + ' ' + localDate(pace.projectedIso).getFullYear();
      const deadlineLabel = fullDate(pace.deadlineIso);
      if (Math.abs(pace.diffMonths) < 1) text = t('goal-analytics.pace-on-track', { deadline: deadlineLabel });
      else if (pace.diffMonths > 0) text = t('goal-analytics.pace-behind', { monthsLabel: monthsLabel(pace.diffMonths), projected: label, deadline: deadlineLabel });
      else text = t('goal-analytics.pace-ahead', { monthsLabel: monthsLabel(Math.abs(pace.diffMonths)), projected: label });
    } else {
      const label = monthAbbr(localDate(pace.projectedIso).getMonth()) + ' ' + localDate(pace.projectedIso).getFullYear();
      text = t('goal-analytics.pace-projected', { projected: label });
    }
    return `<div class="pace-callout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg><span>${text}</span></div>`;
  }

  // ── Score ────────────────────────────────────────────────────────────────
  _renderScore(goal) {
    const todayIso = todayISO();
    const window = PERIOD_WINDOW[goal.tracking.type];
    const unit = naturalUnitFor(goal);

    // Context groups scale with how much real history actually exists — a
    // goal with nothing logged yet shows only the counted window itself (no
    // fabricated empty dots), one with a long history shows as many full
    // groups as it genuinely spans, up to the data window. Always keyed
    // off rawLoggedDates, never dateListFor: decreasing's on-track
    // complement would otherwise read as "infinite real history" for a
    // goal that has never logged a single real entry.
    const logged = rawLoggedDates(goal, todayIso, this._daysBack(todayIso));
    const extentDays = logged.length === 0 ? 0 : daysBetween(logged.reduce((a, b) => (a < b ? a : b)), todayIso);
    // +1 because extentDays measures the gap between the first record and
    // today, so a goal whose history spans N period-lengths actually touches
    // N+1 periods — the one it started in included. Without it the oldest
    // period of real history fell outside the grid.
    // Clamped to one year's worth of periods, the same annual ceiling every
    // chart on the other pages takes from TIMEFRAME_MAX. Exact for monthly
    // (12 = three 4-month groups); weekly lands on 54 rather than 52, since
    // the grid is built from whole 6-week groups and cannot be cut mid-column
    // — the last slots are simply blank for periods with no history behind them.
    const extentPeriods = Math.min(
      TIMEFRAME_MAX[unit],
      Math.floor(extentDays / (unit === 'month' ? 30.44 : 7)) + 1);
    const availableContextPeriods = Math.max(0, extentPeriods - window);
    // Rounded up, not down: flooring meant only *whole* extra groups were
    // drawn, so up to window-1 periods of real history were silently absent
    // — a goal with 12 weeks behind it showed 6. That made this page
    // unusable as the reference for what a goal has actually done, which is
    // exactly what it is for. A partial group fills its unused slots with
    // the same reserved blanks the counted group already uses.
    const contextGroups = Math.min(SCORE_CONTEXT_GROUPS_MAX, Math.ceil(availableContextPeriods / window));
    const totalGroups = contextGroups + 1;
    const current = percentValueAt(goal, todayIso) ?? 0;
    const label = `${window} ${unitWord(unit, window)}`;

    let groupsHtml = '';
    for (let g = 0; g < totalGroups; g++) {
      groupsHtml += this._scoreGroup(goal, {
        isCountedGroup: g === totalGroups - 1,
        topPeriodsAgo: (totalGroups - 1 - g) * window,
        window, unit, todayIso,
      });
    }

    // No real context groups to show (a new-ish goal, history not yet
    // longer than the counted window itself) — rather than fabricating
    // empty-looking groups with no real data behind them (the exact thing
    // the dynamic context-group count above was built to avoid), a short
    // note fills the space where older groups will eventually appear,
    // explaining the gap instead of just leaving it silently blank.
    const olderNote = contextGroups === 0
      ? `<p class="calc-older-note">${t(`goal-analytics.older-periods-note-${unit}`)}</p>` : '';

    return `<div class="page">
      ${this._pageHead(goal, 'goal-analytics.page-title-score')}
      <div class="card">
        <div class="calc-header"><span>${t('goal-analytics.score-contribute', { label })}</span><span class="calc-header-pct tabular">${current}%</span></div>
        <div class="calc-scroll-outer" id="calc-scroll" role="img" aria-label="${t('goal-analytics.a11y-score-grid')}">${olderNote}<div class="calc-grid">${groupsHtml}</div></div>
      </div>
    </div>`;
  }

  // One column of the score grid: `window` periods, newest at the top. The
  // counted group is the one the score actually reads; the rest are context.
  _scoreGroup(goal, { isCountedGroup, topPeriodsAgo, window, unit, todayIso }) {
    const periodDate = periodsAgo => unit === 'month' ? monthOnOrBefore(periodsAgo, todayIso) : mondayOfWeek(periodsAgo, todayIso);

    let cellsHtml = '', realCells = 0, oldestRealPeriodsAgo = topPeriodsAgo;
    for (let rIdx = 0; rIdx < window; rIdx++) {
      // Recency weighting is visible as opacity, strongest at the top where
      // "now" is — the same 1..window ramp weightedAverage itself applies.
      const weight = isCountedGroup ? (window - rIdx) / window : 0;
      const periodsAgo = topPeriodsAgo + rIdx;
      const cell = this._scoreCell(goal, {
        periodsAgo,
        opacity: isCountedGroup ? (0.55 + weight * 0.45) : 1,
        unit, todayIso,
      });
      if (!cell.placeholder) { realCells++; oldestRealPeriodsAgo = periodsAgo; }
      cellsHtml += cell.html;
    }
    // A group with nothing real in it at all is dropped whole — reserving
    // space is about the counted window filling up, not about padding the
    // grid leftward with columns that will never gain a mark.
    if (realCells === 0) return '';

    // Each column spans `window` periods, newest at the top — 6 weeks or 4
    // months, either of which routinely crosses a calendar-month boundary (a
    // monthly column, spanning 4 real months by construction, crosses one
    // every single time). A single "top period's month" label silently
    // mis-described every period beneath it once that happened. Ranged over
    // the real span only (oldest real cell to newest), not the full reserved
    // window — a group with placeholder cells at the bottom (not-yet-existing
    // history) shouldn't claim to cover a month with no real data in it.
    const topDate = periodDate(topPeriodsAgo);
    const bottomDate = periodDate(oldestRealPeriodsAgo);
    const sameMonth = topDate.getFullYear() === bottomDate.getFullYear() && topDate.getMonth() === bottomDate.getMonth();
    const label = sameMonth ? monthAbbr(topDate.getMonth())
      : `${monthAbbr(bottomDate.getMonth())}–${monthAbbr(topDate.getMonth())}`;

    return `<div class="calc-group${isCountedGroup ? ' counted' : ''}">
      <div class="calc-group-label">${label}</div>${cellsHtml}</div>`;
  }

  // One period's mark. Returns its `placeholder` state alongside the html so
  // the group can tell reserved space from a period with real history.
  _scoreCell(goal, { periodsAgo, opacity, unit, todayIso }) {
    const isCurrent = periodsAgo === 0;
    // Kept in the flow, just not drawn: the group has to stay the full
    // window tall so its height reads as "this many periods are counted",
    // with the drawn ones filling in as they happen.
    const placeholder = !isCurrent && this._endsBeforeHistory(goal, periodsAgo, unit, todayIso);
    let shape, badge = '', failed = false;

    if (isDecreasing(goal)) {
      const weekStates = weekDayStates(goal, todayIso, periodsAgo);
      // A week that spent more than its allowance is a failed week — the
      // same thing the row's own septagon shows by draining those days.
      failed = weekStates.some(d => !d.future && d.state === 'over');
      shape = septagonGlyph(weekStates, SCORE_SEPTAGON_SIZE, failed);
    } else {
      const periodIso = toIso(unit === 'month' ? monthOnOrBefore(periodsAgo, todayIso) : mondayOfWeek(periodsAgo, todayIso));
      const keyFn = unit === 'month' ? monthKey : isoWeekKey;
      const key = keyFn(periodIso);
      const count = (goal.tracking.entries ?? []).filter(e => keyFn(e) === key).length;
      const target = goal.tracking.target || 1;
      // The current period is still open — falling short of target is not
      // a miss yet, so it never goes red. Every earlier one is closed and
      // judged on its own count. Resolved here rather than inside the
      // shape functions so weekly and monthly can't drift on what
      // "failed" means.
      failed = !isCurrent && !placeholder && count < target;
      if (goal.tracking.type === 'weekly') {
        const filled = Math.min(count, target);
        shape = wedgeGlyph(Array.from({ length: target }, (_, s) => s < filled ? 'on' : 'off'), SCORE_GLYPH_SIZE, failed);
      } else {
        shape = squareSweepGlyph(count / target, SCORE_GLYPH_SIZE, failed);
      }
      if (count > target) badge = `<span class="calc-badge">+${count - target}</span>`;
    }

    const classes = `calc-cell${isCurrent ? ' current' : ''}${failed ? ' failed' : ''}${placeholder ? ' placeholder' : ''}`;
    return {
      placeholder,
      html: `<div class="${classes}" style="opacity:${opacity.toFixed(2)}"${placeholder ? ' aria-hidden="true"' : ''}>
        <div class="calc-shape-wrap">${shape}${badge}</div>
        <div class="calc-label-slot">${isCurrent ? t('goal-analytics.now') : ''}</div>
      </div>`,
    };
  }

  // Whether a period ended before the goal's first record, i.e. before there
  // was anything to log. Such periods are drawn as reserved blanks rather
  // than empty marks: the score does count them as missed (weightedAverage
  // always reads the full PERIOD_WINDOW), but showing a period the goal did
  // not exist for as a miss reads as a failure the user never had — the same
  // reasoning recentDots' own leading-miss trim applies to the row. The
  // period *containing* the first record is kept, since part of it is real.
  // Never for Avoid, which genuinely starts at 100% and for which a
  // pre-history week is a legitimately clean week, not a fabricated miss.
  _endsBeforeHistory(goal, periodsAgo, unit, todayIso) {
    if (isDecreasing(goal)) return false;
    const firstIso = firstRecordIso(goal);
    if (firstIso === undefined) return true;
    const start = unit === 'month' ? monthOnOrBefore(periodsAgo, todayIso) : mondayOfWeek(periodsAgo, todayIso);
    const end = unit === 'month'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 0)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return toIso(end) < firstIso;
  }

  // ── Activity ─────────────────────────────────────────────────────────────
  // One shared key for both slip-marked cards — stroke and fill mean the same
  // two things in each. A method rather than an inline string because the
  // histogram's timeframe handler rebuilds that card on its own and needs the
  // identical markup back (see _wireInteractive).
  _slipLegend() {
    return `<div class="legend"><span><i class="swatch-dot"></i>${t('goal-analytics.legend-allowed')}</span><span><i class="swatch-dot danger"></i>${t('goal-analytics.legend-over')}</span></div>`;
  }

  _renderActivity(goal) {
    const todayIso = todayISO();
    const daysBack = this._daysBack(todayIso);
    // Two different date sources, deliberately: the calendar wants "on
    // track" for decreasing (the whole point of that inversion — see
    // dateListFor's own doc comment), but "how many times was this logged"
    // (the histogram, the frequency grid) means the real entries — for
    // decreasing that's slips, not the far larger set of days nothing
    // happened on. They're identical arrays for every other type.
    const dates = dateListFor(goal, todayIso, daysBack);
    const loggedDates = rawLoggedDates(goal, todayIso, daysBack);
    // Avoid only: which logged slips were forgiven and which broke the
    // allowance. Computed once here because all three cards below colour by
    // it, and each recomputation would be a full re-scan of the year.
    const slipSplit = isDecreasing(goal) ? slipDatesByState(goal, todayIso, daysBack) : null;
    const slipLegend = slipSplit ? this._slipLegend() : '';

    return `<div class="page">
      ${this._pageHead(goal, 'goal-analytics.page-title-activity')}
      ${this._histogramCard(goal, loggedDates, slipSplit, slipLegend, todayIso)}
      ${this._calendarCard(dates, slipSplit, todayIso)}
      ${this._weekdayGridCard(goal, loggedDates, slipSplit, slipLegend, todayIso)}
    </div>`;
  }

  // How many entries landed in each timebox. Avoid's bars count slips, and a
  // slip inside the allowance is not the same event as one past it — so its
  // bar is split rather than painted one colour. Every other type has a
  // single kind of entry and keeps a plain single-colour bar.
  _histogramCard(goal, loggedDates, slipSplit, slipLegend, todayIso) {
    const tf = this._timeframe(this._tfActivity, goal);
    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.count-per-timebox')}</h3>${this._timeframeSelect('tf-activity', tf)}</div>
      <div class="card-body" id="hist-body">${this._histogramBody(goal, loggedDates, slipSplit, slipLegend, todayIso)}</div>
    </div>`;
  }

  // Takes loggedDates/slipSplit rather than deriving them, so a full Activity
  // render scans the entries once for all three of its cards. The timeframe
  // handler recomputes them for this card alone — see _wireInteractive.
  _histogramBody(goal, loggedDates, slipSplit, slipLegend, todayIso) {
    const tf = this._timeframe(this._tfActivity, goal);
    const maxN = clampPeriods(tf, BARS_HISTOGRAM[tf]);
    const n = tf === 'quarter' ? maxN : this._barCount(goal, tf, maxN, todayIso);
    const hist = resampleSumFromDates(loggedDates, tf, n, todayIso);
    const max = Math.max(1, ...hist);
    const overHist = slipSplit ? resampleSumFromDates(slipSplit.over, tf, n, todayIso) : null;
    const withinHist = slipSplit ? resampleSumFromDates(slipSplit.within, tf, n, todayIso) : null;
    // Quarter only — see _perfChart's own comment on why week/month never
    // stretch regardless of how few bars a young goal has.
    const fill = tf === 'quarter';
    const labelStep = 8;

    let bars = '', axis = '';
    hist.forEach((v, i) => {
      const indexFromEnd = n - 1 - i;
      const isMax = v === max && v > 0;
      const h = Math.max(v > 0 ? 6 : 0, (v / max) * 100);
      // A period with no slips at all draws nothing. The stack is stroked now,
      // so an empty one is no longer invisible the way a transparent box was —
      // .bar-stack's min-height would render it as a 3px dash on the baseline,
      // i.e. a mark meaning "slip" on a week that had none, which for an Avoid
      // goal is exactly backwards: that is its best possible week.
      const barHtml = slipSplit
        ? (v > 0 ? `<div class="bar-stack" style="height:${h}%">
            ${overHist[i] > 0 ? `<div class="bar-seg over" style="flex:${overHist[i]}"></div>` : ''}
            ${withinHist[i] > 0 ? `<div class="bar-seg within" style="flex:${withinHist[i]}"></div>` : ''}
          </div>` : '')
        : `<div class="bar" style="height:${h}%"></div>`;
      bars += `<div class="bar-col"><div class="bar-val-slot">${isMax ? `<span class="bar-val tabular">${v}</span>` : ''}</div>
        <div class="bar-track">${barHtml}</div></div>`;
      const showLabel = fill || i === 0 || i === n - 1 || indexFromEnd % labelStep === 0;
      axis += `<div class="ax">${showLabel ? `<span>${periodLabel(tf, indexFromEnd, todayIso)}</span>` : ''}</div>`;
    });

    return `<div class="histogram-scroll" id="hist-scroll" role="img" aria-label="${t(slipSplit ? 'goal-analytics.a11y-histogram-slips' : 'goal-analytics.a11y-histogram')}"><div class="histogram${fill ? ' fill' : ''}">${bars}</div><div class="histogram-axis${fill ? ' fill' : ''}">${axis}</div></div>
      ${slipLegend}`;
  }

  // Day-by-day shading across the year being viewed — 1 January through
  // today (or through 31 December for a year already over), not a rolling
  // 365-day window. Goals are annual, so a window that spilled into the
  // previous year showed months the goal could not have existed in, and for a
  // past year it cut off that year's own January. For Avoid a shaded day can
  // mean two different things — nothing happened, or a slip that was forgiven
  // — so the forgiven ones carry the septagon's own knockout dot (see the
  // .cell.on.within rule) rather than passing as clean days.
  _calendarCard(dates, slipSplit, todayIso) {
    const { start, end } = this._span(todayIso);
    // Whole ISO weeks: the grid's columns are Mon-Sun, so the first column is
    // the week *containing* 1 January (which can start in December) rather
    // than a part-week starting mid-column.
    const firstMonIso = toIso(mondayOfWeek(0, start));
    const lastMonIso = toIso(mondayOfWeek(0, end));
    const weeks = Math.floor(daysBetween(firstMonIso, lastMonIso) / 7) + 1;
    const dateSet = new Set(dates);
    const withinSet = slipSplit ? new Set(slipSplit.within) : null;
    // The month row labels the column a month *starts* in. When the span's
    // first column is the leading partial week — the December days sharing a
    // Mon-Sun column with 1 January — December does not start there, and
    // labelling it anyway puts "Dec" one 11px column away from "Jan '26",
    // where the two overflow their cells and collide into "DecJan '26".
    // Seeding prevMonth with that month suppresses exactly that one stub; a
    // year whose 1 January is itself a Monday still labels column 0.
    const leadIn = localDate(firstMonIso) < localDate(start);
    let monthCells = '', gridCells = '', prevMonth = leadIn ? localDate(firstMonIso).getMonth() : null;
    for (let c = 0; c < weeks; c++) {
      const weeksAgo = weeks - 1 - c;
      const mon = mondayOfWeek(weeksAgo, end);
      const m = mon.getMonth();
      monthCells += m !== prevMonth ? `<span>${monthAbbr(m)}${m === 0 ? ` '${String(mon.getFullYear()).slice(2)}` : ''}</span>` : '<span></span>';
      prevMonth = m;
      for (let r = 0; r < 7; r++) {
        const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + r);
        const iso = toIso(d);
        const on = d <= localDate(todayIso) && dateSet.has(iso);
        gridCells += `<div class="cell${on ? ' on' : ''}${on && withinSet?.has(iso) ? ' within' : ''}"></div>`;
      }
    }

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.calendar-title')}</h3></div>
      <div class="heatmap-outer">
      <div class="heatmap-daylabels"><div class="spacer"></div><div class="daylabel-grid"><span>${t('goal-dialog.dow-mon')[0]}</span><span></span><span></span><span>${t('goal-dialog.dow-thu')[0]}</span><span></span><span></span><span>${t('goal-dialog.dow-sun')[0]}</span></div></div>
      <div class="heatmap-scroll" id="cal-scroll" role="img" aria-label="${t('goal-analytics.a11y-calendar')}"><div class="heatmap-inner">
        <div class="heatmap-monthrow">${monthCells}</div><div class="heatmap">${gridCells}</div>
      </div></div>
      </div>
    </div>`;
  }

  // Which weekdays a goal actually lands on, month by month. Only for types
  // with a per-day log to have a cadence at all.
  // Shown for every type that reaches Activity at all (i.e. every type except
  // countdown, which has no Activity page — see pagesFor — so never reaches
  // this function in the first place). Purely a count of loggedDates by
  // weekday and month, nothing here reads a frequency-specific field
  // (target/entries), so percentage's own loggedDates (whichever days the
  // percentage was updated, from its history) plot exactly the same way a
  // frequency goal's logged days do — "which weekday do I tend to touch
  // this on" is as real a pattern for an occasional update as for a habit.
  _weekdayGridCard(goal, loggedDates, slipSplit, slipLegend, todayIso) {
    // January of the year being viewed through the current month (or through
    // December for a year already over) — the same annual span the calendar
    // above covers, rather than a fixed 14 months that reached back into the
    // previous year and repeated a month name with no year to tell them apart.
    const { start, end } = this._span(todayIso);
    const months = monthSpan(start, end);
    const rail = `<div class="weekday-rail"><span></span><span>${t('goal-dialog.dow-mon')[0]}</span><span>${t('goal-dialog.dow-tue')[0]}</span><span>${t('goal-dialog.dow-wed')[0]}</span><span>${t('goal-dialog.dow-thu')[0]}</span><span>${t('goal-dialog.dow-fri')[0]}</span><span>${t('goal-dialog.dow-sat')[0]}</span><span>${t('goal-dialog.dow-sun')[0]}</span></div>`;
    let cols = '';
    for (let mi = months - 1; mi >= 0; mi--) {
      const md = monthOnOrBefore(mi, end);
      cols += `<div class="month-col"><span class="month-label">${monthAbbr(md.getMonth())}</span>`;
      const byWeekday = [0, 0, 0, 0, 0, 0, 0];
      const overByWeekday = [0, 0, 0, 0, 0, 0, 0];
      for (const iso of loggedDates) {
        const d = localDate(iso);
        if (d.getFullYear() !== md.getFullYear() || d.getMonth() !== md.getMonth()) continue;
        const wd = (d.getDay() + 6) % 7;
        byWeekday[wd]++;
        if (slipSplit?.over.includes(iso)) overByWeekday[wd]++;
      }
      for (let d = 0; d < 7; d++) {
        const count = byWeekday[d];
        const size = count === 0 ? FREQ_DOT_ZERO : FREQ_DOT_BASE + Math.min(count, 4) * FREQ_DOT_STEP;
        // Size still means volume; for Avoid, colour means kind. A cell
        // holding both forgiven and over-allowance slips splits
        // proportionally rather than picking a winner — at 8-14px a wedge
        // still reads as "some of these were fails", where an all-or-nothing
        // rule would either hide a real fail or overstate one among many
        // forgiven days.
        const overPct = count === 0 ? 0 : Math.round(overByWeekday[d] / count * 100);
        // The ring itself (.slip, below) is the total; this fills it to the
        // share that broke the allowance. 0% leaves a bare ring, 100% reads
        // solid because the fill meets the same-coloured stroke, and anything
        // between is a ring filled that far round — the proportional reading
        // the old two-hue split was trying to give, minus the second hue.
        const fill = !slipSplit || count === 0 ? ''
          : `conic-gradient(var(--color-danger) 0 ${overPct}%, transparent ${overPct}% 100%)`;
        // Volume-by-opacity is dropped for Avoid: a stroke faded toward the
        // card stops reading as a stroke at all, which is the whole signal
        // here, and volume is already encoded twice over by the dot's size and
        // by the histogram above. Every other type keeps the ramp — there the
        // mark is a plain solid dot and opacity is the only reinforcement size
        // has.
        const opacity = count === 0 || slipSplit ? 1 : 0.45 + Math.min(count, 4) * 0.18;
        const slipCls = slipSplit && count > 0 ? ' slip' : '';
        cols += `<div class="dot-cell"><div class="freq-dot-el${count === 0 ? ' zero' : ''}${slipCls}" style="width:${size}px;height:${size}px;opacity:${opacity}${fill ? `;background:${fill}` : ''}"></div></div>`;
      }
      cols += '</div>';
    }

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.frequency-title')}</h3></div><div class="freqgrid-wrap">${rail}<div class="freqgrid-scroll" id="freq-scroll" role="img" aria-label="${t(slipSplit ? 'goal-analytics.a11y-freqgrid-slips' : 'goal-analytics.a11y-freqgrid')}"><div class="freqgrid">${cols}</div></div></div>${slipLegend}</div>`;
  }

  // ── Streaks ──────────────────────────────────────────────────────────────
  _renderStreaks(goal) {
    const todayIso = todayISO();
    const dates = dateListFor(goal, todayIso, this._daysBack(todayIso));
    const streaks = topStreaks(dates, 10);
    const title = this._pageHead(goal, 'goal-analytics.page-title-streaks');
    if (streaks.length === 0) return `<div class="page">${title}<div class="empty-note">${t('goal-analytics.no-streaks-yet')}</div></div>`;

    const max = Math.max(...streaks.map(s => s.length));
    const rows = streaks.map(s => {
      const d = localDate(s.end);
      const label = `${monthAbbr(d.getMonth())} ${d.getDate()}`;
      return `<div class="streak-row">
        <span class="streak-date tabular">${label}</span>
        <div class="streak-track"><div class="streak-fill" style="width:${s.length / max * 100}%"></div></div>
        <span class="streak-len tabular">${s.length}${t('goal-analytics.days-abbrev')}</span>
      </div>`;
    }).join('');

    return `<div class="page">${title}<div class="card"><div class="card-head"><h3>${t('goal-analytics.best-streaks')}</h3></div>
      <div class="streak-list">${rows}</div>
    </div></div>`;
  }
}

customElements.define('goal-analytics', GoalAnalytics);
