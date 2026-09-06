// Shared markup/CSS for the "deadline markers are hidden" indicator — a
// small, muted, non-interactive icon shown next to a page's always-visible
// filter-toggle button (never inside the collapsible filter panel itself:
// the whole point is to warn that items might be suppressed *before* the
// user thinks to open the filter panel at all, not after). Used by
// year-header.js (home-page's own header) and page-header.js (shared by
// list-detail-page/lists-page) — same "shared markup + CSS spliced into
// each consumer's own shadow root" pattern as urgency-badge.js/day-strip.js.
import { t } from '../../_lib/core/strings.js';
import { icons } from '../icons.js';

export function deadlinesHiddenBadgeMarkup() {
  return `<span class="deadlines-hidden-badge" id="deadlines-hidden-badge" aria-label="${t('filter.deadlines-hidden')}" hidden>${icons.calendarOff}</span>`;
}

export function deadlinesHiddenBadgeStyles() {
  return `
    /* [hidden] must come first and stay unconditional — author CSS origin
       beats the UA [hidden] rule regardless of specificity, so declaring
       display: flex without this override would render the badge even
       while .hidden is true. */
    .deadlines-hidden-badge[hidden] { display: none; }
    .deadlines-hidden-badge {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      color: var(--color-text-muted);
    }
    /* A thinner stroke, not a smaller size or reduced opacity, is what
       reads as "status marker, not another button" here — both those were
       tried and reverted. Size alone still sat at the same visual weight as
       the crisp filter/menu icons beside it; opacity would compound badly
       with year-header's own colour override just below (which can already
       be a translucent white in image mode — stacking a second alpha on
       top of that would recreate the exact "invisible against a photo"
       problem that override exists to fix). Stroke-width is orthogonal to
       colour/alpha entirely, so it carries the same "lighter, secondary"
       cue in all three colour contexts (default muted, year-header's
       --color-text-secondary, year-header's image-mode translucent white)
       without any of that risk. CSS stroke-width does override the icon's
       own stroke-width="2" attribute — confirmed via a real computed-style
       check, not assumed. */
    .deadlines-hidden-badge svg {
      display: block;
      inline-size: var(--icon-size-sm);
      block-size: var(--icon-size-sm);
      stroke-width: 1.5;
    }
  `;
}
