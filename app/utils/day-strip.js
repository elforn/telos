// Shared 7-slot Mon-Sun visual strip for scheduledDayStates' output (see
// frequency-urgency.js's frequencyMissedDetail) — used by both the
// Upcoming dialog (why a goal is currently behind) and the goal edit
// dialog (a goal's own current-week snapshot). Splice dayStripStyles()
// into the consuming component's own <style> block and call buildDayStrip()
// to get the DOM node — same "shared markup + shared styles, spliced into
// each consumer's own shadow root" pattern as urgency-badge.js.
import { t } from '../../_lib/core/strings.js';

// The visual states are colour-only by design (accepted after /a11y review)
// — the letter glyph itself never changes, so a sighted user's only cue is
// the colour. For non-sighted users the strip carries its own text
// alternative instead: role="img" + a single aria-label naming every day's
// state ("Mon: missed, Tue: logged, ..."), so the whole 7-slot picture is
// exposed as one described unit rather than 7 separate untitled spans —
// screen readers don't descend into an img-role element's children, so the
// single-letter glyphs stay purely visual without needing their own
// aria-hidden. In upcoming-dialog.js the enclosing row button already sets
// its own aria-label (built from frequencyMissedDetail's actionable-only
// summary); a button's aria-label overrides its subtree's accessible name,
// so this strip's label is simply not reached there — no double-announcing.
function buildDayStripLabel(days) {
  return days
    .map(({ wd, state }) => `${t(`goal-dialog.dow-${wd}`)}: ${t(`day-strip.state-${state}`)}`)
    .join(', ');
}

export function buildDayStrip(days) {
  const strip = document.createElement('span');
  strip.className = 'day-strip';
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', buildDayStripLabel(days));
  for (const { wd, state } of days) {
    const slot = document.createElement('span');
    slot.className = `day-slot ${state}`;
    slot.textContent = t(`goal-dialog.reminder-day-${wd}`);
    strip.appendChild(slot);
  }
  return strip;
}

export function dayStripStyles() {
  return `
    .day-strip {
      display: inline-flex;
      gap: 2px;
      vertical-align: middle;
    }

    .day-slot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 14px;
      font-size: var(--font-size-micro);
      font-weight: var(--font-weight-semibold);
    }

    /* Five states, each its own colour — see frequencyMissedDetail's
       scheduledDayStates for what each one means. 'blank' matches the
       host component's own surface exactly (not display:none) so the 7
       slots keep their fixed width/position — position is what
       disambiguates Tue/Thu and Sat/Sun, so a slot that visually
       disappears must still occupy its spot. Assumes the consuming
       component sits on --color-surface (true for anything inside
       modal-dialog, the only place this is used so far). */
    .day-slot.missed      { color: var(--color-danger); }
    .day-slot.success     { color: var(--color-success); }
    .day-slot.unscheduled { color: var(--color-accent); }
    .day-slot.pending     { color: var(--color-border); }
    .day-slot.blank       { color: var(--color-surface); }
  `;
}
