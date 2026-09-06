// Shared markup/CSS for the deadline/due-date calendar badge used by both
// goal-item and list-item. Extracted because the two had drifted to setting
// data-urgency in different places (host vs. an inner element) despite being
// the same widget — see ComponentDuplicationReport.md #3. Both now set
// data-urgency on the host and render `urgencyBadgeMarkup` as a sibling
// inside their interactive row/bar, with `urgencyBadgeStyles()` spliced into
// their own <style> block.
import { icons } from '../icons.js';

export const urgencyBadgeMarkup = `<span class="urgency-icon" aria-hidden="true">${icons.calendar}</span>`;

// Year/list-level visibility (goal-item.js/list-item.js's `deadlinesVisible`
// property, see deadline-visibility.js) is gated in JS, not CSS — a hidden
// year/list collapses the whole merged bucket to 'none' before it ever
// reaches `data-urgency`, so no rule below matches and the icon simply never
// shows. That used to be a CSS-var parameter here instead (goal-item's
// `--goal-deadline-display`); moved to JS so it correctly suppresses the
// full-row-red overdue treatment too, not just this icon.
export function urgencyBadgeStyles() {
  return `
    .urgency-icon {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      color: var(--color-text-muted);
      display: none;
      line-height: 1;
      border-radius: var(--radius-sm);
      padding: 2px;
    }

    .urgency-icon svg {
      display: block;
      inline-size: var(--icon-size-sm);
      block-size: var(--icon-size-sm);
    }

    /* Calendar badge, tinted by how soon the date is. Every bucket gets the
       same padded box (border-radius/padding on the shared .urgency-icon
       rule above) so the icon occupies a consistent footprint regardless of
       urgency — previously only 'overdue' had this padding, which misaligned
       it against the plain bare icons every other bucket used. Only the
       *icon colour* changes bucket to bucket; the background stays plain
       transparent for all of them (done/closed items never reach this at
       all — they're never "active" for due-date purposes, so the icon
       doesn't render regardless of bucket). 'overdue' is the one deliberate
       exception — a solid/inverse fill so it still reads as the loudest
       state. */
    :host([data-urgency="far"])      .urgency-icon { display: block; color: var(--color-text-muted); background: transparent; }
    :host([data-urgency="month"])    .urgency-icon { display: block; color: var(--color-success); background: transparent; }
    :host([data-urgency="week"])     .urgency-icon { display: block; color: var(--color-warning); background: transparent; }
    :host([data-urgency="tomorrow"]) .urgency-icon { display: block; color: var(--color-tomorrow); background: transparent; }
    :host([data-urgency="today"])    .urgency-icon { display: block; color: var(--color-danger); background: transparent; }
    :host([data-urgency="overdue"]) .urgency-icon {
      display: block;
      color: var(--color-text-inverse);
      background: var(--color-danger);
    }
  `;
}
