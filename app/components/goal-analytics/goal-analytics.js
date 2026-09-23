import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { todayISO } from '../../utils/today-iso.js';
import {
  isFrequency, isDecreasing, isCountdown, isoWeekKey, monthKey, PERIOD_WINDOW, weekDayStates, daysBetween,
} from '../../utils/tracking.js';
import {
  pagesFor, percentValueAt, dateListFor, rawLoggedDates, topStreaks, countByBucket,
  completionSeries, successRatioSeries, comparisonDelta, updateCount, projectPace,
} from '../../utils/goal-analytics.js';
import { septagonWedgePath, septagonWedgeState } from '../goal-item/goal-item.js';

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

// ── generic N-wedge pie (weekly's Score page: N = target) ────────────────
function wedgeGlyph(states, size) {
  const n = states.length, r = size / 2, cx = r, cy = r;
  let paths = '';
  for (let i = 0; i < n; i++) {
    const a0 = (-90 + i * 360 / n) * Math.PI / 180;
    const a1 = (-90 + (i + 1) * 360 / n) * Math.PI / 180;
    const x1 = (cx + r * Math.cos(a0)).toFixed(1), y1 = (cy + r * Math.sin(a0)).toFixed(1);
    const x2 = (cx + r * Math.cos(a1)).toFixed(1), y2 = (cy + r * Math.sin(a1)).toFixed(1);
    const fill = states[i] === 'on' ? 'var(--color-accent)' : 'var(--color-border)';
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${fill}" />`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

// Same 7-wedge geometry the goal-item row's own septagon strip uses (via the
// exported pure helpers), simplified for this smaller secondary view: no
// clock-line/today-boundary marker, no "within" knockout dot — just the
// plain accent/border fill per wedge.
function septagonGlyph(weekStates, size) {
  const paths = weekStates.map((day, i) => {
    const state = septagonWedgeState(day);
    const fill = (state === 'clean' || state === 'within') ? 'var(--color-accent)' : 'var(--color-border)';
    return `<path d="${septagonWedgePath(i)}" fill="${fill}" />`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">${paths}</svg>`;
}

function squareFillGlyph(frac, size) {
  const pct = Math.round(Math.min(Math.max(frac, 0), 1) * 100);
  return `<div style="width:${size}px;height:${size}px;border-radius:5px;background:linear-gradient(to top, var(--color-accent) 0 ${pct}%, var(--color-border) ${pct}% 100%);flex-shrink:0;"></div>`;
}

function unitFor(goal) { return isDecreasing(goal) ? 'week' : goal?.tracking?.type === 'monthly' ? 'month' : 'week'; }
function unitWord(unit, n) { return n === 1 ? t(`goal-analytics.unit-${unit}`) : t(`goal-analytics.unit-${unit}-plural`); }

class GoalAnalytics extends AppElement {
  template() {
    return `
      <style>
        :host { display: block; font-family: var(--font-family); color: var(--color-text-primary); }
        .page { display: flex; flex-direction: column; gap: calc(var(--space-5) + 3px); }
        .page-title { margin: 0; font-size: var(--font-size-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

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
        .stat-value.muted { color: var(--color-text-muted); font-weight: var(--font-weight-medium); }
        .stat-value.big-num { font-size: var(--font-size-title); }
        .stat-sub { font-size: 10px; color: var(--color-text-muted); margin-block-start: 2px; }
        .type-stack { display: flex; flex-direction: column; gap: 3px; }
        .type-stack .type-primary { font-size: var(--font-size-subheading); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
        .type-stack .type-secondary { font-size: var(--font-size-caption); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
        .section-label { font-size: var(--font-size-micro); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); margin: 0 0 var(--space-2); }
        .legend { display: flex; gap: var(--space-4); font-size: var(--font-size-micro); color: var(--color-text-secondary); margin-block-start: var(--space-2); }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        .legend .swatch-line { inline-size: 12px; block-size: 2px; border-radius: 2px; background: var(--color-accent); display: inline-block; }
        .legend .swatch-line.dashed { background: none; border-top: 1.5px dashed var(--color-text-secondary); }
        /* Deliberately never --color-accent-light/-dark/-subtle anywhere in
           this file: Telos's own blue override (index.html) only sets bare
           :root, and tokens.css's own [data-theme="dark"] block redefines
           all three back to Socle's default *orange* — --color-accent
           itself is the only one of the four that stays blue in both
           themes. Every tint/shade here is color-mix()'d from --color-accent
           and the already theme-correct surface/text tokens instead. */
        .pace-callout { display: flex; align-items: flex-start; gap: var(--space-2); background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface-raised)); border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-caption); color: var(--color-text-primary); line-height: 1.5; }
        .pace-callout svg { inline-size: 16px; block-size: 16px; flex-shrink: 0; margin-block-start: 1px; color: var(--color-accent); }

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
        .calc-cell { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
        .calc-shape-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .calc-cell.current .calc-shape-wrap { background: color-mix(in srgb, var(--color-text-primary) 12%, transparent); border-radius: var(--radius-sm); padding: 3px; margin: -3px; }
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

  _timeframeSelect(id, current) {
    const opts = ['week', 'month', 'quarter', 'year'].map(v =>
      `<option value="${v}" ${v === current ? 'selected' : ''}>${t('goal-analytics.timeframe-' + v)}</option>`).join('');
    return `<select id="${id}" aria-label="${t('goal-analytics.timeframe-label')}">${opts}</select>`;
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

  _lineChart(seriesA, seriesB) {
    const w = 268, h = 92, padTop = 8, padBottom = 4;
    const path = series => series.map((v, i) => {
      const x = series.length === 1 ? w / 2 : (i / (series.length - 1)) * w;
      const y = padTop + (1 - (v ?? 0) / 100) * (h - padTop - padBottom);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const grid = [0, 50, 100].map(v => {
      const y = padTop + (1 - v / 100) * (h - padTop - padBottom);
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="var(--color-border)" stroke-width="1" />`;
    }).join('');
    const known = seriesA.filter(v => v !== undefined);
    const lastVal = known[known.length - 1] ?? 0;
    const lastX = w, lastY = padTop + (1 - lastVal / 100) * (h - padTop - padBottom);
    const dashed = seriesB ? `<path d="${path(seriesB)}" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-dasharray="4 3" />` : '';
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="${t('goal-analytics.a11y-progress-chart')}">${grid}${dashed}
      <path d="${path(seriesA)}" fill="none" stroke="var(--color-accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastX}" cy="${lastY.toFixed(1)}" r="4" fill="var(--color-accent)" />
    </svg>`;
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  _renderOverview(goal) {
    const todayIso = todayISO();
    const current = percentValueAt(goal, todayIso) ?? 0;
    const recent = completionSeries(goal, 'month', 8, todayIso).map(p => p.value);
    const spark = this._sparkline(recent);

    const typeLabel = t(`goal-dialog.type-${goal.tracking.type}`);
    // Only weekly/monthly/decreasing/countdown have a target/allowance worth
    // summarising on a second line — percentage has no per-period target at
    // all, so it stays a single-line stack. Mirrors goal-dialog.js's own
    // type-summary key construction exactly (including decreasing's
    // allowance-period suffix) so the two never drift apart.
    const summaryKey = goal.tracking.type === 'percentage' ? null
      : `goal-dialog.type-summary-${goal.tracking.type}${goal.tracking.type === 'decreasing' ? '-' + (goal.tracking.allowancePeriod ?? 'week') : ''}`;
    const summary = summaryKey ? t(summaryKey, { target: goal.tracking.target }) : null;
    const typeStack = summary
      ? `<div class="type-stack"><span class="type-primary">${typeLabel}</span><span class="type-secondary">${summary}</span></div>`
      : `<div class="type-stack"><span class="type-primary">${typeLabel}</span></div>`;

    const count = isCountdown(goal) ? null : updateCount(goal, todayIso, HISTORY_DAYS_BACK);
    const countLabel = isDecreasing(goal) ? 'goal-analytics.stat-slips' : goal.tracking.type === 'percentage' ? 'goal-analytics.stat-updates' : 'goal-analytics.stat-entries';

    const compareRow = ['month', 'quarter', 'year'].map(unit => {
      const delta = comparisonDelta(goal, unit, todayIso);
      const label = t(`goal-analytics.vs-${unit}`);
      if (delta === null) return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value muted tabular">—</div><div class="stat-sub">${t('goal-analytics.not-enough-history')}</div></div>`;
      return `<div class="stat${delta >= 0 ? ' delta-up' : ''}"><div class="stat-label">${label}</div><div class="stat-value tabular">${delta}<span class="unit">${t('goal-analytics.pts')}</span></div></div>`;
    }).join('');

    const tf = this._tfProgress;
    const points = completionSeries(goal, tf, 12, todayIso);
    const achieved = points.map(p => p.value);
    const ratioPoints = successRatioSeries(goal, tf, 12, todayIso);
    const expected = ratioPoints.map(p => p.expected);

    const pace = projectPace(goal, todayIso);
    const paceHtml = this._renderPaceCallout(pace);

    return `<div class="page">
      <div class="hero-number"><div class="big tabular">${current}<span class="pct-unit">%</span></div>
        ${spark ? `<div class="spark-wrap">${spark}<span class="spark-label">${t('goal-analytics.last-n-periods', { n: recent.length })}</span></div>` : ''}
      </div>
      <div class="stat-row centered">
        ${typeStack ? `<div class="stat">${typeStack}</div>` : ''}
        ${count !== null ? `<div class="stat"><div class="stat-label">${t(countLabel)}</div><div class="stat-value big-num tabular">${count}</div></div>` : ''}
      </div>
      <div><p class="section-label">${t('goal-analytics.change-over-time')}</p><div class="stat-row">${compareRow}</div></div>
      <div class="card"><div class="card-head"><h3>${t('goal-analytics.progress-chart-title')}</h3>${this._timeframeSelect('tf-progress', tf)}</div>
        ${this._lineChart(achieved, expected)}
        <div class="legend"><span><i class="swatch-line"></i>${t('goal-analytics.legend-achieved')}</span><span><i class="swatch-line dashed"></i>${t('goal-analytics.legend-expected')}</span></div>
      </div>
      ${paceHtml}
    </div>`;
  }

  _renderPaceCallout(pace) {
    if (!pace) return '';
    const monthsLabel = n => n === 1 ? t('goal-analytics.month-singular') : t('goal-analytics.month-plural', { n });
    let text;
    if (pace.insufficientMomentum) text = t('goal-analytics.pace-insufficient');
    else if (pace.deadlineIso) {
      const label = monthAbbr(localDate(pace.projectedIso).getMonth()) + ' ' + localDate(pace.projectedIso).getFullYear();
      const deadlineLabel = `${monthAbbr(localDate(pace.deadlineIso).getMonth())} ${localDate(pace.deadlineIso).getDate()}, ${localDate(pace.deadlineIso).getFullYear()}`;
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
    const type = goal.tracking.type;
    const window = PERIOD_WINDOW[type];
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
    const periodDays = unit === 'month' ? 30.44 : 7;
    const extentPeriods = Math.floor(extentDays / periodDays);
    const availableContextPeriods = Math.max(0, extentPeriods - window);
    const contextGroups = Math.min(SCORE_CONTEXT_GROUPS_MAX, Math.floor(availableContextPeriods / window));
    const totalGroups = contextGroups + 1;
    const current = percentValueAt(goal, todayIso) ?? 0;
    const label = `${window} ${unitWord(unit, window)}`;

    let groupsHtml = '';
    for (let g = 0; g < totalGroups; g++) {
      const isCountedGroup = g === totalGroups - 1;
      const groupTopPeriodsAgo = (totalGroups - 1 - g) * window;
      const labelDate = unit === 'month' ? monthOnOrBefore(groupTopPeriodsAgo, todayIso) : mondayOfWeek(groupTopPeriodsAgo, todayIso);
      const groupLabel = `<div class="calc-group-label">${monthAbbr(labelDate.getMonth())}</div>`;

      let cellsHtml = '';
      for (let rIdx = 0; rIdx < window; rIdx++) {
        const periodsAgo = groupTopPeriodsAgo + rIdx;
        const isCurrent = isCountedGroup && rIdx === 0;
        const weight = isCountedGroup ? (window - rIdx) / window : 0;
        const opacity = isCountedGroup ? (0.55 + weight * 0.45) : 1;
        let shape, badge = '';

        if (isDecreasing(goal)) {
          const weekStates = weekDayStates(goal, todayIso, periodsAgo);
          shape = septagonGlyph(weekStates, 26);
        } else {
          const periodIso = toIso(unit === 'month' ? monthOnOrBefore(periodsAgo, todayIso) : mondayOfWeek(periodsAgo, todayIso));
          const keyFn = unit === 'month' ? monthKey : isoWeekKey;
          const key = keyFn(periodIso);
          const count = (goal.tracking.entries ?? []).filter(e => keyFn(e) === key).length;
          const target = goal.tracking.target || 1;
          if (type === 'weekly') {
            const filled = Math.min(count, target);
            const states = Array.from({ length: target }, (_, s) => s < filled ? 'on' : 'off');
            shape = wedgeGlyph(states, 22);
          } else {
            shape = squareFillGlyph(count / target, 22);
          }
          if (count > target) badge = `<span class="calc-badge">+${count - target}</span>`;
        }

        cellsHtml += `<div class="calc-cell${isCurrent ? ' current' : ''}" style="opacity:${opacity.toFixed(2)}">
          <div class="calc-shape-wrap">${shape}${badge}</div>
          <div class="calc-label-slot">${isCurrent ? t('goal-analytics.now') : ''}</div>
        </div>`;
      }
      groupsHtml += `<div class="calc-group${isCountedGroup ? ' counted' : ''}">${groupLabel}${cellsHtml}</div>`;
    }

    // No real context groups to show (a new-ish goal, history not yet
    // longer than the counted window itself) — rather than fabricating
    // empty-looking groups with no real data behind them (the exact thing
    // the dynamic context-group count above was built to avoid), a short
    // note fills the space where older groups will eventually appear,
    // explaining the gap instead of just leaving it silently blank.
    const olderNote = contextGroups === 0
      ? `<p class="calc-older-note">${t('goal-analytics.older-periods-note')}</p>` : '';

    return `<div class="page">
      <h2 class="page-title">${t('goal-analytics.page-title-score')}</h2>
      <div class="card">
        <div class="calc-header"><span>${t('goal-analytics.score-contribute', { label })}</span><span class="calc-header-pct tabular">${current}%</span></div>
        <div class="calc-scroll-outer" id="calc-scroll" role="img" aria-label="${t('goal-analytics.a11y-score-grid')}">${olderNote}<div class="calc-grid">${groupsHtml}</div></div>
      </div>
    </div>`;
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
    const tf = this._tfActivity;
    const countsByTf = { week: 26, month: 12, quarter: 8, year: 5 };
    const n = countsByTf[tf];
    const hist = resampleSumFromDates(loggedDates, tf, n, todayIso);
    const max = Math.max(1, ...hist);
    const labelStep = 8;

    let bars = '', axis = '';
    hist.forEach((v, i) => {
      const indexFromEnd = n - 1 - i;
      const isMax = v === max && v > 0;
      bars += `<div class="bar-col"><div class="bar-val-slot">${isMax ? `<span class="bar-val tabular">${v}</span>` : ''}</div>
        <div class="bar-track"><div class="bar" style="height:${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%"></div></div></div>`;
      const showLabel = i === 0 || i === n - 1 || indexFromEnd % labelStep === 0;
      axis += `<div class="ax">${showLabel ? `<span>${periodLabel(tf, indexFromEnd, todayIso)}</span>` : ''}</div>`;
    });

    const weeks = Math.ceil(HISTORY_DAYS_BACK / 7);
    const dateSet = new Set(dates);
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
        gridCells += `<div class="cell${on ? ' on' : ''}"></div>`;
      }
    }

    let freqHtml = '';
    if (isFrequency(goal) || isDecreasing(goal)) {
      const months = 14;
      const rail = `<div class="weekday-rail"><span></span><span>${t('goal-dialog.dow-mon')[0]}</span><span>${t('goal-dialog.dow-tue')[0]}</span><span>${t('goal-dialog.dow-wed')[0]}</span><span>${t('goal-dialog.dow-thu')[0]}</span><span>${t('goal-dialog.dow-fri')[0]}</span><span>${t('goal-dialog.dow-sat')[0]}</span><span>${t('goal-dialog.dow-sun')[0]}</span></div>`;
      let cols = '';
      for (let mi = months - 1; mi >= 0; mi--) {
        const md = monthOnOrBefore(mi, todayIso);
        cols += `<div class="month-col"><span class="month-label">${monthAbbr(md.getMonth())}</span>`;
        const byWeekday = [0, 0, 0, 0, 0, 0, 0];
        for (const iso of loggedDates) {
          const d = localDate(iso);
          if (d.getFullYear() === md.getFullYear() && d.getMonth() === md.getMonth()) byWeekday[(d.getDay() + 6) % 7]++;
        }
        for (let d = 0; d < 7; d++) {
          const count = byWeekday[d];
          const size = count === 0 ? 4 : 6 + Math.min(count, 4) * 2.4;
          cols += `<div class="dot-cell"><div class="freq-dot-el${count === 0 ? ' zero' : ''}" style="width:${size}px;height:${size}px;opacity:${count === 0 ? 1 : 0.45 + Math.min(count, 4) * 0.18}"></div></div>`;
        }
        cols += '</div>';
      }
      freqHtml = `<div class="card"><div class="card-head"><h3>${t('goal-analytics.frequency-title')}</h3></div><div class="freqgrid-wrap">${rail}<div class="freqgrid-scroll" id="freq-scroll" role="img" aria-label="${t('goal-analytics.a11y-freqgrid')}"><div class="freqgrid">${cols}</div></div></div></div>`;
    }

    return `<div class="page">
      <h2 class="page-title">${t('goal-analytics.page-title-activity')}</h2>
      <div class="card"><div class="card-head"><h3>${t('goal-analytics.count-per-timebox')}</h3>${this._timeframeSelect('tf-activity', tf)}</div>
        <div class="histogram-scroll" id="hist-scroll" role="img" aria-label="${t('goal-analytics.a11y-histogram')}"><div class="histogram">${bars}</div><div class="histogram-axis">${axis}</div></div>
      </div>
      <div class="card"><div class="card-head"><h3>${t('goal-analytics.calendar-title')}</h3></div>
        <div class="heatmap-outer">
        <div class="heatmap-daylabels"><div class="spacer"></div><div class="daylabel-grid"><span>${t('goal-dialog.dow-mon')[0]}</span><span></span><span></span><span>${t('goal-dialog.dow-thu')[0]}</span><span></span><span></span><span>${t('goal-dialog.dow-sun')[0]}</span></div></div>
        <div class="heatmap-scroll" id="cal-scroll" role="img" aria-label="${t('goal-analytics.a11y-calendar')}"><div class="heatmap-inner">
          <div class="heatmap-monthrow">${monthCells}</div><div class="heatmap">${gridCells}</div>
        </div></div>
        </div>
      </div>
      ${freqHtml}
    </div>`;
  }

  // ── Streaks ──────────────────────────────────────────────────────────────
  _renderStreaks(goal) {
    const todayIso = todayISO();
    const dates = dateListFor(goal, todayIso, HISTORY_DAYS_BACK);
    const streaks = topStreaks(dates, 10);
    const title = `<h2 class="page-title">${t('goal-analytics.page-title-streaks')}</h2>`;
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
