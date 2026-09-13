import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { tagStrip } from '../../utils/tag-color.js';
import { urgencyOf, mostUrgent } from '../../utils/urgency.js';
import { frequencyUrgencyOf, frequencyRowUrgencyOf } from '../../utils/frequency-urgency.js';
import { urgencyBadgeMarkup, urgencyBadgeStyles } from '../../utils/urgency-badge.js';
import { rowChromeStyles } from '../../utils/row-chrome.js';
import { markDelete } from '../../utils/delete-ghost-guard.js';
import {
  percentValue, isFrequency, isEntryBased, isDecreasing, isCountdown, countdownDaysRemaining,
  recentDots, recentWeekStates, isLoggedOn, currentPeriodCount,
} from '../../utils/tracking.js';

const REVEAL_WIDTH = 60;
const COLOR_WIDTH = 48;    // left-side colour panel, revealed by swiping right — mirrors lists-page-item
const COMMIT_RATIO = 2.0;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
const SWIPE_DEAD_ZONE = 15;   // px of drag before bar starts moving
const DRAG_100_INSET = 7;         // px shaved off the drag-to-set-% denominator so the last few px of the bar aren't needed to reach 100 — the fill/UI itself is untouched, only how far a drag has to travel
const DRAG_100_INSET_MAX = 28;    // px — the inset grows toward this ceiling the faster the drag is moving, so a fast flick to the end reaches 100 sooner than a slow, deliberate drag would
const DRAG_VELOCITY_FOR_MAX_INSET = 1.2; // px/ms — drag speed at/above which the full extra inset applies; roughly a brisk flick

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

