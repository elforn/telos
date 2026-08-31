import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { tagStrip } from '../../utils/tag-color.js';
import { urgencyOf } from '../../utils/urgency.js';
import { urgencyBadgeMarkup, urgencyBadgeStyles } from '../../utils/urgency-badge.js';
import { markDelete } from '../../utils/delete-ghost-guard.js';
import {
  percentValue, isFrequency, isEntryBased, isDecreasing, recentDots, recentWeekStates,
  isLoggedOn, currentPeriodCount,
} from '../../utils/tracking.js';

const REVEAL_WIDTH = 60;
const COLOR_WIDTH = 48;    // left-side colour panel, revealed by swiping right — mirrors lists-page-item
const COMMIT_RATIO = 2.0;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
const SWIPE_DEAD_ZONE = 15;   // px of drag before bar starts moving

// Frequency "today" token geometry — a 40px tap-target box (== --touch-target,
// unchanged, so alignment across goal types stays exact) holding a 27px dot
// (90% of the original 30px, exact-pixel not a CSS scale transform) with a
// gap to the ring around it. Weekly renders the ring/dot as a true circle
// (rx = half the box); monthly as a soft square — shape is the only thing
// on the row that says which unit you're looking at.
const TODAY_BOX = 40;
const TODAY_RING_SIZE = 31;   // the <rect>'s width/height, inset within TODAY_BOX — same dot+4 gap as before, just at the smaller scale
const TODAY_RING_INSET = (TODAY_BOX - TODAY_RING_SIZE) / 2;
const TODAY_RING_RX = { weekly: TODAY_RING_SIZE / 2, monthly: 7 }; // monthly's corner radius scaled down with it (was 8 at the old 34px ring)

const SVG_NS = 'http://www.w3.org/2000/svg';

// Decreasing goals' "septagon" strip — 7-wedge heptagons, one per scored
// week, oldest → current. Regular 7-gon, vertex 0 at 12 o'clock, clockwise.
// Each wedge is drawn as its own SVG <path>: the triangle from the
// septagon's center to two adjacent vertices. The 7 triangles tile the
// heptagon exactly (no seams, no outer clip needed — whatever's outside the
// polygon, i.e. the square viewBox's corners, is simply never drawn).
//
// State is encoded without a second hue, same principle as the opacity
// scheme this originally shipped with, but readable at 13px where opacity
// steps weren't (round-tripped through a real device twice: 60%-vs-20%
// opacity was too close to call at a glance, and a diagonal hatch fill
// tried next didn't read as textured at this size either — confirmed via
// side-by-side comparison with the product owner). `clean` and `within`
// both get a full, solid accent-colour wedge — `within` additionally gets
// a small knockout dot (punched through to the row's own background)
// marking "this one used the allowance but stayed free"; `over` drops the
// fill entirely — knocked out like the dot, with just an accent stroke
// outline — reading as "drained/empty" the way an unchecked box reads
// unchecked, distinct at a glance from both the solid states and the fully
// transparent one. `future` (a day in the current week that hasn't
// happened yet) stays fully transparent, no stroke at all.
const SEPTAGON_SIDES = 7;
const SEPTAGON_STEP = 360 / SEPTAGON_SIDES;
// Internal SVG coordinate space — deliberately decoupled from the element's
// real rendered size (13px history, 29px current), which CSS controls via
// width/height on the <svg class="septagon-fill">.
const SEPTAGON_VB = 100;
const SEPTAGON_CENTER = SEPTAGON_VB / 2;
const SEPTAGON_VERTICES = Array.from({ length: SEPTAGON_SIDES }, (_, i) => {
  const a = (-90 + i * SEPTAGON_STEP) * Math.PI / 180;
  return [SEPTAGON_CENTER + SEPTAGON_CENTER * Math.cos(a), SEPTAGON_CENTER + SEPTAGON_CENTER * Math.sin(a)];
});
// Exported alongside the rest of this geometry purely so unit tests can
// assert on it directly (pure functions, no DOM) — mirrors why
// septagonGradient used to be exported here before this rewrite.
export function septagonWedgePath(i) {
  const [x0, y0] = SEPTAGON_VERTICES[i];
  const [x1, y1] = SEPTAGON_VERTICES[(i + 1) % SEPTAGON_SIDES];
  return `M${SEPTAGON_CENTER},${SEPTAGON_CENTER} L${x0.toFixed(3)},${y0.toFixed(3)} L${x1.toFixed(3)},${y1.toFixed(3)} Z`;
}
// Centroid of wedge i (mean of its 3 corners) — where the "within" knockout
// dot is centered.
export function septagonWedgeCentroid(i) {
  const [x0, y0] = SEPTAGON_VERTICES[i];
  const [x1, y1] = SEPTAGON_VERTICES[(i + 1) % SEPTAGON_SIDES];
  return [(SEPTAGON_CENTER + x0 + x1) / 3, (SEPTAGON_CENTER + y0 + y1) / 3];
}
const SEPTAGON_WITHIN_DOT_RADIUS = 6; // viewBox units (of 100)

// `future` always wins over whatever `state` a not-yet-elapsed day
// nominally carries (see weekDayStates in tracking.js).
export function septagonWedgeState(day) { return day.future ? 'future' : day.state; }

