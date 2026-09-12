// Shared markup/CSS for the deadline/due-date calendar badge used by both
// goal-item and list-item. Extracted because the two had drifted to setting
// data-urgency in different places (host vs. an inner element) despite being
// the same widget — see ComponentDuplicationReport.md #3. Both now set
// data-urgency on the host and render `urgencyBadgeMarkup` as a sibling
// inside their interactive row/bar, with `urgencyBadgeStyles()` spliced into
// their own <style> block.
import { icons } from '../icons.js';

export const urgencyBadgeMarkup = `<span class="urgency-icon" aria-hidden="true">${icons.calendar}</span>`;

// data-urgency here is the icon's OWN mechanism — computed via the
// dialog-facing frequencyUrgencyOf (see goal-item.js), aligned 1:1 with the
// internal notification digest. It is deliberately not the same value as
// data-failed (the separate, boolean full-row-red attribute, driven by the
// row's own stricter frequencyRowUrgencyOf) — a goal can be 'overdue' here
// without being Failed, and Failed without this reading 'overdue'. Don't
// key any rule below on data-failed; that mechanism has no say over the icon.
//
// Year/list-level visibility (goal-item.js/list-item.js's `deadlinesVisible`
// property, see deadline-visibility.js) is gated in JS, not CSS — a hidden
// year/list collapses data-urgency to 'none' before it ever reaches here, so
// no rule below matches and the icon simply never shows. That used to be a
// CSS-var parameter here instead (goal-item's `--goal-deadline-display`);
// moved to JS so it correctly suppresses data-failed's full-row-red too, not
// just this icon.
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
       urgency. far/month/week stay plain (transparent background, tinted
       glyph only) — those three have no notification equivalent and aren't
       part of this redesign. tomorrow/today/overdue are the three tiers
       aligned 1:1 with the internal notification digest's own Overdue/
       Today/Tomorrow sections (see notification-digest.js) — escalating
       plain-red -> filled-red-pill -> filled-pill-with-red-glyph,
       deliberately with no orange anywhere in that escalation (the old
       amber --color-tomorrow mix read as confusable with 'week's own
       amber). 'overdue's pill background (--color-overdue-bg) is a
       per-theme token, unlike --color-danger driving its own glyph — see
       index.html for why. This trio is entirely independent of the
       full-row-red Failed state (data-failed) — no rule here keys off it,
       and none should. */
    :host([data-urgency="far"])      .urgency-icon { display: block; color: var(--color-text-muted); background: transparent; }
    :host([data-urgency="month"])    .urgency-icon { display: block; color: var(--color-success); background: transparent; }
    :host([data-urgency="week"])     .urgency-icon { display: block; color: var(--color-warning); background: transparent; }
    :host([data-urgency="tomorrow"]) .urgency-icon { display: block; color: var(--color-danger); background: transparent; }
    :host([data-urgency="today"]) .urgency-icon {
      display: block;
      color: var(--color-text-inverse);
      background: var(--color-danger);
    }
    :host([data-urgency="overdue"]) .urgency-icon {
      display: block;
      color: var(--color-danger);
      background: var(--color-overdue-bg);
    }
  `;
}
