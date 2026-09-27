import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { todayISO } from '../../utils/today-iso.js';
import {
  isFrequency, isDecreasing, isCountdown, isoWeekKey, monthKey, PERIOD_WINDOW, weekDayStates, daysBetween,
  WEEKDAYS,
} from '../../utils/tracking.js';
import {
  pagesFor, percentValueAt, dateListFor, rawLoggedDates, topStreaks, countByBucket,
  completionSeries, periodPerformanceSeries,
  denseSamples, completionSeriesAt, expectedRampSeriesAt, recoveryCurveAt,
  comparisonDelta, updateCount, projectPace,
  slipStates, slipDatesByState, firstRecordIso,
} from '../../utils/goal-analytics.js';
import { urgencyOf } from '../../utils/urgency.js';
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
const HISTORY_DAYS_BACK = 365; // fixed cap — see the module doc comment below for why

// A goal has no createdAt/first-logged timestamp anywhere in its schema, so
// "how far back does real history go" isn't reliably knowable — a fixed
// 365-day window is used instead of trying to detect a true start. Periods
// within that window that happen to be genuinely empty (a goal younger than
// the window) render as real zero-count periods, which is honest, not
// fabricated — there is no synthetic data being invented, just an honestly
// empty result for a period that really has none.

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

// Avoid's forgiven slips, in the two charts that count slips as events (the
// timebox histogram and the weekday grid). Deliberately NOT the year accent:
// that colour means "good" everywhere else in the app, and a slip inside the
// allowance is not good — it is a slip that happened to cost nothing. A
// muted red keeps it in the same family as the fails it sits next to, one
// step down in weight. Mixed toward the card rather than a fixed pale red so
// it stays legible in both themes.
const SLIP_ALLOWED_FILL = 'color-mix(in srgb, var(--color-danger) 38%, var(--color-surface-raised))';

function naturalUnitOf(goal) { return goal?.tracking?.type === 'monthly' ? 'month' : 'week'; }
function naturalUnitIsMonth(goal) { return naturalUnitOf(goal) === 'month'; }

function unitFor(goal) { return isDecreasing(goal) ? 'week' : goal?.tracking?.type === 'monthly' ? 'month' : 'week'; }
function unitWord(unit, n) { return n === 1 ? t(`goal-analytics.unit-${unit}`) : t(`goal-analytics.unit-${unit}-plural`); }

class GoalAnalytics extends AppElement {
  // Every analytics page leads with which goal it belongs to — the edit form
  // shows the title in its own input, but the analytics pages otherwise give
  // no clue which goal you swiped into.
  _pageHead(goal, titleKey) {
    return `<div class="page-head">
      <h2 class="page-title">${t(titleKey)}</h2>
      <p class="page-goal" title="${esc(goal?.title)}">${esc(goal?.title)}</p>
    </div>`;
  }

