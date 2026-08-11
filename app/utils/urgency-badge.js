// Shared markup/CSS for the deadline/due-date calendar badge used by both
// goal-item and list-item. Extracted because the two had drifted to setting
// data-urgency in different places (host vs. an inner element) despite being
// the same widget — see ComponentDuplicationReport.md #3. Both now set
// data-urgency on the host and render `urgencyBadgeMarkup` as a sibling
// inside their interactive row/bar, with `urgencyBadgeStyles()` spliced into
// their own <style> block.
import { icons } from '../icons.js';

export const urgencyBadgeMarkup = `<span class="urgency-icon" aria-hidden="true">${icons.calendar}</span>`;

// `displayWhenShown` lets goal-item gate visibility behind the year-scoped
// --goal-deadline-display var while list-item stays unconditionally visible
// ('block') — goal deadlines are year-aware, item due-dates are not (see
// CLAUDE.md data model section). Keeping this as a parameter rather than a
// shared CSS var avoids list-item accidentally inheriting goal-item's
// year-gating through --goal-deadline-display, which is set on :root and
// would otherwise cascade into every shadow root in the app.
export function urgencyBadgeStyles(displayWhenShown = 'block') {
  return `
    .urgency-icon {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      color: var(--color-text-muted);
      display: none;
      line-height: 1;
    }

    .urgency-icon svg {
      display: block;
      inline-size: var(--icon-size-sm);
      block-size: var(--icon-size-sm);
    }

    /* Calendar badge, tinted by how soon the date is. Only 'overdue' gets a
       non-colour ring. */
    :host([data-urgency="far"])     .urgency-icon { display: ${displayWhenShown}; color: var(--color-text-muted); }
    :host([data-urgency="month"])   .urgency-icon { display: ${displayWhenShown}; color: var(--color-success); }
    :host([data-urgency="week"])    .urgency-icon { display: ${displayWhenShown}; color: var(--color-warning); }
    :host([data-urgency="today"])   .urgency-icon { display: ${displayWhenShown}; color: var(--color-danger); }
    :host([data-urgency="overdue"]) .urgency-icon {
      display: ${displayWhenShown};
      color: var(--color-text-inverse);
      background: var(--color-danger);
      border-radius: var(--radius-sm);
      padding: 2px;
    }
  `;
}