// Completion-burst particles — replaces the old fixed 3-tone box-shadow
// confetti (burst-1/burst-2) with real DOM dots that shift colour via
// filter: hue-rotate() instead of animating background-color, so the
// browser re-tints already-painted pixels each frame rather than
// repainting (see joshwcomeau.com/animation/color-shifting). Values below
// came out of an animation-lab prototyping session, tuned by eye.
const PARTICLE_COUNT = 36;
const PARTICLE_BASE_SIZE = 18; // px, jittered ±25% per particle
const PARTICLE_ORIGIN_SPREAD_RATIO = 0.85; // fraction of the bar's rendered width particles spawn across, not a fixed px amount, so it scales with the row
const PARTICLE_FLIGHT_SPREAD = 130; // px outward travel, jittered per particle
const PARTICLE_FAN_DEG = 165; // ± fan around straight-up for each particle's flight angle
const PARTICLE_FLY_DUR = 2400; // ms, jittered ±15% per particle — also sets how long :host must stay overflow:visible
const PARTICLE_HUE_DEG = 120; // deg the hue-rotate travels over one shift cycle, jittered per particle
const PARTICLE_SHIFT_DUR = 800; // ms per hue/brightness cycle, jittered per particle
const PARTICLE_START_HUE_JITTER = 28; // deg — per-particle starting-hue offset so the burst isn't one flat colour
// Spawned one at a time, staggered, rather than all 36 in a single tick —
// spawning them together meant they also mostly *finished* (and got
// removed) together, since PARTICLE_FLY_DUR only jitters ±15%: a sustained
// peak of 36 simultaneous filter-animated DOM nodes for ~2.4s, then a
// synchronized pile of removals right at the tail end. That pattern was
// confirmed (on real Android Chrome, not reproducible headless) to trigger
// a GPU/compositor hiccup visible as the fixed bottom-nav sliding out and
// back. Staggering spreads both the peak concurrent count and the
// tail-end removal burst, at 12ms/particle it's still well under human
// perception of sequencing (reads as one eruption, not a trickle).
const PARTICLE_SPAWN_STAGGER_MS = 12;

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
// both get a full, solid accent-colour wedge, no border — `within`
// additionally gets a small knockout dot (punched through to the row's own
// background) marking "this one used the allowance but stayed free";
// `over` drops the fill entirely, fully transparent — reading as
// "drained/empty" the way an unchecked box reads unchecked, the same bare
// look in every week (no special-casing the current week). `future` (a day
// in the current week that hasn't happened yet) gets its own solid fill —
// --color-border, the same neutral the frequency dot-strip already uses
// for an empty/no-progress period — distinguishing "upcoming" from
// "missed" by fill alone, no border needed to disambiguate the two.
// Today's own wedge additionally gets one solid line, on the radial edge
// facing tomorrow, marking the current moment like a clock hand (see
// septagonTodayBoundary and .septagon-clock-line below) — the only border
// anywhere in the strip.
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
// The radial boundary between wedge i and wedge i+1 — center out to their
// shared vertex. Drawn solid only when i is today's index, marking the
// edge between today and tomorrow like a clock hand pointing at the
// current moment.
export function septagonTodayBoundary(i) {
  const [x, y] = SEPTAGON_VERTICES[(i + 1) % SEPTAGON_SIDES];
  return [SEPTAGON_CENTER, SEPTAGON_CENTER, x, y];
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

  // This goal's year-level deadline setting — 'off' | 'warn' | 'full' (see
  // deadline-visibility.js) — home-page.js resolves and pushes this in,
  // rather than this element reading the store itself, matching how
  // lists-page-item.js receives `rollupVisible` as a plain property. Absent
  // (undefined) defaults to 'full', matching every test/caller that never
  // sets it. 'off' suppresses the icon and Failed both; 'warn' keeps the
  // icon (and therefore notifications, which read the same computation)
  // but forces Failed to never fire; 'full' is the original, single-level
  // behaviour unchanged.
  set deadlinesLevel(value) {
    this._deadlinesLevel = value;
    if (this.shadowRoot) this._update();
  }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
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

        ${rowChromeStyles('.bar')}

        .bar {
          block-size: var(--goal-item-height, var(--row-height));
          overflow: hidden;
          /* Stronger than the shared divider colour — goal-item is the only
             one of the three rows with a translucent accent-tinted overlay
             (.fill, below) sitting right up against this edge, and plain
             --color-border reads fine against a plain surface but nearly
             disappears against that tint (confirmed: two adjacent
             significantly-filled rows made the line between them almost
             invisible). list-item/lists-page-item have no equivalent tint,
             so they keep the shared colour unchanged. */
          border-block-end-color: color-mix(in srgb, var(--color-border), var(--color-text-secondary));
        }

        .fill {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          background: color-mix(in srgb, var(--color-accent) 25%, transparent);
          transition: width 0.1s ease;
          pointer-events: none;
        }

        /* ── Failed escalation — full-row red once a dueDate has lapsed or a
           pace debt has gone unpaid ── data-failed is its own boolean
           attribute, computed independently in _update() below from
           frequencyRowUrgencyOf (not the same computation the calendar
           badge's data-urgency reads — see _update() for why the two are
           kept genuinely separate, not just differently named).
           Filled portion goes solid --color-danger (the same token/pairing
           the badge above already proves correct in both themes); the
           unfilled track becomes --color-danger-track (see index.html —
           theme-aware so text stays legible on it in both modes) instead of
           the plain accent-tinted fill/surface pairing every other state uses. */
        :host([data-failed]) .bar { background: var(--color-danger-track); }
        :host([data-failed]) .fill { background: var(--color-danger); }
        :host([data-failed]) .title,
        :host([data-failed]) .pct-label { color: var(--color-text-inverse); }
        :host([data-failed]) .desc-icon { color: var(--color-text-inverse); opacity: 0.7; }
        :host([data-failed]) .drag-btn { color: var(--color-text-inverse); }

        /* Frequency dot-strip and the decreasing/"Avoid" septagon strip both
           key their history off --color-accent/--color-border normally —
           neither reads legibly against a solid danger-red row, so Failed
           re-themes them onto --color-text-inverse instead. Applies
           whenever the goal is Failed for any reason (lapsed dueDate or a
           frequency debt/allowance failure) — every path sets the same
           data-failed attribute, so no separate rule is needed per source. */
        :host([data-failed]) .freq-dot {
          background: color-mix(in srgb, var(--color-text-inverse) 35%, transparent);
        }
        :host([data-failed]) .freq-dot.met { background: var(--color-text-inverse); }
        :host([data-failed]) .freq-dot.partial {
          background: conic-gradient(var(--color-text-inverse) var(--frac, 50%), color-mix(in srgb, var(--color-text-inverse) 35%, transparent) 0);
        }
        :host([data-failed]) .septagon-fill path[data-state="clean"],
        :host([data-failed]) .septagon-fill path[data-state="within"] {
          fill: var(--color-text-inverse);
        }
        /* "Over" is fully transparent (see the base rule above) — nothing
           opaque to re-theme, the red shows straight through in any state.
           "Future" still needs one, the same re-theme the frequency
           dot-strip's own empty/missed dot gets a few lines up. */
        :host([data-failed]) .septagon-fill path[data-state="future"] {
          fill: color-mix(in srgb, var(--color-text-inverse) 35%, transparent);
        }
        :host([data-failed]) .septagon-clock-line {
          stroke: var(--color-text-inverse);
        }
        :host([data-failed]) .septagon-within-dot { fill: var(--color-danger-track); }

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

        /* inset-block-end nudged up 2px (was flush at 0) so it no longer
           touches the row's new border-block-end divider directly below it —
           left as a bottom-edge strip rather than porting list-item's pill
           treatment for now; goal rows already carry more competing content
           (progress %, frequency dots, urgency icon) than list-item's did. */
        .tag-strip {
          position: absolute;
          inset-block-end: 2px;
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
           app/utils/urgency-badge.js. Year-level setting (default 'full' for
           the current year, 'off' otherwise — see deadline-visibility.js) is
           gated in JS via the deadlinesLevel property below, not CSS — the
           whole merged bucket collapses to 'none' at 'off', which already
           means no rule here matches, so the icon needs no separate display
           toggle of its own. ('warn' leaves the icon fully alone — only
           Failed is affected by that level.) */
        .urgency-icon { margin-inline-start: var(--space-1); }
        ${urgencyBadgeStyles()}

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
        /* Plain accent, not a semantic success colour — this ring only ever
           means "logged today", not "good"/"bad", and the wedge/dot fill
           beneath it already carries whatever judgment there is to make.
           Thinner than the general run of borders in this strip, on
           purpose — a quiet activity marker, not something competing for
           attention with the fill itself. */
        .freq-ring .progress { fill: none; stroke: var(--color-accent); stroke-width: 1.5; }

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

        /* Wedge fills never carry a border, in any week, for any state —
           each state is told apart by fill alone. The one stroke anywhere
           in the strip is the purpose-built .septagon-clock-line below,
           layered on top rather than baked into a wedge path itself (a
           single <path>'s stroke would be uniform across all its edges,
           where this only ever applies to one specific edge). */
        .septagon-fill path[data-state="clean"],
        .septagon-fill path[data-state="within"] {
          fill: var(--color-accent);
        }

        /* "Over" (missed): the fill drops out entirely — reads as
           "drained/empty" the way an unchecked box reads unchecked. Fully
           transparent rather than any particular colour means it needs no
           re-theming under the full-row-red Failed state either (see
           :host([data-failed]) below) — there's nothing opaque
           to clash with whatever's behind it. */
        .septagon-fill path[data-state="over"] { fill: transparent; }

        /* "Future" (upcoming, current week only): a solid fill using the
           same neutral --color-border the frequency dot-strip already uses
           for an empty/no-progress period — distinguishes "hasn't happened
           yet" from "missed" (fully transparent, above) by fill alone. */
        .septagon-fill path[data-state="future"] { fill: var(--color-border); }

        /* Today: a solid line on the radial edge between today's wedge and
           tomorrow's — a clock hand marking the current moment, not an
           outline around today's own wedge. Same accent colour and hairline
           width the wedge borders themselves used to carry. */
        .septagon-clock-line {
          stroke: var(--color-accent);
          stroke-width: 0.5px;
          stroke-linecap: round;
          vector-effect: non-scaling-stroke;
          pointer-events: none;
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
        /* Same plain accent as .freq-ring, not --color-danger — a slip
           already reads as a "drained" transparent wedge on its own (see
           .septagon-fill path[data-state="over"] above), so this ring isn't
           a second warning stacked on top of the wedge's own colour.
           Dashed rather than solid, though: the ring means the *opposite*
           thing here (a slip, not a completion) and color is deliberately
           off the table for either — a broken/interrupted ring for "the
           streak broke today" reads distinctly from freq-ring's solid
           "did the thing" circle without needing a second hue. */
        .septagon-ring .progress { fill: none; stroke: var(--color-accent); stroke-width: 1.5; stroke-dasharray: 4 3; }

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

        /* Position/z-index pre-derived from the identical bug found and
           fixed on lists-page-item's own archive-dot (same drag-btn/stripe
           geometry — --row-accent-width stripe, drag-btn's icon starting
           ~7px in): sitting on top of the drag icon (z-index above it)
           rather than squeezed into the now-too-narrow gap between the
           stripe and the icon. */
        .archive-dot {
          display: none;
          position: absolute;
          inset-block-start: 50%;
          transform: translateY(-50%);
          inset-inline-start: calc(7px - var(--row-accent-width));
          inline-size: var(--space-1);
          block-size: var(--space-1);
          border-radius: var(--radius-full);
          background: var(--color-accent);
          z-index: 2;
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
          /* Every row's .bar is already z-index: 1 *and* will-change:
             transform (row-chrome.js's rowChromeStyles(), shared by every
             goal-item/list-item whether celebrating or not) — will-change:
             transform alone creates a stacking context, so every row is
             already an opaque z-index:1 layer. Setting :host(.celebrating)
             to that same value ties against every sibling's .bar, and ties
             break by DOM order (later wins) — that's exactly the asymmetry
             this was chasing: the celebrating row (later than the row
             above) won there, but the row below (later still) won against
             it. Needs to clear 1, not match it. */
          z-index: 5;
        }

        /* ── Particle burst ──────────────────────────────────────────────────
           A dedicated container, not :host's own pseudo-elements — real DOM
           particles need real child nodes, which pseudo-elements can't hold.
           It's a direct child of :host (a sibling of .bar), not nested
           inside .bar, because .bar sets its own overflow: hidden — bursting
           particles need to escape :host's box instead (see
           :host(.celebrating)'s overflow: visible below), same reason the
           old ::before/::after bursts also lived on :host directly. */
        .particle-field {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
        }

        .particle {
          position: absolute;
          top: 50%;
          left: 50%;
          inline-size: var(--size);
          block-size: var(--size);
          border-radius: 50%;
          background: var(--color-accent);
          animation:
            particle-fly var(--fly-dur) cubic-bezier(.15, .85, .4, 1) forwards,
            particle-shift var(--shift-dur) var(--phase, 0ms) ease-in-out infinite;
        }

        @keyframes particle-fly {
          0%   { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          72%  { opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.35); opacity: 0; }
        }

        /* filter-only colour animation: hue-rotate + brightness on the same
           property so the browser re-tints the one painted dot each frame
           instead of repainting a changed background-color. The brightness
           wobble is what reads as a "blink" — deliberately not layered as a
           separate opacity animation, since opacity is already owned by
           particle-fly's fade-out above and a second animation on the same
           property would just override it instead of combining. */
        @keyframes particle-shift {
          0%   { filter: hue-rotate(var(--start-hue)) brightness(1); }
          25%  { filter: hue-rotate(calc(var(--start-hue) + var(--hue-deg) * 0.35)) brightness(1.75); }
          50%  { filter: hue-rotate(calc(var(--start-hue) + var(--hue-deg) * 0.6))  brightness(0.25); }
          75%  { filter: hue-rotate(calc(var(--start-hue) + var(--hue-deg) * 0.85)) brightness(1.75); }
          100% { filter: hue-rotate(calc(var(--start-hue) + var(--hue-deg))) brightness(1); }
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
          .particle { animation: none; opacity: 0; }
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
      <span class="particle-field" aria-hidden="true"></span>
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
    this._particleField = this.shadowRoot.querySelector('.particle-field');
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
    if (isCountdown(this._goal)) return; // self-advancing, not manually adjustable
    this.classList.add('hold-active');
    this._bar.style.transition = 'none';
    this._setDragMode(true);
    // Reset per-drag velocity tracking (see onHoldDrag below) — holddrag
    // events carry no velocity of their own (only holdswipeend does), so
    // it's tracked here across consecutive onHoldDrag calls.
    this._dragLastX = null;
    this._dragLastT = null;
    this._dragVelocity = 0;
  }

  onHoldDragKey(dir) {
    if (isEntryBased(this._goal)) { this._toggleLog(); return; } // either arrow — it's a toggle, not a scrub
    if (isCountdown(this._goal)) return; // self-advancing, not manually adjustable
    this._setPct(dir === 'right' ? Math.min(100, this._pct + 5) : Math.max(0, this._pct - 5));
    if (this._pct === 100) this._celebrate();
    this._emitProgress();
  }

  onHoldDrag(e) {
    if (isEntryBased(this._goal)) return;
    if (isCountdown(this._goal)) return;
    const rect = this._bar.getBoundingClientRect();
    if (!rect.width) return;

    const now = Date.now();
    if (this._dragLastX !== null) {
      const dt = now - this._dragLastT;
      if (dt > 0) {
        const instVelocity = Math.abs(e.endX - this._dragLastX) / dt;
        this._dragVelocity = this._dragVelocity * 0.5 + instVelocity * 0.5; // smoothed, so one jittery sample can't spike the inset
      }
    }
    this._dragLastX = e.endX;
    this._dragLastT = now;

    const velocityFactor = Math.min(1, this._dragVelocity / DRAG_VELOCITY_FOR_MAX_INSET);
    const inset = DRAG_100_INSET + (DRAG_100_INSET_MAX - DRAG_100_INSET) * velocityFactor;
    const dragWidth = Math.max(1, rect.width - inset);
    const pct = Math.round(Math.max(0, Math.min(100, (e.endX - rect.left) / dragWidth * 100)));
    this._setPct(pct);
  }

  onHoldDragEnd() {
    if (isEntryBased(this._goal)) return;
    if (isCountdown(this._goal)) return;
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
    if (!this._pctLabel) return;
    if (isCountdown(this._goal)) {
      // Always visible (not drag-gated like percentage's own label above) —
      // there's no drag mode to enter for a self-advancing type, see
      // onHoldDragStart. Shows days remaining, not the percent itself — see
      // CLAUDE.md's countdown section for why the number counts down while
      // the bar fills up.
      this._pctLabel.hidden = false;
      const days = countdownDaysRemaining(this._goal);
      this._pctLabel.textContent = days === null
        ? t('goal-item.countdown-days-unset')
        : t('goal-item.countdown-days', { count: days });
    } else {
      this._pctLabel.textContent = `${this._pct}%`;
    }
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
    this.classList.add('celebrating');
    this._spawnParticles();
    // Use setTimeout rather than animationend — :host must stay
    // overflow:visible for as long as the longest-lived particle can
    // possibly be flying, including the staggered spawn delay of the very
    // last particle (see PARTICLE_SPAWN_STAGGER_MS/PARTICLE_FLY_DUR below),
    // not just the shorter 700ms goal-ring pulse also running on :host.
    const maxCelebrateMs = (PARTICLE_COUNT - 1) * PARTICLE_SPAWN_STAGGER_MS + Math.round(PARTICLE_FLY_DUR * 1.15) + 100;
    setTimeout(() => this.classList.remove('celebrating'), maxCelebrateMs);
  }

  // Real DOM particles (not :host pseudo-elements, which can't hold
  // generated child nodes) so each dot can carry its own randomised
  // custom properties. Cleanup is a setTimeout matched to each particle's
  // own flight duration, not 'animationend' — under prefers-reduced-motion
  // the .particle rule sets animation: none, so 'animationend' would never
  // fire and every burst would leak 36 orphaned nodes into the shadow root
  // (mirrors _logTick()'s own comment on the same tradeoff, below).
  _spawnParticles() {
    if (!this._particleField) return;
    const r = (a, b) => a + Math.random() * (b - a);
    const rect = this._bar.getBoundingClientRect();
    const originSpread = rect.width * PARTICLE_ORIGIN_SPREAD_RATIO;
    // At the fan's wide extremes (±165° around straight-up) a particle's
    // flight angle approaches fully horizontal, not just "up and to the
    // side" — combined with an origin near the row's own edge, that can
    // push a particle's absolute screen position past the viewport edge
    // while :host is overflow:visible. On a device-width mobile viewport,
    // *any* horizontal overflow — even from one particle, regardless of
    // how many are animating or how they're staggered — makes the browser
    // briefly rescale the whole page to fit the wider content, then snap
    // back once .celebrating removes overflow:visible and re-clips it.
    // Confirmed on real Android Chrome as the actual cause of a reported
    // "photo zooms + bottom-nav slides" glitch at the tail end of the
    // burst; staggering spawn timing (a load/GPU theory) had no effect,
    // which is what pointed at a geometry cause instead. Clamped here
    // rather than by narrowing PARTICLE_FAN_DEG, so the tuned spread of
    // angles is untouched for every particle that doesn't need clamping.
    const halfMaxSize = (PARTICLE_BASE_SIZE * 1.25) / 2;
    const minX = halfMaxSize;
    const maxX = window.innerWidth - halfMaxSize;

    const spawnOne = () => {
      if (!this._particleField) return; // disconnected mid-burst
      const el = document.createElement('span');
      el.className = 'particle';
      const angle = (-90 + r(-PARTICLE_FAN_DEG, PARTICLE_FAN_DEG)) * Math.PI / 180;
      const dist = r(PARTICLE_FLIGHT_SPREAD * 0.5, PARTICLE_FLIGHT_SPREAD);
      const flyDur = PARTICLE_FLY_DUR * r(0.85, 1.15);
      const shiftDur = PARTICLE_SHIFT_DUR * r(0.7, 1.3);
      const originX = r(-originSpread / 2, originSpread / 2);
      let dx = Math.cos(angle) * dist;
      const absoluteX = rect.left + rect.width / 2 + originX + dx;
      if (absoluteX < minX) dx += minX - absoluteX;
      else if (absoluteX > maxX) dx -= absoluteX - maxX;
      el.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--dy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      el.style.setProperty('--size', `${(PARTICLE_BASE_SIZE * r(0.75, 1.25)).toFixed(1)}px`);
      el.style.setProperty('--hue-deg', `${(PARTICLE_HUE_DEG * r(0.7, 1.3)).toFixed(0)}deg`);
      el.style.setProperty('--start-hue', `${r(-PARTICLE_START_HUE_JITTER, PARTICLE_START_HUE_JITTER).toFixed(0)}deg`);
      el.style.setProperty('--fly-dur', `${flyDur.toFixed(0)}ms`);
      el.style.setProperty('--shift-dur', `${shiftDur.toFixed(0)}ms`);
      el.style.setProperty('--phase', `${(-r(0, shiftDur)).toFixed(0)}ms`);
      el.style.left = `calc(50% + ${originX.toFixed(1)}px)`;
      el.style.top = `calc(50% + ${r(-6, 6).toFixed(1)}px)`;
      this._particleField.appendChild(el);
      setTimeout(() => el.remove(), flyDur + 50);
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      setTimeout(spawnOne, i * PARTICLE_SPAWN_STAGGER_MS);
    }
  }

  // The base label is just the title, or title+urgency if a deadline is
  // active; frequency and decreasing goals each layer their own count/target
  // (and a "logged"/"slipped today" suffix) on top of that same base.
  _buildAriaLabel({ isFreq, isDecr, isCntdn, title, urgency, failed }) {
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
    } else if (isCntdn) {
      const days = countdownDaysRemaining(this._goal) ?? 0;
      label = t('goal-item.countdown-aria', { title: label, pct: this._pct, days });
    }
    // data-failed (full-row-red) is a separate mechanism from the icon's own
    // urgency and can be true while urgency reads something milder (e.g. a
    // scheduled-days goal still 'today' by aggregate count but Failed by its
    // stricter debt ledger — see frequency-urgency.js). Only announce it
    // when it adds real information: a lapsed dueDate's own 'overdue' bucket
    // is always Failed too (dueDate has no separate row-vs-icon split the
    // way frequency does), so appending the suffix there would just repeat
    // what was already said.
    if (failed && urgency !== 'overdue') label += t('goal-item.failed-suffix');
    return label;
  }

  _update() {
    if (!this._bar) return;
    const isFreq = isFrequency(this._goal);
    const isEntry = isEntryBased(this._goal);
    const isDecr = isDecreasing(this._goal);
    const isCntdn = isCountdown(this._goal);
    const pct = percentValue(this._goal);
    const prevPct = this._pct;
    this._pct = Math.max(0, pct);
    const title = this._goal?.title ?? '';
    // Deliberately NOT gated on archived: an archived goal's urgency still
    // computes normally, matching how an archived list's items keep full
    // deadline visibility (see CLAUDE.md's Urgency section) — archiving
    // hides the row from the default view (see home-page.js's own filter),
    // it doesn't erase what's actually true about the goal. The row itself
    // is only ever seen at all, archived or not, when something renders it —
    // the main list gated behind the Archived filter pill, or the
    // Hidden-items dialog for a still-overdue one (see upcoming.js).
    const active = this._pct < 100;
    // TWO genuinely independent mechanisms, each with its own merge, its own
    // DOM attribute, and its own CSS — not one computed value read by both.
    // (An earlier version of this file computed a single merged bucket and
    // relabelled its top value for the row's CSS to key off — that still
    // left the icon and the row reading the exact same computation, just
    // under a translated name, which defeats the point of separating them.)
    //
    // - data-urgency (icon): aligned 1:1 with the internal notification —
    //   same dialog-facing frequencyUrgencyOf the Upcoming dialog/bell badge
    //   use, not the row's own pace bookkeeping. This is what the calendar
    //   badge in urgency-badge.js renders.
    // - data-failed (full-row-red): its own boolean, from frequencyRowUrgencyOf
    //   — the row's stricter, debt-ledger-based "can this still be recovered"
    //   check (see frequency-urgency.js's module doc). A goal can be Failed
    //   without the icon being 'overdue', and vice versa; they are not the
    //   same question.
    //
    // The year-level setting gates the two mechanisms independently now,
    // not identically: 'off' suppresses both (no icon, no Failed) — the
    // dueDate half included, not just frequency — matching collectUpcoming's
    // own gating (see deadline-visibility.js). 'warn' keeps the icon (and so
    // notifications, which read the same computation) but forces Failed off
    // regardless of what the underlying merge would say. 'full' is the
    // original, single-level behaviour: both mechanisms compute normally.
    const level = this._deadlinesLevel ?? 'full';
    const dueDate = this._goal?.dueDate;
    const iconUrgency = level === 'off'
      ? 'none'
      : mostUrgent([urgencyOf(dueDate, active), frequencyUrgencyOf(this._goal, active)]);
    const failed = level === 'full'
      && mostUrgent([urgencyOf(dueDate, active), frequencyRowUrgencyOf(this._goal, active)]) === 'overdue';
    this._title.textContent = title;

    this._bar.setAttribute('aria-label', this._buildAriaLabel({ isFreq, isDecr, isCntdn, title, urgency: iconUrgency, failed }));

    this._bar.dataset.hasDesc = String(!!this._goal?.notes);
    this.dataset.archived = String(!!this._goal?.archived);
    this.dataset.urgency = iconUrgency;
    this.toggleAttribute('data-failed', failed);
    this._bar.dataset.type = this._goal?.tracking?.type ?? 'percentage';
    this._setPct(this._pct);
    if (this._pct === 100 && prevPct !== undefined && prevPct < 100) this._celebrate();
    if (this._stripEl) {
      const bg = tagStrip(this._goal?.tags ?? []);
      this._stripEl.style.background = bg;
      this._stripEl.hidden = !bg;
    }

    const color = this._goal?.color ?? null;
    this._bar.style.setProperty('--row-accent-color', color ?? 'transparent');
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
      // Countdown keeps role="slider" (still a continuous 0-100 value, same
      // as percentage) but is deliberately not adjustable via drag/arrow
      // keys — see onHoldDragStart et al. A plain slider role implies
      // keyboard/drag operability, so leaving this unset would mislead
      // assistive tech into expecting arrow keys to work. aria-readonly is
      // the correct ARIA affordance for exactly this case: a slider whose
      // value is displayed but not user-editable.
      if (isCntdn) this._bar.setAttribute('aria-readonly', 'true');
      else this._bar.removeAttribute('aria-readonly');
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
  // attribute so the CSS in template() can drive fill per state — "missed"
  // vs. "upcoming" are told apart by fill alone (transparent vs.
  // --color-border), no border needed. Wedge fills never carry a border at
  // all; the one stroke in the whole strip is a purpose-built <line>
  // element for today's boundary, added on top rather than baked into the
  // wedge path itself (a single <path>'s stroke would be uniform across
  // all its edges, where this only ever applies to one specific edge).
  // Falls out naturally from day.today — only the current week's day array
  // ever has day.today === true, so no separate "is this the current week"
  // check is needed here.
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

      if (day.today) {
        const [x0, y0, x1, y1] = septagonTodayBoundary(i);
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'septagon-clock-line');
        line.setAttribute('x1', x0.toFixed(3));
        line.setAttribute('y1', y0.toFixed(3));
        line.setAttribute('x2', x1.toFixed(3));
        line.setAttribute('y2', y1.toFixed(3));
        svg.appendChild(line);
      }
    });

    return svg;
  }

  // DOT_WINDOW.decreasing septagons, oldest → current (see recentWeekStates
  // in tracking.js) —
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