// Exact pixel match to freq-dot's history size (13) — literal, not
// perceptually-compensated.
const SEPTAGON_HISTORY_SIZE = 13;
// A couple px bigger than freq-today's dot (now 27px) — same relationship
// as before, just following the dot's own 90%-of-original shrink down to
// exact pixels.
const SEPTAGON_CURRENT_SIZE = 29;
const SEPTAGON_RING_SIZE = 33; // same +4 gap to the fill as before, at the smaller scale
const SEPTAGON_RING_POINTS = Array.from({ length: SEPTAGON_SIDES }, (_, i) => {
  const a = (-90 + i * SEPTAGON_STEP) * Math.PI / 180;
  const c = TODAY_BOX / 2, r = SEPTAGON_RING_SIZE / 2;
  return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

class GoalItem extends Gestures(AppElement) {
  set goal(value) {
    this._goal = value;
    if (this.shadowRoot) this._update();
  }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
        }

        .action-btn {
          position: absolute;
          inset-block: 0;
          inline-size: ${REVEAL_WIDTH}px;
          color: var(--color-text-inverse);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          font-family: var(--font-family);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-btn svg { pointer-events: none; }

        .delete-btn {
          inset-inline-end: 0;
          background: var(--color-danger);
        }

        /* ── Colour panel — left side, revealed by swiping right ─────────
           Mirrors lists-page-item's own .color-panel/swipe exactly: a
           momentary reveal that always snaps back (see onSwipe below), not
           a persisted state like the delete panel's left-swipe. */
        .color-panel {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          inline-size: ${COLOR_WIDTH}px;
          background: var(--color-panel-bg, var(--color-surface-raised));
        }

        .bar {
          position: relative;
          z-index: 1;
          block-size: var(--goal-item-height, 44px);
          background: var(--color-surface);
          border: 0.5px solid var(--color-border);
          border-inline-start: 3px solid var(--goal-item-color, transparent);
          overflow: hidden;
          display: flex;
          align-items: center;
          padding-inline-start: calc(var(--space-3) - 3px + 0.5px);
          padding-inline-end: var(--space-3);
          cursor: pointer;
          user-select: none;
          touch-action: pan-y;
          transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
        }

        .fill {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          background: color-mix(in srgb, var(--color-accent) 25%, transparent);
          transition: width 0.1s ease;
          pointer-events: none;
        }

        /* ── Overdue escalation — full-row red once a dueDate has lapsed ──
           :host([data-urgency="overdue"]) is set in _update() below, from
           the same urgencyOf() call the calendar badge already reads.
           Filled portion goes solid --color-danger (the same token/pairing
           the badge above already proves correct in both themes); the
           unfilled track becomes --color-danger-track (see index.html —
           theme-aware so text stays legible on it in both modes) instead of
           the plain accent-tinted fill/surface pairing every other state uses. */
        :host([data-urgency="overdue"]) .bar { background: var(--color-danger-track); }
        :host([data-urgency="overdue"]) .fill { background: var(--color-danger); }
        :host([data-urgency="overdue"]) .title,
        :host([data-urgency="overdue"]) .pct-label { color: var(--color-text-inverse); }
        :host([data-urgency="overdue"]) .desc-icon { color: var(--color-text-inverse); opacity: 0.7; }
        :host([data-urgency="overdue"]) .drag-btn { color: var(--color-text-inverse); }

        /* Frequency dot-strip and the decreasing/"Avoid" septagon strip both
           key their history off --color-accent/--color-border normally —
           neither reads legibly against a solid danger-red row, so overdue
           re-themes them onto --color-text-inverse instead. Applies whenever
           the goal itself is overdue by dueDate; Part 5's scheduled-day-miss
           trigger for frequency goals sets the same data-urgency attribute,
           so no separate rule is needed for that case. */
        :host([data-urgency="overdue"]) .freq-dot {
          background: color-mix(in srgb, var(--color-text-inverse) 35%, transparent);
        }
        :host([data-urgency="overdue"]) .freq-dot.met { background: var(--color-text-inverse); }
        :host([data-urgency="overdue"]) .freq-dot.partial {
          background: conic-gradient(var(--color-text-inverse) var(--frac, 50%), color-mix(in srgb, var(--color-text-inverse) 35%, transparent) 0);
        }
        :host([data-urgency="overdue"]) .septagon-fill path[data-state="clean"],
        :host([data-urgency="overdue"]) .septagon-fill path[data-state="within"] {
          fill: var(--color-text-inverse);
        }
        :host([data-urgency="overdue"]) .septagon-fill path[data-state="clean"],
        :host([data-urgency="overdue"]) .septagon-fill path[data-state="within"],
        :host([data-urgency="overdue"]) .septagon-fill path[data-state="over"] {
          stroke: var(--color-text-inverse);
        }
        :host([data-urgency="overdue"]) .septagon-within-dot { fill: var(--color-danger-track); }

        .content {
          position: relative;
          z-index: 1;
          flex: 1;
          min-inline-size: 0;
          overflow: hidden;
        }

        .title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tag-strip {
          position: absolute;
          inset-block-end: 0;
          inset-inline-start: var(--space-10);
          inset-inline-end: var(--space-4);
          block-size: 3px;
          pointer-events: none;
          z-index: 2;
          display: var(--tag-strip-display, block);
        }

        .desc-icon {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: none;
          line-height: 1;
          margin-inline-start: var(--space-1);
        }

        .desc-icon svg {
          display: block;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }

        .bar[data-has-desc="true"] .desc-icon { display: block; }

        /* Deadline calendar — shared with list-item's due-date badge, see
           app/utils/urgency-badge.js. Gated by --goal-deadline-display so the
           year menu can hide it for non-current years (default on for the
           current year — set by year-header); list-item's due-date badge is
           never gated this way. */
        .urgency-icon { margin-inline-start: var(--space-1); }
        ${urgencyBadgeStyles('var(--goal-deadline-display, block)')}

        /* ── Frequency goals: dot-strip + today token ────────────────────
           Replaces the pct-label's slot — hold-drag scrub has no meaning
           here, so that space becomes a read-only glance strip instead. */

        .freq-cluster {
          position: relative;
          z-index: 1;
          display: none;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          margin-inline-start: var(--space-2);
        }

        .bar[data-freq="true"] .freq-cluster { display: flex; }
        .bar[data-freq="true"] .pct-label { display: none; }

        /* Bare <span>, so it defaults to display:inline — width/height (and
           their logical equivalents) are spec-ignored on inline, non-replaced
           boxes. Without this, every history dot renders at zero effective
           size: invisible, not just "hard to see". (.freq-today's children
           escape the same trap only because grid/flex children get
           auto-blockified regardless of their own declared display.) */
        .freq-dots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .freq-dot {
          inline-size: 13px;
          block-size: 13px;
          border-radius: var(--radius-full);
          background: var(--color-border);
          flex-shrink: 0;
        }
        .freq-dot.met { background: var(--color-accent); }
        .freq-dot.partial {
          background: conic-gradient(var(--color-accent) var(--frac, 50%), var(--color-border) 0);
        }
        .bar[data-freq-type="monthly"] .freq-dot { border-radius: 5px; }

        .freq-today {
          position: relative;
          inline-size: ${TODAY_BOX}px;
          block-size: ${TODAY_BOX}px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
        }

        .freq-today .freq-dot {
          inline-size: 27px;
          block-size: 27px;
        }
        .bar[data-freq-type="monthly"] .freq-today .freq-dot {
          /* Same size as weekly's dot — border-radius is the only thing
             that should differ between the two shapes. */
          border-radius: 6px;
        }

        /* The goal's target (e.g. "3" for 3x/week) rendered inside the
           today-token dot — a static number, not a count, so it doesn't need
           its own re-render trigger beyond the goal's own tracking.target.
           Absolutely positioned over the dot (same technique as .freq-ring)
           rather than a grid child, since .freq-today's implicit grid would
           otherwise place it in its own column instead of stacking it.
           mix-blend-mode: difference (not a fixed/state-keyed colour) is
           the only approach that stays legible in every case here: the
           dot's fill is a conic-gradient split between --color-accent and
           --color-border for 'partial' (the split point moves with the
           fraction, so a fixed colour picked for "mostly accent" fails once
           the wedge is mostly border, and vice versa), and --color-accent
           itself is a user-customisable per-year hex with no guaranteed
           lightness. White XOR'd against any of those always resolves to a
           contrasting colour per-pixel — confirmed against the 'partial'
           gradient specifically (see CHANGELOG), where a fixed
           --color-text-inverse fill went invisible over the >50%-border
           portion of the wedge. */
        .freq-target-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-bold);
          font-variant-numeric: tabular-nums;
          color: #FFFFFF;
          mix-blend-mode: difference;
          pointer-events: none;
        }

        /* Plain complete stroke, no sweep animation — the 500ms hold is
           confirmed all at once (a single setTimeout in the gestures mixin,
           no intermediate progress callback), so there's nothing to animate
           mid-hold; the ring just appears once logged. */
        .freq-ring {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .freq-today.logged .freq-ring { opacity: 1; }
        .freq-ring .progress { fill: none; stroke: var(--color-success); stroke-width: 2; }

        /* Small tick — every successful log. Same recipe as list-item's own
           done-celebrate (outline pulse + background wash), just retargeted
           at this component's .bar instead of a shared .row class. Reserved
           for the ROUTINE action; the big particle-burst .celebrating above
           stays for the rare "whole window met" moment (percentValue hits
           100 only when every period in the window is fully met — same
           crossing check as the percentage case, no separate detection). */
        @keyframes log-ring {
          0%   { outline-color: transparent; }
          30%  { outline-color: color-mix(in srgb, var(--color-accent) 60%, transparent); }
          100% { outline-color: transparent; }
        }
        @keyframes log-wash {
          0%   { background: var(--color-surface); }
          25%  { background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)); }
          100% { background: var(--color-surface); }
        }
        :host(.log-tick) .bar {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: log-ring 500ms ease-out, log-wash 500ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.log-tick) .bar { animation: none; outline: none; }
        }

        /* Toggled externally (home-page.js) after scrollIntoView, when this
           row is the destination of an Upcoming-dialog row tap — a longer,
           gentler pulse than .log-tick's since this marks "you were brought
           here", not a routine action's confirmation. */
        @keyframes nav-flash-ring {
          0%   { outline-color: transparent; }
          25%  { outline-color: color-mix(in srgb, var(--color-accent) 70%, transparent); }
          100% { outline-color: transparent; }
        }
        :host(.nav-flash) .bar {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: nav-flash-ring 900ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.nav-flash) .bar { animation: none; outline: none; }
        }

        .pct-label {
          position: relative;
          z-index: 1;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-accent);
          flex-shrink: 0;
          margin-inline-start: var(--space-2);
        }

        /* ── Decreasing ("Avoid") goals: septagon history strip ───────────
           Six 7-wedge heptagons, oldest → current, replacing the frequency
           dot-cluster entirely for this type — pct-label stays hidden, same
           as frequency types, since the strip itself carries the score. The
           bar/fill deliberately get NO color override here — it keeps the
           same accent styling every other type's .fill uses; each wedge is
           an SVG <path> whose fill/pattern is driven by [data-state] below
           (see the geometry/state comment above SEPTAGON_SIDES) — never a
           second hue, collision-proof against any accent choice. */

        .septagon-strip {
          position: relative;
          z-index: 1;
          display: none;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          margin-inline-start: var(--space-2);
        }

        .bar[data-type="decreasing"] .septagon-strip { display: flex; }
        .bar[data-type="decreasing"] .freq-cluster { display: none; }

        /* History weeks: a plain filled heptagon, no border/rim at all —
           matches freq-dot exactly (a flat colored circle/squircle with
           no ring of its own; only the "today" token ever gets a ring). */
        .septagon-week {
          position: relative;
          flex-shrink: 0;
          inline-size: ${SEPTAGON_HISTORY_SIZE}px;
          block-size: ${SEPTAGON_HISTORY_SIZE}px;
        }

        /* No clip-path needed: the 7 wedge <path>s already tile exactly to
           the heptagon outline, so nothing is ever drawn outside it. */
        .septagon-fill {
          position: absolute;
          inset: 0;
        }

        /* Every wedge except "future" gets the same hairline accent border
           — including "clean" and "within", where it sits right on top of
           the matching accent fill and is invisible on its own. Without it,
           an "over" wedge's border (see below) reads as an odd one-sided
           seam against a borderless "clean"/"within" neighbour; with it,
           every wedge boundary in the strip looks consistent regardless of
           the mix of states next to it. vector-effect keeps the border a
           constant on-screen width regardless of which of the two real
           sizes (13px history, 29px current) this particular SVG renders
           at — without it, the same stroke-width value would render
           visibly thinner at 13px than at 29px, since both are the same
           100-unit viewBox scaled by CSS to very different pixel sizes. */
        .septagon-fill path[data-state="clean"],
        .septagon-fill path[data-state="within"],
        .septagon-fill path[data-state="over"] {
          stroke: var(--color-accent);
          stroke-width: 0.5px;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
        }
        .septagon-fill path[data-state="clean"],
        .septagon-fill path[data-state="within"] {
          fill: var(--color-accent);
        }
        .septagon-fill path[data-state="future"] { fill: transparent; }

        /* "Over": the fill drops out entirely (knocked out like the within
           dot below), leaving just the accent border above — reads as
           "drained/empty" at a glance, distinct from both the solid states
           and the fully transparent "future" one (which gets no border at
           all — there's nothing there to outline). */
        .septagon-fill path[data-state="over"] {
          fill: var(--color-surface);
        }

        /* Knockout dot marking a forgiven (within-allowance) slip — punched
           through to the row's own background rather than a second hue, so
           it reads correctly in both themes and against any accent choice. */
        .septagon-within-dot { fill: var(--color-surface); }

        /* A genuine ${TODAY_BOX}px box, exactly like .freq-today — not a
           smaller box with an invisible hit-area hack — so the current
           week's tap target lands at the identical offset from the row's
           right edge as every other type's "today" token, regardless of
           which type a given row is. */
        .septagon-week.current {
          inline-size: ${TODAY_BOX}px;
          block-size: ${TODAY_BOX}px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .septagon-week.current .septagon-fill {
          position: static;
          grid-area: 1 / 1; /* stack fill + ring SVG in the same cell */
          inset: auto;
          inline-size: ${SEPTAGON_CURRENT_SIZE}px;
          block-size: ${SEPTAGON_CURRENT_SIZE}px;
        }

        /* A real stroke-only ring, same technique as .freq-ring (an SVG
           shape, not a background peeking through a smaller inset) — a
           genuinely separated outline with its own ${(SEPTAGON_RING_SIZE - SEPTAGON_CURRENT_SIZE) / 2}px gap to the fill, matching
           weekly/monthly's actual ring/dot relationship instead of
           approximating it with layered backgrounds. Visible specifically
           when today has a recorded slip — the same role .freq-today.logged
           plays for weekly/monthly. */
        .septagon-ring {
          grid-area: 1 / 1;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .septagon-week.current.logged .septagon-ring { opacity: 1; }
        .septagon-ring .progress { fill: none; stroke: var(--color-danger); stroke-width: 2; }

        .drag-btn {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          background: none;
          border: none;
          cursor: grab;
          color: var(--color-text-muted);
          opacity: 0.45;
          font-size: var(--font-size-body);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: 0;
          padding-inline: 0 2px;
          margin-inline-start: -5px;
          font-family: var(--font-family);
          touch-action: none;
        }

        :host(.hold-active) .bar {
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        .archive-dot {
          display: none;
          position: absolute;
          inset-block-start: 50%;
          transform: translateY(-50%);
          inset-inline-start: calc(var(--space-1) * 1.3);
          inline-size: var(--space-1);
          block-size: var(--space-1);
          border-radius: var(--radius-full);
          background: var(--color-accent);
          z-index: 0;
          opacity: 0.2;
          pointer-events: none;
          user-select: none;
        }

        :host([data-archived="true"]) .archive-dot {
          display: block;
        }


        @keyframes fill-celebrate {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        .fill.celebrate {
          background: linear-gradient(
            to right,
            var(--color-accent) 25%,
            var(--color-accent-light, color-mix(in srgb, var(--color-accent) 60%, var(--color-text-inverse))) 50%,
            var(--color-accent) 75%
          );
          background-size: 300% 100%;
          animation: fill-celebrate var(--duration-slow, 600ms) ease-out forwards;
        }

        @keyframes goal-ring {
          0%   { box-shadow: 0 0 0 0    color-mix(in srgb, var(--color-accent) 80%, transparent); }
          20%  { box-shadow: 0 0 0 8px  color-mix(in srgb, var(--color-accent) 45%, transparent); }
          100% { box-shadow: 0 0 0 60px transparent; }
        }

        :host(.celebrating) {
          overflow: visible;
          animation: goal-ring 700ms ease-out forwards;
        }

        /* ── Particle bursts ─────────────────────────────────────────────────── */

        :host(.celebrating)::before,
        :host(.celebrating)::after {
          content: '';
          position: absolute;
          width: 0;
          height: 0;
          top: 50%;
          left: 50%;
          pointer-events: none;
          z-index: 10;
        }

        :host(.celebrating)::before {
          animation: burst-1 1500ms ease-out forwards;
          transform: rotate(var(--b1-rot, 0deg)) scale(var(--b-scale, 1));
          border-radius: var(--b1-radius, 50%);
        }

        :host(.celebrating)::after {
          animation: burst-2 1500ms var(--b2-delay, 120ms) ease-out forwards;
          transform: rotate(var(--b2-rot, 0deg)) scale(var(--b-scale, 1));
          border-radius: var(--b2-radius, 50%);
        }

        @keyframes burst-1 {
          0% {
            opacity: 1;
            box-shadow:
              -175px 0px 0 5px #FFFFFF,
              -142px 0px 0 5px var(--color-accent),
              -110px 0px 0 5px var(--color-accent-dark),
               -77px 0px 0 5px #FFFFFF,
               -44px 0px 0 5px var(--color-accent),
               -11px 0px 0 5px var(--color-accent-dark),
                21px 0px 0 5px #FFFFFF,
                54px 0px 0 5px var(--color-accent),
                87px 0px 0 5px var(--color-accent-dark),
               120px 0px 0 5px #FFFFFF,
               152px 0px 0 5px var(--color-accent),
               185px 0px 0 5px var(--color-accent-dark);
          }
          60% {
            opacity: 0.85;
            box-shadow:
              -175px -50px 0 4px #FFFFFF,
              -142px -68px 0 4px var(--color-accent),
              -110px -57px 0 4px var(--color-accent-dark),
               -77px -75px 0 4px #FFFFFF,
               -44px -63px 0 4px var(--color-accent),
               -11px -51px 0 4px var(--color-accent-dark),
                21px -70px 0 4px #FFFFFF,
                54px -58px 0 4px var(--color-accent),
                87px -76px 0 4px var(--color-accent-dark),
               120px -64px 0 4px #FFFFFF,
               152px -53px 0 4px var(--color-accent),
               185px -71px 0 4px var(--color-accent-dark);
          }
          100% {
            opacity: 0;
            box-shadow:
              -175px  -78px 0 2px #FFFFFF,
              -142px -102px 0 2px var(--color-accent),
              -110px  -87px 0 2px var(--color-accent-dark),
               -77px -111px 0 2px #FFFFFF,
               -44px  -95px 0 2px var(--color-accent),
               -11px  -80px 0 2px var(--color-accent-dark),
                21px -104px 0 2px #FFFFFF,
                54px  -88px 0 2px var(--color-accent),
                87px -113px 0 2px var(--color-accent-dark),
               120px  -97px 0 2px #FFFFFF,
               152px  -81px 0 2px var(--color-accent),
               185px -106px 0 2px var(--color-accent-dark);
          }
        }

        @keyframes burst-2 {
          0% {
            opacity: 1;
            box-shadow:
              -155px 0px 0 5px var(--color-accent),
              -126px 0px 0 5px #FFFFFF,
               -97px 0px 0 5px var(--color-accent-dark),
               -68px 0px 0 5px var(--color-accent),
               -39px 0px 0 5px #FFFFFF,
               -10px 0px 0 5px var(--color-accent-dark),
                20px 0px 0 5px var(--color-accent),
                49px 0px 0 5px #FFFFFF,
                78px 0px 0 5px var(--color-accent-dark),
               107px 0px 0 5px var(--color-accent),
               136px 0px 0 5px #FFFFFF,
               165px 0px 0 5px var(--color-accent-dark);
          }
          60% {
            opacity: 0.85;
            box-shadow:
              -155px -57px 0 4px var(--color-accent),
              -126px -75px 0 4px #FFFFFF,
               -97px -63px 0 4px var(--color-accent-dark),
               -68px -51px 0 4px var(--color-accent),
               -39px -70px 0 4px #FFFFFF,
               -10px -58px 0 4px var(--color-accent-dark),
                20px -76px 0 4px var(--color-accent),
                49px -64px 0 4px #FFFFFF,
                78px -53px 0 4px var(--color-accent-dark),
               107px -71px 0 4px var(--color-accent),
               136px -59px 0 4px #FFFFFF,
               165px -77px 0 4px var(--color-accent-dark);
          }
          100% {
            opacity: 0;
            box-shadow:
              -155px  -87px 0 2px var(--color-accent),
              -126px -111px 0 2px #FFFFFF,
               -97px  -95px 0 2px var(--color-accent-dark),
               -68px  -80px 0 2px var(--color-accent),
               -39px -104px 0 2px #FFFFFF,
               -10px  -88px 0 2px var(--color-accent-dark),
                20px -113px 0 2px var(--color-accent),
                49px  -97px 0 2px #FFFFFF,
                78px  -81px 0 2px var(--color-accent-dark),
               107px -106px 0 2px var(--color-accent),
               136px  -90px 0 2px #FFFFFF,
               165px -115px 0 2px var(--color-accent-dark);
          }
        }

        @keyframes peek-hint {
          0%   { transform: translateX(0); }
          30%  { transform: translateX(-18px); }
          70%  { transform: translateX(0); }
          100% { transform: translateX(0); }
        }

        :host(.peek-hint) .bar {
          animation: peek-hint 600ms var(--peek-delay, 0ms) cubic-bezier(0.32, 0.72, 0, 1) both;
        }

        @keyframes pop-confirm {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.09); }
          100% { transform: scale(1); }
        }

        :host(.pop-confirm) {
          overflow: visible;
          animation: pop-confirm 280ms var(--pop-delay, 0ms) cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .fill.celebrate { animation: none; }
          :host(.celebrating) { animation: none; }
          :host(.celebrating)::before { animation: none; }
          :host(.celebrating)::after  { animation: none; }
          :host(.peek-hint) .bar { animation: none; }
          :host(.pop-confirm) { animation: none; }
        }
      </style>

      <div class="color-panel" id="color-panel" aria-hidden="true"></div>
      <button class="action-btn delete-btn" id="delete-btn" aria-label="${t('goal-item.delete')}">${icons.trash}</button>
      <div class="bar"
           tabindex="0"
           role="slider"
           aria-label=""
           aria-valuemin="0"
           aria-valuemax="100"
           aria-valuenow="0">
        <div class="fill" style="width:0%"></div>
        <span class="archive-dot" aria-hidden="true"></span>
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <span class="content">
          <span class="title"></span>
        </span>
        <span class="tag-strip" aria-hidden="true"></span>
        <span class="desc-icon" aria-hidden="true">${icons.info}</span>
        ${urgencyBadgeMarkup}
        <span class="pct-label" hidden></span>
        <span class="septagon-strip" aria-hidden="true"></span>
        <span class="freq-cluster" aria-hidden="true">
          <span class="freq-dots"></span>
          <span class="freq-today">
            <span class="freq-dot"></span>
            <span class="freq-target-num" aria-hidden="true"></span>
            <svg class="freq-ring" viewBox="0 0 ${TODAY_BOX} ${TODAY_BOX}" width="${TODAY_BOX}" height="${TODAY_BOX}">
              <rect class="progress" x="${TODAY_RING_INSET}" y="${TODAY_RING_INSET}" width="${TODAY_RING_SIZE}" height="${TODAY_RING_SIZE}" rx="${TODAY_RING_SIZE / 2}"></rect>
            </svg>
          </span>
        </span>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._bar = this.shadowRoot.querySelector('.bar');
    this._fill = this.shadowRoot.querySelector('.fill');
    this._title = this.shadowRoot.querySelector('.title');
    this._stripEl = this.shadowRoot.querySelector('.tag-strip');
    this._pctLabel = this.shadowRoot.querySelector('.pct-label');
    this._septagonStrip = this.shadowRoot.querySelector('.septagon-strip');
    this._freqDots = this.shadowRoot.querySelector('.freq-dots');
    this._freqToday = this.shadowRoot.querySelector('.freq-today');
    this._freqTodayDot = this._freqToday.querySelector('.freq-dot');
    this._freqTargetNum = this._freqToday.querySelector('.freq-target-num');
    this._freqRing = this.shadowRoot.querySelector('.freq-ring .progress');
    this._colorPanel = this.shadowRoot.querySelector('#color-panel');
    this._revealedDir = null;
    this._wasLoggedToday = undefined; // undefined (not false) so the first _update() never ticks — mirrors _celebrate()'s prevPct guard below

    this._update();

    // Captured at pointerdown time, in the capture phase (so it runs before the
    // Gestures mixin's own bubble-phase pointerdown listener on this same host).
    // Event.composedPath() is only valid while the event is still dispatching —
    // by the time onTap() runs (on pointerup, after the mixin resolves the whole
    // gesture), the pointerdown event's dispatch is long finished and
    // composedPath() would silently return []. Reading it live here and stashing
    // a plain boolean is what makes the check usable later.
    this._onPointerDownCapture = e => {
      const path = e.composedPath();
      // The septagon strip is rebuilt (replaceChildren) on every render, so
      // its current-week node can't be cached at subscribe time like
      // _freqToday — queried fresh here instead, while the event is still
      // dispatching and composedPath() is valid.
      const septagonCurrent = this._septagonStrip.querySelector('.septagon-week.current');
      this._tapOnToday = path.includes(this._freqToday) || (septagonCurrent && path.includes(septagonCurrent));
    };
    this.addEventListener('pointerdown', this._onPointerDownCapture, true);

    this._stopPointerDown = e => e.stopPropagation();

    this._deleteEl = this.shadowRoot.querySelector('#delete-btn');

    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      const fire = () => {
        this.dispatchEvent(new CustomEvent('goal-delete', {
          bubbles: true, composed: true, detail: { goal: this._goal },
        }));
        this._closeReveal();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    // Delete fires on pointerup; note the time so the add row (which shifts up
    // when the last goal is removed) can ignore the touch's synthesized click.
    this._onDeletePointerUp = e => { e.stopPropagation(); e.preventDefault(); markDelete(); this._onDeleteBtn(true); };
    this._onDeleteBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDeleteBtn(); };
    this._deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl.addEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl.addEventListener('click', this._onDeleteBtnKey);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); }
      if (e.key === 'ArrowRight') this.onHoldDragKey('right');
      if (e.key === 'ArrowLeft') this.onHoldDragKey('left');
    };
    this._bar.addEventListener('keydown', this._onKeyDown);

    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('goal-item.drag'));
    this._dragBtn.innerHTML = icons.grip;
    this._onDragBtnDown = e => {
      e.stopPropagation();
      this._dragBtn.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('goal-drag-start', {
        bubbles: true, composed: true,
        detail: { goal: this._goal, element: this, startX: e.clientX, startY: e.clientY },
      }));
    };
    this._onDragBtnKey = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('goal-reorder-key', {
        bubbles: true, composed: true,
        detail: { goal: this._goal, direction: e.key === 'ArrowUp' ? -1 : 1 },
      }));
    };
    this._dragBtn.addEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn.addEventListener('keydown', this._onDragBtnKey);
  }

  unsubscribe() {
    this.removeEventListener('pointerdown', this._onPointerDownCapture, true);
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._bar?.removeEventListener('keydown', this._onKeyDown);
    this._dragBtn?.removeEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown', this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  // The "today" token is the one part of a frequency row where a plain tap
  // (not a hold) toggles the log — it's the row's primary action target, so
  // it shouldn't cost a 500ms dwell. Everywhere else on the bar, tap still
  // opens the goal dialog and hold still toggles (see onHoldDragStart below).
  onTap() {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }
    if (isEntryBased(this._goal) && this._tapOnToday) {
      this._toggleLog();
      return;
    }
    this._tap();
  }

  // Frequency goals have no continuous value to scrub — the 500ms dwell that
  // starts a percentage-goal's hold-drag instead commits a log toggle
  // immediately (the gestures mixin fires onHoldDragStart exactly once, at
  // dwell-confirmation, with a free haptic buzz already built in — nothing
  // to animate mid-hold, so unlike the percentage case there's no drag phase
  // to enter). onHoldDrag/onHoldDragEnd are no-ops for this type: the action
  // already happened at the start. This still fires for a hold anywhere on
  // the bar, including the "today" token — the token's plain-tap shortcut
  // above doesn't remove the hold path, it adds a faster one.

  onHoldDragStart() {
    this._closeReveal();
    if (isEntryBased(this._goal)) { this._toggleLog(); return; }
    this.classList.add('hold-active');
    this._bar.style.transition = 'none';
    this._setDragMode(true);
  }

  onHoldDragKey(dir) {
    if (isEntryBased(this._goal)) { this._toggleLog(); return; } // either arrow — it's a toggle, not a scrub
    this._setPct(dir === 'right' ? Math.min(100, this._pct + 5) : Math.max(0, this._pct - 5));
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  onHoldDrag(e) {
    if (isEntryBased(this._goal)) return;
    const rect = this._bar.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.round(Math.max(0, Math.min(100, (e.endX - rect.left) / rect.width * 100)));
    this._setPct(pct);
  }

  onHoldDragEnd() {
    if (isEntryBased(this._goal)) return;
    this.classList.remove('hold-active');
    this._bar.style.transition = '';
    this._setDragMode(false);
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  onSwipeMove(e) {
    this._bar.style.transition = 'none';
    let offset;
    if (this._revealedDir === 'left') {
      offset = Math.min(0, -REVEAL_WIDTH + e.dx);
    } else {
      const dx = e.dx > 0 ? Math.max(0, e.dx - SWIPE_DEAD_ZONE) : Math.min(0, e.dx + SWIPE_DEAD_ZONE);
      offset = Math.max(-REVEAL_WIDTH, Math.min(COLOR_WIDTH, dx));
    }
    this._bar.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) {
      this._closeReveal();
      return;
    }

    // Right swipe cycles colour — a momentary reveal that always snaps back
    // (mirrors lists-page-item exactly), unlike left-swipe delete below,
    // which persists open until confirmed or dismissed.
    if (e.direction === 'right') {
      const commit = e.distance >= COLOR_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
      if (commit) {
        this.dispatchEvent(new CustomEvent('goal-color-cycle', {
          bubbles: true, composed: true, detail: { goal: this._goal },
        }));
      }
      this._closeReveal();
      return;
    }

    const commit = e.distance >= REVEAL_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;

    if (commit) {
      this._bar.style.transform = `translateX(-${REVEAL_WIDTH}px)`;
      this._revealedDir = 'left';
    } else {
      this._closeReveal(); // _closeReveal sets its own spring transition
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _tap() {
    this.dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: this._goal },
    }));
  }

  _closeReveal() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._bar.style.transition = reduced ? 'none' : 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._bar.style.transform = '';
    this._revealedDir = null;
  }

  _setPct(pct) {
    this._pct = Math.max(0, Math.min(100, pct));
    this._fill.style.width = `${this._pct}%`;
    if (!isEntryBased(this._goal)) this._bar.setAttribute('aria-valuenow', String(this._pct));
    if (this._pctLabel) this._pctLabel.textContent = `${this._pct}%`;
  }

  _setDragMode(active) {
    this._title.hidden = active;
    this._pctLabel.hidden = !active;
  }

  // Toggling is the row's one frequency action, reachable by hold or by
  // Left/Right arrow — dispatched upward, same shape as _emitProgress(),
  // because the store mutation lives in the page, not the component.
  _toggleLog() {
    this.dispatchEvent(new CustomEvent('goal-log-toggle', {
      bubbles: true, composed: true, detail: { goal: this._goal },
    }));
  }

  // Small tick — every successful log. See the .log-tick keyframes above for
  // why this is a separate, quieter thing from ._celebrate()'s particle burst.
  // setTimeout rather than animationend, matching _celebrate() below — under
  // prefers-reduced-motion the animation is `none`, so animationend would
  // never fire and the class would stick until the next toggle force-removed it.
  _logTick() {
    clearTimeout(this._logTickTimer);
    this.classList.remove('log-tick');
    void this.offsetWidth; // force reflow so a rapid re-log restarts the animation
    this.classList.add('log-tick');
    this._logTickTimer = setTimeout(() => this.classList.remove('log-tick'), 500);
  }

  _emitProgress() {
    this.dispatchEvent(new CustomEvent('goal-progress', {
      bubbles: true, composed: true, detail: { percentage: this._pct, goal: this._goal },
    }));
  }

  _celebrate() {
    this._fill.classList.add('celebrate');
    this._fill.addEventListener('animationend', () => this._fill.classList.remove('celebrate'), { once: true });
    const r = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const shape = () => ['50%', '50%', '20%', '0%'][Math.floor(Math.random() * 4)];
    this.style.setProperty('--b1-rot', `${r(-20, 20)}deg`);
    this.style.setProperty('--b2-rot', `${r(-20, 20)}deg`);
    this.style.setProperty('--b-scale', `${r(0.82, 1.18)}`);
    this.style.setProperty('--b2-delay', `${Math.round(80 + Math.random() * 120)}ms`);
    this.style.setProperty('--b1-radius', shape());
    this.style.setProperty('--b2-radius', shape());
    this.classList.add('celebrating');
    // Use setTimeout rather than animationend — multiple animations run on :host
    // (goal-ring 700ms, burst-1 1500ms, burst-2 1500ms+120ms delay) and we
    // must keep .celebrating alive until the last one finishes.
    setTimeout(() => this.classList.remove('celebrating'), 1700);
  }

  // The base label is just the title, or title+urgency if a deadline is
  // active; frequency and decreasing goals each layer their own count/target
  // (and a "logged"/"slipped today" suffix) on top of that same base.
  _buildAriaLabel({ isFreq, isDecr, title, urgency }) {
    let label = urgency === 'none' ? title : t('goal-item.duedate-aria', { title, when: t(`urgency.${urgency}`) });
    if (isFreq) {
      const { type, target } = this._goal.tracking;
      const count = currentPeriodCount(this._goal.tracking);
      label = t(`goal-item.freq-aria-${type}`, { title: label, count, target });
      if (isLoggedOn(this._goal)) label += t('goal-item.freq-logged-suffix');
    } else if (isDecr) {
      const { target } = this._goal.tracking;
      const count = currentPeriodCount(this._goal.tracking);
      label = t('goal-item.decr-aria', { title: label, pct: this._pct, count, target });
      if (isLoggedOn(this._goal)) label += t('goal-item.decr-logged-suffix');
    }
    return label;
  }

  _update() {
    if (!this._bar) return;
    const isFreq = isFrequency(this._goal);
    const isEntry = isEntryBased(this._goal);
    const isDecr = isDecreasing(this._goal);
    const pct = percentValue(this._goal);
    const prevPct = this._pct;
    this._pct = Math.max(0, pct);
    const title = this._goal?.title ?? '';
    const active = this._pct < 100 && !this._goal?.archived;
    const urgency = urgencyOf(this._goal?.dueDate, active);
    this._title.textContent = title;

    this._bar.setAttribute('aria-label', this._buildAriaLabel({ isFreq, isDecr, title, urgency }));

    this._bar.dataset.hasDesc = String(!!this._goal?.notes);
    this.dataset.archived = String(!!this._goal?.archived);
    this.dataset.urgency = urgency;
    this._bar.dataset.type = this._goal?.tracking?.type ?? 'percentage';
    this._setPct(this._pct);
    if (this._pct === 100 && prevPct !== undefined && prevPct < 100) this._celebrate();
    if (this._stripEl) {
      const bg = tagStrip(this._goal?.tags ?? []);
      this._stripEl.style.background = bg;
      this._stripEl.hidden = !bg;
    }

    const color = this._goal?.color ?? null;
    this._bar.style.setProperty('--goal-item-color', color ?? 'transparent');
    if (color) this._colorPanel.style.setProperty('--color-panel-bg', color);
    else this._colorPanel.style.removeProperty('--color-panel-bg');

    // role="slider" only makes sense for a continuous, draggable value — an
    // entry-based goal's row (weekly/monthly/decreasing) is closer to a
    // toggle (hold logs/unlogs today), so it drops the slider role and its
    // min/max/now triad entirely rather than carry attributes that would
    // misdescribe it.
    this._bar.setAttribute('role', isEntry ? 'button' : 'slider');
    if (isEntry) {
      this._bar.removeAttribute('aria-valuemin');
      this._bar.removeAttribute('aria-valuemax');
      this._bar.removeAttribute('aria-valuenow');
      this._bar.setAttribute('aria-pressed', String(isLoggedOn(this._goal)));
    } else {
      this._bar.setAttribute('aria-valuemin', '0');
      this._bar.setAttribute('aria-valuemax', '100');
      this._bar.removeAttribute('aria-pressed');
    }

    this._bar.dataset.freq = String(isFreq);
    if (isFreq) {
      this._bar.dataset.freqType = this._goal.tracking.type;
      this._renderFreqCluster();
    }
    if (isDecr) {
      // pct-label stays in its template-default hidden state — never
      // unhidden by _setDragMode (decreasing never enters drag mode), same
      // as frequency types. The septagon strip's own coloring already
      // carries the score; a redundant number next to it isn't shown.
      this._renderSeptagonStrip();
    }
  }

  // Builds the wedge-fill SVG for one septagon: 7 <path> wedges (see
  // septagonWedgePath), each carrying its resolved state as a data
  // attribute so the CSS in template() can drive fill/stroke per state —
  // only the "within" dot needs anything built here beyond the path itself.
  _buildSeptagonFill(days) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'septagon-fill');
    svg.setAttribute('viewBox', `0 0 ${SEPTAGON_VB} ${SEPTAGON_VB}`);

    days.forEach((day, i) => {
      const state = septagonWedgeState(day);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', septagonWedgePath(i));
      path.setAttribute('data-state', state);
      path.setAttribute('data-iso', day.iso);
      svg.appendChild(path);

      if (state === 'within') {
        const [cx, cy] = septagonWedgeCentroid(i);
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('class', 'septagon-within-dot');
        dot.setAttribute('cx', cx.toFixed(3));
        dot.setAttribute('cy', cy.toFixed(3));
        dot.setAttribute('r', String(SEPTAGON_WITHIN_DOT_RADIUS));
        svg.appendChild(dot);
      }
    });

    return svg;
  }

  // Six septagons, oldest → current (see recentWeekStates in tracking.js) —
  // replaces the frequency dot-cluster entirely for this type. Rebuilt via
  // replaceChildren each render, same convention as _renderFreqCluster's dot
  // row below, since the row only re-renders on real state changes, not
  // per-frame.
  _renderSeptagonStrip() {
    const weeks = recentWeekStates(this._goal);
    const nodes = weeks.map((days, wi) => {
      const isCurrent = wi === weeks.length - 1;
      const el = document.createElement('span');
      el.className = 'septagon-week' + (isCurrent ? ' current' : '');
      el.appendChild(this._buildSeptagonFill(days));
      if (isCurrent) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'septagon-ring');
        svg.setAttribute('viewBox', `0 0 ${TODAY_BOX} ${TODAY_BOX}`);
        svg.setAttribute('width', String(TODAY_BOX));
        svg.setAttribute('height', String(TODAY_BOX));
        const polygon = document.createElementNS(SVG_NS, 'polygon');
        polygon.setAttribute('class', 'progress');
        polygon.setAttribute('points', SEPTAGON_RING_POINTS);
        svg.appendChild(polygon);
        el.appendChild(svg);
      }
      return el;
    });
    this._septagonStrip.replaceChildren(...nodes);

    const logged = isLoggedOn(this._goal);
    nodes[nodes.length - 1].classList.toggle('logged', logged);
    if (this._wasLoggedToday !== undefined && logged && !this._wasLoggedToday) this._logTick();
    this._wasLoggedToday = logged;
  }

  // Dot-strip (read-only, whatever recentDots() returns — up to DOT_WINDOW[type]
  // history dots, trimmed at the front so a losing streak that runs the whole
  // window doesn't visually anchor the row) + the "today" token (bigger,
  // doubles as the hold target — see .freq-today above). One shared shape
  // per goal: circle for weekly, soft square for monthly. No length
  // assumptions here on purpose — the trim/window sizing lives entirely in
  // tracking.js, this component just renders however many dots come back.
  _renderFreqCluster() {
    const dots = recentDots(this._goal);
    const history = dots.slice(0, -1);
    const today = dots[dots.length - 1];

    this._freqDots.replaceChildren(...history.map(d => {
      const el = document.createElement('span');
      el.className = 'freq-dot' + (d.state === 'met' ? ' met' : d.state === 'partial' ? ' partial' : '');
      if (d.state === 'partial') el.style.setProperty('--frac', `${Math.round(d.fraction * 100)}%`);
      return el;
    }));

    this._freqTodayDot.className = 'freq-dot' + (today.state === 'met' ? ' met' : today.state === 'partial' ? ' partial' : '');
    if (today.state === 'partial') this._freqTodayDot.style.setProperty('--frac', `${Math.round(today.fraction * 100)}%`);
    else this._freqTodayDot.style.removeProperty('--frac');
    this._freqTargetNum.textContent = String(this._goal.tracking.target);

    const rx = TODAY_RING_RX[this._goal.tracking.type];
    this._freqRing.setAttribute('rx', rx);

    const logged = isLoggedOn(this._goal);
    this._freqToday.classList.toggle('logged', logged);
    if (this._wasLoggedToday !== undefined && logged && !this._wasLoggedToday) this._logTick();
    this._wasLoggedToday = logged;
  }
}

customElements.define('goal-item', GoalItem);