  template() {
    return `
      <style>
        :host { display: block; font-family: var(--font-family); color: var(--color-text-primary); }
        .page { display: flex; flex-direction: column; gap: calc(var(--space-5) + 3px); }
        /* One line: heading at the start, goal name at the end. The heading
           never shrinks, so a long goal name ellipsises rather than squeezing
           the label that identifies the page. */
        /* Pinned to the top of modal-dialog's own scrolling .body: which page
           you are on and which goal it belongs to are the two things that
           must never scroll out of reach, since the charts below repeat the
           same shapes from page to page. Padded and given the dialog's own
           surface so content passing underneath is covered. Block padding
           only — an earlier version also bled the cover outward with a
           negative inline margin, which made this element wider than the
           dialog body and gave every analytics page its own horizontal
           scrollbar. The cards below span exactly the content box anyway, so
           there is nothing out there to cover. */
        .page-head { position: sticky; inset-block-start: 0; z-index: 2; display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); background: var(--color-surface); padding-block: var(--space-2); margin-block-start: calc(-1 * var(--space-2)); }
        .page-goal { margin: 0; min-inline-size: 0; flex: 1; text-align: end; font-size: var(--font-size-micro); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .page-title { margin: 0; flex-shrink: 0; font-size: var(--font-size-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

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
        /* --color-text-primary, not muted/secondary: this is the entire
           content of the page when a goal has no streaks yet, so it has to
           clear 4.5:1 — and both of the quieter tokens are documented as
           failing that at body size. The smaller caption size still keeps it
           from reading as loud as a heading. */
        .empty-note { font-size: var(--font-size-caption); color: var(--color-text-primary); line-height: 1.5; text-align: center; padding: var(--space-6) var(--space-2); }

        /* Overview */
        .hero-number { display: flex; align-items: flex-end; justify-content: center; gap: var(--space-3); padding: var(--space-5) 0 var(--space-3); }
        .hero-number .big { font-size: 3.25rem; font-weight: var(--font-weight-bold); line-height: 1; color: var(--color-text-primary); }
        .hero-number .big .pct-unit { font-size: var(--font-size-heading); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
        .spark-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .spark-label { font-size: 9px; color: var(--color-text-muted); }
        .stat-row { display: flex; gap: var(--space-2); }
        .stat-row.centered .stat { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-block-size: 78px; }
        .stat { flex: 1; background: var(--color-surface-raised); border-radius: var(--radius-md); padding: var(--space-3); min-width: 0; }
        .stat-label { font-size: var(--font-size-micro); color: var(--color-text-secondary); font-weight: var(--font-weight-medium); margin-block-end: var(--space-1); }
        .stat-value { font-size: var(--font-size-subheading); font-weight: var(--font-weight-bold); color: var(--color-text-primary); display: flex; align-items: baseline; gap: 3px; }
        .stat-value .unit { font-size: var(--font-size-micro); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
        .stat.delta-up .stat-value { color: var(--color-success); }
        .stat.delta-down .stat-value { color: var(--color-danger); }
        .stat-value.overdue { color: var(--color-danger); }
        .stat-value.muted { color: var(--color-text-muted); font-weight: var(--font-weight-medium); }
        .stat-value.big-num { font-size: var(--font-size-title); }
        .stat-sub { font-size: 10px; color: var(--color-text-muted); margin-block-start: 2px; }
        /* The slips breakdown sits opposite the type stack in the same row,
           so it matches that stack's own second line rather than the smaller
           footnote size the comparison cards use. */
        .stat-sub.stat-sub-lg { font-size: var(--font-size-caption); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-block-start: 3px; }
        .type-stack { display: flex; flex-direction: column; gap: 3px; }
        .type-stack .type-primary { font-size: var(--font-size-subheading); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
        .type-stack .type-secondary { font-size: var(--font-size-caption); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
        /* Scheduled-days strip (weekly goals on specific days). Fixed slot
           width so the 7 letters keep their Mon-Sun positions whatever the
           locale's day initials are — position is what tells Tue from Thu.
           Colour-only distinction is deliberate and matches day-strip.js;
           the strip carries its own aria-label naming the scheduled days, so
           the letters themselves stay purely visual. */
        .sched-strip { display: inline-flex; gap: 2px; margin-block-start: 2px; }
        .sched-slot { min-inline-size: 12px; text-align: center; font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); color: var(--color-border); }
        .sched-slot.on { color: var(--color-accent); }
        .section-label { font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); margin: 0 0 var(--space-2); }
        .legend { display: flex; gap: var(--space-4); font-size: var(--font-size-micro); color: var(--color-text-secondary); margin-block-start: var(--space-2); }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        .legend .swatch-line { inline-size: 12px; block-size: 2px; border-radius: 2px; background: var(--color-accent); display: inline-block; }
        .legend .swatch-line.dashed { background: none; border-top: 1.5px dashed var(--color-text-secondary); }
        /* Avoid's allowed/over-allowance key, shared by the count histogram
           and the weekday grid — a filled block rather than the line swatch
           above, matching the solid marks those two charts actually draw. */
        .legend .swatch-dot { inline-size: 9px; block-size: 9px; border-radius: 2px; background: ${SLIP_ALLOWED_FILL}; display: inline-block; }
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

        /* Per-period result (Overview bar chart) */
        .perf { display: flex; flex-direction: column; inline-size: max-content; margin-inline-start: auto; }
        .perf-vals, .perf-tracks, .perf-axis { display: flex; gap: var(--space-1); }
        .perf-tracks { block-size: 82px; position: relative; align-items: stretch; }
        .perf-vals { min-block-size: 11px; }
        .perf-axis { margin-block-start: var(--space-1); min-block-size: 11px; }
        .perf-col { flex: 0 0 18px; display: flex; align-items: flex-end; }
        .perf-bar { inline-size: 100%; background: var(--color-accent); border-radius: 3px 3px 0 0; min-block-size: 3px; }
        /* Over-target reads as a distinct colour rather than just a taller bar —
           at the week timeframe the value is uncapped, so a 200% week would
           otherwise just look like "a tall bar" with no cue that it crossed the
           line. Paired with the dashed 100% rule below, which only appears when
           the scale actually exceeds 100 (otherwise 100% is the top edge). */
        .perf-bar.over { background: var(--color-success); }
        .perf-100 { position: absolute; inline-size: 100%; inset-inline-start: 0; border-block-start: 1px dashed var(--color-text-secondary); pointer-events: none; }
        .perf-val { flex: 0 0 18px; font-size: 8px; color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); text-align: center; white-space: nowrap; }
        .perf-ax { flex: 0 0 18px; font-size: 8px; color: var(--color-text-muted); text-align: center; white-space: nowrap; }

        .line-wrap { position: relative; }
        .line-start-val { position: absolute; font-size: 8px; font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); white-space: nowrap; pointer-events: none; }
        .line-axis { display: flex; justify-content: space-between; margin-block-start: var(--space-1); }
        .line-axis span { font-size: 8px; color: var(--color-text-muted); white-space: nowrap; }

        /* Score */
        .calc-header { display: flex; justify-content: space-between; align-items: center; margin-block-end: var(--space-3); font-size: var(--font-size-caption); color: var(--color-text-secondary); }
        .calc-header-pct { display: inline-flex; align-items: center; justify-content: center; inline-size: 44px; block-size: 44px; flex-shrink: 0; font-size: var(--font-size-caption); font-weight: var(--font-weight-bold); color: var(--color-text-primary); background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-raised)); border-radius: var(--radius-md); }
        /* justify-content: flex-end so a goal with little enough real
           history to fit without scrolling still anchors to the right
           (where "now" lives) instead of sitting stuck to the left edge —
           independent of the scrollLeft fix in _wireInteractive, which only
           matters once there's enough content to actually need scrolling.
           overflow-x/touch-action deliberately NOT set here — see .scrollable-x,
           applied conditionally by _wireInteractive once real overflow is
           confirmed. Confirmed on-device: declaring overflow-x: auto on an
           element — regardless of whether it currently has any real overflow
           content — breaks that element's inherited touch-action: none from
           an ancestor (.body.has-tabs), even on a completely empty test div at
           the same shadow depth as everything that's worked reliably. Static
           touch-action alone doesn't fix it; the overflow-x declaration itself
           is what breaks inheritance. So it can only ever be present when this
           container is genuinely meant to be a native scroll surface (and
           therefore is *not* meant to double as a tab-swipe surface), never
           unconditionally. */
        .calc-scroll-outer { display: flex; justify-content: flex-end; padding: var(--space-2) 0; }
        /* flex:1 absorbs the space that would otherwise sit empty to the
           left of the counted group — .calc-grid keeps its own natural
           width, so it still ends up flush against the right edge exactly
           as it does with no note present, via the container's own
           justify-content:flex-end. */
        /* --color-text-primary for the same reason as .empty-note: it's the
           only text explaining the blank area, so it can't be sub-4.5:1. */
        .calc-older-note { flex: 1; align-self: center; margin: 0; text-align: center; font-size: var(--font-size-micro); color: var(--color-text-primary); line-height: 1.4; }
        /* touch-action: pan-x is static (present the instant the class is
           added, well before any subsequent touch) — not set reactively
           inside a gesture handler, which is the same distinction that made
           .body's own touch-action fix reliable rather than racy. */
        .scrollable-x { overflow-x: auto; overflow-y: hidden; touch-action: pan-x; }
        .calc-grid { display: flex; align-items: stretch; gap: 0; inline-size: max-content; }
        .calc-group { display: flex; flex-direction: column; gap: 9px; padding: 8px 9px; flex-shrink: 0; }
        .calc-group.counted { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-raised)); border-radius: var(--radius-md); margin-inline-start: var(--space-2); padding-inline-start: var(--space-3); padding-inline-end: 10px; }
        .calc-group-label { font-size: 8px; color: var(--color-text-muted); text-align: center; margin-block-end: 2px; }
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
        .calc-badge { position: absolute; top: -5px; right: -7px; background: var(--color-accent); color: var(--color-text-on-accent); font-size: 7px; font-weight: var(--font-weight-bold); padding: 1px 3px; border-radius: var(--radius-full); line-height: 1.3; }
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
        .histogram-scroll { padding-block-end: 2px; }
        .histogram { display: flex; align-items: stretch; gap: var(--space-1); block-size: 96px; inline-size: max-content; margin-inline-start: auto; }
        .bar-col { flex: 0 0 18px; display: flex; flex-direction: column; align-items: center; }
        .bar-val-slot { block-size: 14px; display: flex; align-items: flex-end; justify-content: center; }
        .bar-val { font-size: 8px; color: var(--color-text-secondary); font-weight: var(--font-weight-semibold); white-space: nowrap; }
        .bar-track { flex: 1; inline-size: 100%; display: flex; align-items: flex-end; min-height: 0; }
        .bar { inline-size: 100%; background: var(--color-accent); border-radius: 3px 3px 0 0; min-height: 3px; }
        /* Avoid's split bar: one rounded, clipped column holding the
           over-allowance segment above the forgiven one, so the pair reads as
           a single bar with a red cap rather than two bars stacked. */
        .bar-stack { inline-size: 100%; display: flex; flex-direction: column; border-radius: 3px 3px 0 0; overflow: hidden; min-height: 3px; }
        .bar-seg.within { background: ${SLIP_ALLOWED_FILL}; }
        .bar-seg.over { background: var(--color-danger); }
        .histogram-axis { display: flex; gap: var(--space-1); inline-size: max-content; margin-block-start: var(--space-1); margin-inline-start: auto; min-height: 11px; }
        .ax { flex: 0 0 18px; font-size: 8px; color: var(--color-text-muted); text-align: center; white-space: nowrap; overflow: visible; }
        .heatmap-outer { display: flex; gap: var(--space-2); align-items: flex-start; }
        .heatmap-scroll { flex: 1; min-width: 0; }
        .heatmap-inner { inline-size: max-content; }
        .heatmap-monthrow { display: grid; grid-auto-flow: column; grid-auto-columns: 11px; gap: 3px; block-size: 12px; margin-block-end: 3px; }
        .heatmap-monthrow span { font-size: 8px; color: var(--color-text-muted); white-space: nowrap; }
        .heatmap { display: grid; grid-auto-flow: column; grid-auto-columns: 11px; grid-template-rows: repeat(7, 11px); gap: 3px; }
        .heatmap .cell { inline-size: 11px; block-size: 11px; border-radius: 3px; background: var(--color-border); }
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
        .daylabel-grid { display: grid; grid-template-rows: repeat(7, 11px); gap: 3px; }
        .daylabel-grid span { font-size: 8px; color: var(--color-text-muted); line-height: 11px; }
        .freqgrid-wrap { display: flex; }
        /* flex:1 + min-width:0, matching .heatmap-scroll above — without it,
           this flex item (child of .freqgrid-wrap) defaults to min-width:auto
           and never shrinks to fit, so it grows past the card and bleeds
           into the page instead of scrolling internally. That also silently
           broke the scrollWidth>clientWidth overflow check in
           _wireInteractive: without the constraint, both values reflect the
           same already-overflowed size, so real overflow never registered. */
        .freqgrid-scroll { flex: 1; min-width: 0; }
        .freqgrid { display: grid; grid-auto-flow: column; gap: 10px; inline-size: max-content; }
        .month-col { display: grid; grid-template-rows: 12px repeat(7, 16px); gap: var(--space-1); text-align: center; }
        .month-label { font-size: 9px; color: var(--color-text-muted); }
        .dot-cell { display: flex; align-items: center; justify-content: center; }
        .freq-dot-el { border-radius: 50%; background: var(--color-accent); }
        .freq-dot-el.zero { inline-size: 4px; block-size: 4px; background: var(--color-border); }
        .weekday-rail { display: grid; grid-template-rows: 12px repeat(7, 16px); gap: var(--space-1); margin-inline-end: 6px; }
        .weekday-rail span { font-size: 9px; color: var(--color-text-muted); display: flex; align-items: center; }

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
    this._activePage = 0;
    this._tfProgress = 'month';
    this._tfActivity = 'month';
    this._tfPerf = 'week';
  }

  set goal(g) { this._goal = g; this._render(); }
  get goal() { return this._goal; }

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

  _wireInteractive(kind) {
    if (kind === 'overview') {
      const sel = this.shadowRoot.querySelector('#tf-progress');
      sel?.addEventListener('change', () => { this._tfProgress = sel.value; this._render(); });
    }
    if (kind === 'overview') {
      const perf = this.shadowRoot.querySelector('#tf-perf');
      perf?.addEventListener('change', () => { this._tfPerf = perf.value; this._render(); });
    }
    if (kind === 'activity') {
      const sel = this.shadowRoot.querySelector('#tf-activity');
      sel?.addEventListener('change', () => { this._tfActivity = sel.value; this._render(); });
    }
    // Deferred a frame: scrollWidth read immediately after an innerHTML
    // replacement can still reflect pre-layout dimensions, silently scrolling
    // to the wrong (often 0/left) position — the same class of timing bug
    // fixed once already for the due-date/notes reveal flash in
    // goal-dialog.js, per its own _flashField timing note. Also where
    // .scrollable-x gets applied (see its own CSS comment for why this can't
    // be unconditional): scrollWidth/clientWidth are measurable regardless of
    // the overflow-x value in effect, so this reads real overflow first and
    // only *then* opts the element into being a native scroll surface —
    // never the reverse order.
    requestAnimationFrame(() => {
      ['hist-scroll', 'cal-scroll', 'freq-scroll', 'calc-scroll'].forEach(id => {
        const el = this.shadowRoot.querySelector('#' + id);
        if (!el) return;
        const overflows = el.scrollWidth > el.clientWidth;
        el.classList.toggle('scrollable-x', overflows);
        // tabindex only while it genuinely overflows: Chrome (unlike Firefox)
        // doesn't make scroll containers focusable on their own, so without
        // this a keyboard user can't reach the off-screen part at all. Gating
        // it on real overflow keeps the tab order free of dead stops on a
        // chart that has nothing to scroll — and since these charts always
        // open scrolled to "now" (below), the most relevant data is already
        // in view without any scrolling.
        if (overflows) el.setAttribute('tabindex', '0');
        else el.removeAttribute('tabindex');
        el.scrollLeft = el.scrollWidth;
      });
    });
  }

  _timeframeSelect(id, current, exclude = []) {
    // No year option: a Telos goal lives inside a single year, so a yearly
    // bucket can only ever hold one meaningful point (and HISTORY_DAYS_BACK
    // caps the data at 365 days regardless). Quarter is the coarsest grouping
    // that still says anything. 'year' stays valid in the utils below — the
    // "vs year" comparison stat still uses it.
    const opts = ['week', 'month', 'quarter'].filter(v => !exclude.includes(v)).map(v =>
      `<option value="${v}" ${v === current ? 'selected' : ''}>${t('goal-analytics.timeframe-' + v)}</option>`).join('');
    return `<select id="${id}" aria-label="${t('goal-analytics.timeframe-label')}">${opts}</select>`;
  }

  // Bars are the per-period result: uncapped at the goal's own natural period
  // (an over-target week genuinely reads above 100%), capped-then-averaged at
  // any coarser timeframe. The scale stretches past 100 only when some bar
  // actually exceeds it, and the dashed rule marks where 100% sits once it is
  // no longer the top edge.
  _perfChart(points) {
    const vals = points.map(p => p.value).filter(v => v !== undefined);
    if (vals.length === 0) return '';
    const scale = Math.max(100, ...vals);
    let valsHtml = '', tracks = '', axis = '';
    points.forEach((p, i) => {
      const v = p.value;
      const over = v !== undefined && v > 100;
      valsHtml += `<div class="perf-val tabular">${over ? v + '%' : ''}</div>`;
      tracks += `<div class="perf-col">${v === undefined ? '' :
        `<div class="perf-bar${over ? ' over' : ''}" style="block-size:${Math.max(v > 0 ? 4 : 0, (v / scale) * 100)}%"></div>`}</div>`;
      const showLabel = i === 0 || i === points.length - 1 || i === Math.floor((points.length - 1) / 2);
      axis += `<div class="perf-ax">${showLabel ? p.label : ''}</div>`;
    });
    const rule = scale > 100
      ? `<div class="perf-100" style="inset-block-end:${((100 / scale) * 100).toFixed(1)}%"></div>` : '';
    return `<div class="perf" role="img" aria-label="${t('goal-analytics.a11y-consistency')}"><div class="perf-vals">${valsHtml}</div>
      <div class="perf-tracks">${rule}${tracks}</div><div class="perf-axis">${axis}</div></div>`;
  }

  _sparkline(values) {
    const w = 96, h = 30;
    const finite = values.filter(v => v !== undefined);
    if (finite.length < 2) return '';
    const min = Math.min(...finite), max = Math.max(...finite), range = (max - min) || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = v === undefined ? null : h - 3 - ((v - min) / range) * (h - 6);
      return y === null ? null : `${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean);
    const last = pts[pts.length - 1].split(',');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${t('goal-analytics.a11y-sparkline')}">
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="var(--color-accent)" />
    </svg>`;
  }

  _lineChart(seriesA, seriesB, axisLabels = []) {
    const w = 268, h = 92, padTop = 8, padBottom = 4;
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
    const recent = completionSeries(goal, 'month', 8, todayIso).map(p => p.value);
    const spark = this._sparkline(recent);

    return `<div class="page">
      ${this._pageHead(goal, 'goal-analytics.page-title-overview')}
      <div class="hero-number"><div class="big tabular">${current}<span class="pct-unit">%</span></div>
        ${spark ? `<div class="spark-wrap">${spark}<span class="spark-label">${t('goal-analytics.last-n-periods', { n: recent.length })}</span></div>` : ''}
      </div>
      <div class="stat-row centered">${this._typeCard(goal, todayIso)}${this._deadlineCard(goal, todayIso)}</div>
      <div><p class="section-label">${t('goal-analytics.change-over-time')}</p><div class="stat-row">${this._comparisonRow(goal, todayIso)}</div></div>
      ${this._progressCard(goal, todayIso)}
      ${this._renderPaceCallout(projectPace(goal, todayIso))}
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
      ? `<div class="type-stack"><span class="type-primary">${typeLabel}</span>${
          summary ? `<span class="type-secondary">${summary}</span>` : ''}${
          scheduledDays ? this._scheduleStrip(scheduledDays) : ''}</div>`
      : null;

    const count = isCountdown(goal) ? null : updateCount(goal, todayIso, HISTORY_DAYS_BACK);
    const countLabel = isDecreasing(goal) ? 'goal-analytics.stat-slips' : tr.type === 'percentage' ? 'goal-analytics.stat-updates' : 'goal-analytics.stat-entries';
    // The Avoid count is every slip logged, forgiven ones included — that's
    // what "slips" means, and hiding the allowed ones would make the number
    // disagree with the histogram and the calendar. The split is what's
    // actually interesting, so how many of them actually broke the allowance
    // reads underneath it.
    const overCount = isDecreasing(goal)
      ? [...slipStates(goal, todayIso, HISTORY_DAYS_BACK).values()].filter(st => st === 'over').length : 0;
    const countSub = isDecreasing(goal) && count > 0
      ? `<div class="stat-sub stat-sub-lg">${t('goal-analytics.stat-slips-over', { n: overCount })}</div>` : '';

    return `${typeStack ? `<div class="stat">${typeStack}</div>` : ''}
      ${count !== null ? `<div class="stat"><div class="stat-label">${t(countLabel)}</div><div class="stat-value big-num tabular">${count}</div>${countSub}</div>` : ''}`;
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
      <div class="stat-value${bucket === 'overdue' ? ' overdue' : ''}">${shortDate(goal.dueDate, todayIso)}</div>
      ${bucket === 'none' ? '' : `<div class="stat-sub">${t(`urgency.${bucket}`)}</div>`}
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
      if (delta === null) return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value muted tabular">—</div><div class="stat-sub">${t('goal-analytics.not-enough-history')}</div></div>`;
      // Zero is neither gain nor loss and stays the default text colour —
      // only a real move in either direction gets coloured.
      const dir = delta > 0 ? ' delta-up' : delta < 0 ? ' delta-down' : '';
      return `<div class="stat${dir}"><div class="stat-label">${label}</div><div class="stat-value tabular">${delta}<span class="unit">${t('goal-analytics.pts')}</span></div></div>`;
    }).join('');
  }

  // Achieved score over time against the pace that was available.
  _progressCard(goal, todayIso) {
    const tf = this._tfProgress;
    // Sampled by day, not by period — see denseSamples for why (a percentage
    // goal's shorter-lived values fell through the gaps between period
    // boundaries entirely). Both lines read the same sample dates, so they
    // stay aligned on the x-axis.
    const samples = denseSamples(tf, 12, todayIso);
    const achieved = completionSeriesAt(goal, samples).map(p => p.value);
    // null means no dashed line at all. Percentage anchors its ramp on the
    // first recorded value and draws nothing before one exists. Countdown
    // draws nothing ever: its value is driven purely by the calendar, so an
    // "expected" line is identical to the achieved one by construction — two
    // lines plotted exactly on top of each other. Weekly/monthly/Avoid use
    // the recovery curve; for Avoid that is a flat 100, kept deliberately as
    // a reference showing that a clean run is the whole target.
    const type = goal?.tracking?.type;
    const expected = type === 'percentage' ? expectedRampSeriesAt(goal, samples)
      : type === 'countdown' ? null
      : recoveryCurveAt(goal, samples, todayIso);
    // Three labels — oldest, midpoint, newest — matching the Consistency
    // chart's own axis so the two read the same way.
    const axis = [11, 5, 0].map(i => periodLabel(tf, i, todayIso));

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.progress-chart-title')}</h3>${this._timeframeSelect('tf-progress', tf)}</div>
      ${this._lineChart(achieved, expected, axis)}
      <div class="legend"><span><i class="swatch-line"></i>${t('goal-analytics.legend-achieved')}</span>${expected ? `<span><i class="swatch-line dashed"></i>${t('goal-analytics.legend-expected')}</span>` : ''}</div>
    </div>`;
  }

  // How each individual period went against its own target. Countdown ("To
  // date") has no per-period target and no entries to measure a period
  // against — every bar came back 0%, a chart saying nothing — so it gets no
  // card at all. Its progress is the calendar running down, which the hero
  // number and the Progress chart already show in full.
  _consistencyCard(goal, todayIso) {
    if (isCountdown(goal)) return '';
    // A monthly goal has no month inside a week, so that timeframe is dropped
    // rather than shown returning a repeated or empty figure.
    const exclude = naturalUnitIsMonth(goal) ? ['week'] : [];
    const tf = exclude.includes(this._tfPerf) ? 'month' : this._tfPerf;
    const count = { week: 12, month: 12, quarter: 8, year: 5 }[tf];
    const points = periodPerformanceSeries(goal, tf, count, todayIso)
      .map((p, i) => ({ ...p, label: periodLabel(tf, count - 1 - i, todayIso) }));
    const chart = this._perfChart(points);
    if (!chart) return '';

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.consistency-title')}</h3>${this._timeframeSelect('tf-perf', tf, exclude)}</div>
      ${chart}
      ${tf === naturalUnitOf(goal) ? '' : `<p class="footnote">${t('goal-analytics.consistency-note-avg')}</p>`}
    </div>`;
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
    const unit = unitFor(goal);

    // Context groups scale with how much real history actually exists — a
    // goal with nothing logged yet shows only the counted window itself (no
    // fabricated empty dots), one with a long history shows as many full
    // groups as it genuinely spans, up to HISTORY_DAYS_BACK. Always keyed
    // off rawLoggedDates, never dateListFor: decreasing's on-track
    // complement would otherwise read as "infinite real history" for a
    // goal that has never logged a single real entry.
    const logged = rawLoggedDates(goal, todayIso, HISTORY_DAYS_BACK);
    const extentDays = logged.length === 0 ? 0 : daysBetween(logged.reduce((a, b) => (a < b ? a : b)), todayIso);
    // +1 because extentDays measures the gap between the first record and
    // today, so a goal whose history spans N period-lengths actually touches
    // N+1 periods — the one it started in included. Without it the oldest
    // period of real history fell outside the grid.
    const extentPeriods = Math.floor(extentDays / (unit === 'month' ? 30.44 : 7)) + 1;
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
    const labelDate = unit === 'month' ? monthOnOrBefore(topPeriodsAgo, todayIso) : mondayOfWeek(topPeriodsAgo, todayIso);

    let cellsHtml = '', realCells = 0;
    for (let rIdx = 0; rIdx < window; rIdx++) {
      // Recency weighting is visible as opacity, strongest at the top where
      // "now" is — the same 1..window ramp weightedAverage itself applies.
      const weight = isCountedGroup ? (window - rIdx) / window : 0;
      const cell = this._scoreCell(goal, {
        periodsAgo: topPeriodsAgo + rIdx,
        opacity: isCountedGroup ? (0.55 + weight * 0.45) : 1,
        unit, todayIso,
      });
      if (!cell.placeholder) realCells++;
      cellsHtml += cell.html;
    }
    // A group with nothing real in it at all is dropped whole — reserving
    // space is about the counted window filling up, not about padding the
    // grid leftward with columns that will never gain a mark.
    if (realCells === 0) return '';

    return `<div class="calc-group${isCountedGroup ? ' counted' : ''}">
      <div class="calc-group-label">${monthAbbr(labelDate.getMonth())}</div>${cellsHtml}</div>`;
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
      shape = septagonGlyph(weekStates, 26, failed);
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
        shape = wedgeGlyph(Array.from({ length: target }, (_, s) => s < filled ? 'on' : 'off'), 22, failed);
      } else {
        shape = squareSweepGlyph(count / target, 22, failed);
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
  _renderActivity(goal) {
    const todayIso = todayISO();
    // Two different date sources, deliberately: the calendar wants "on
    // track" for decreasing (the whole point of that inversion — see
    // dateListFor's own doc comment), but "how many times was this logged"
    // (the histogram, the frequency grid) means the real entries — for
    // decreasing that's slips, not the far larger set of days nothing
    // happened on. They're identical arrays for every other type.
    const dates = dateListFor(goal, todayIso, HISTORY_DAYS_BACK);
    const loggedDates = rawLoggedDates(goal, todayIso, HISTORY_DAYS_BACK);
    // Avoid only: which logged slips were forgiven and which broke the
    // allowance. Computed once here because all three cards below colour by
    // it, and each recomputation would be a full re-scan of the year.
    const slipSplit = isDecreasing(goal) ? slipDatesByState(goal, todayIso, HISTORY_DAYS_BACK) : null;
    // One shared legend for both slip-coloured cards — the same two colours
    // mean the same two things in each.
    const slipLegend = slipSplit
      ? `<div class="legend"><span><i class="swatch-dot"></i>${t('goal-analytics.legend-allowed')}</span><span><i class="swatch-dot danger"></i>${t('goal-analytics.legend-over')}</span></div>`
      : '';

    return `<div class="page">
      ${this._pageHead(goal, 'goal-analytics.page-title-activity')}
      ${this._histogramCard(loggedDates, slipSplit, slipLegend, todayIso)}
      ${this._calendarCard(dates, slipSplit, todayIso)}
      ${this._weekdayGridCard(goal, loggedDates, slipSplit, slipLegend, todayIso)}
    </div>`;
  }

  // How many entries landed in each timebox. Avoid's bars count slips, and a
  // slip inside the allowance is not the same event as one past it — so its
  // bar is split rather than painted one colour. Every other type has a
  // single kind of entry and keeps a plain single-colour bar.
  _histogramCard(loggedDates, slipSplit, slipLegend, todayIso) {
    const tf = this._tfActivity;
    const n = { week: 26, month: 12, quarter: 8, year: 5 }[tf];
    const hist = resampleSumFromDates(loggedDates, tf, n, todayIso);
    const max = Math.max(1, ...hist);
    const overHist = slipSplit ? resampleSumFromDates(slipSplit.over, tf, n, todayIso) : null;
    const withinHist = slipSplit ? resampleSumFromDates(slipSplit.within, tf, n, todayIso) : null;
    const labelStep = 8;

    let bars = '', axis = '';
    hist.forEach((v, i) => {
      const indexFromEnd = n - 1 - i;
      const isMax = v === max && v > 0;
      const h = Math.max(v > 0 ? 6 : 0, (v / max) * 100);
      // flex-grow ratios inside a fixed-height stack, so the two segments
      // always divide exactly that bar's own height between them — a second
      // percentage-of-max calculation per segment would round independently
      // and leave a hairline gap or overshoot at small counts.
      const barHtml = slipSplit
        ? `<div class="bar-stack" style="height:${h}%">
            ${overHist[i] > 0 ? `<div class="bar-seg over" style="flex:${overHist[i]}"></div>` : ''}
            ${withinHist[i] > 0 ? `<div class="bar-seg within" style="flex:${withinHist[i]}"></div>` : ''}
          </div>`
        : `<div class="bar" style="height:${h}%"></div>`;
      bars += `<div class="bar-col"><div class="bar-val-slot">${isMax ? `<span class="bar-val tabular">${v}</span>` : ''}</div>
        <div class="bar-track">${barHtml}</div></div>`;
      const showLabel = i === 0 || i === n - 1 || indexFromEnd % labelStep === 0;
      axis += `<div class="ax">${showLabel ? `<span>${periodLabel(tf, indexFromEnd, todayIso)}</span>` : ''}</div>`;
    });

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.count-per-timebox')}</h3>${this._timeframeSelect('tf-activity', tf)}</div>
      <div class="histogram-scroll" id="hist-scroll" role="img" aria-label="${t(slipSplit ? 'goal-analytics.a11y-histogram-slips' : 'goal-analytics.a11y-histogram')}"><div class="histogram">${bars}</div><div class="histogram-axis">${axis}</div></div>
      ${slipLegend}
    </div>`;
  }

  // Day-by-day shading over the past year. For Avoid a shaded day can mean
  // two different things — nothing happened, or a slip that was forgiven —
  // so the forgiven ones carry the septagon's own knockout dot (see the
  // .cell.on.within rule) rather than passing as clean days.
  _calendarCard(dates, slipSplit, todayIso) {
    const weeks = Math.ceil(HISTORY_DAYS_BACK / 7);
    const dateSet = new Set(dates);
    const withinSet = slipSplit ? new Set(slipSplit.within) : null;
    let monthCells = '', gridCells = '', prevMonth = null;
    for (let c = 0; c < weeks; c++) {
      const weeksAgo = weeks - 1 - c;
      const mon = mondayOfWeek(weeksAgo, todayIso);
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
  _weekdayGridCard(goal, loggedDates, slipSplit, slipLegend, todayIso) {
    if (!isFrequency(goal) && !isDecreasing(goal)) return '';
    const months = 14;
    const rail = `<div class="weekday-rail"><span></span><span>${t('goal-dialog.dow-mon')[0]}</span><span>${t('goal-dialog.dow-tue')[0]}</span><span>${t('goal-dialog.dow-wed')[0]}</span><span>${t('goal-dialog.dow-thu')[0]}</span><span>${t('goal-dialog.dow-fri')[0]}</span><span>${t('goal-dialog.dow-sat')[0]}</span><span>${t('goal-dialog.dow-sun')[0]}</span></div>`;
    let cols = '';
    for (let mi = months - 1; mi >= 0; mi--) {
      const md = monthOnOrBefore(mi, todayIso);
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
        const size = count === 0 ? 4 : 6 + Math.min(count, 4) * 2.4;
        // Size still means volume; for Avoid, colour means kind. A cell
        // holding both forgiven and over-allowance slips splits
        // proportionally rather than picking a winner — at 8-14px a wedge
        // still reads as "some of these were fails", where an all-or-nothing
        // rule would either hide a real fail or overstate one among many
        // forgiven days.
        const overPct = count === 0 ? 0 : Math.round(overByWeekday[d] / count * 100);
        const fill = !slipSplit || count === 0 ? '' : overByWeekday[d] === 0 ? SLIP_ALLOWED_FILL
          : overByWeekday[d] === count ? 'var(--color-danger)'
          : `conic-gradient(var(--color-danger) 0 ${overPct}%, ${SLIP_ALLOWED_FILL} ${overPct}% 100%)`;
        cols += `<div class="dot-cell"><div class="freq-dot-el${count === 0 ? ' zero' : ''}" style="width:${size}px;height:${size}px;opacity:${count === 0 ? 1 : 0.45 + Math.min(count, 4) * 0.18}${fill ? `;background:${fill}` : ''}"></div></div>`;
      }
      cols += '</div>';
    }

    return `<div class="card"><div class="card-head"><h3>${t('goal-analytics.frequency-title')}</h3></div><div class="freqgrid-wrap">${rail}<div class="freqgrid-scroll" id="freq-scroll" role="img" aria-label="${t(slipSplit ? 'goal-analytics.a11y-freqgrid-slips' : 'goal-analytics.a11y-freqgrid')}"><div class="freqgrid">${cols}</div></div></div>${slipLegend}</div>`;
  }

  // ── Streaks ──────────────────────────────────────────────────────────────
  _renderStreaks(goal) {
    const todayIso = todayISO();
    const dates = dateListFor(goal, todayIso, HISTORY_DAYS_BACK);
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
