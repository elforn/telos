// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import { septagonWedgeState } from '../../app/components/goal-item/goal-item.js';
import { _resetDeleteGuard } from '../../app/utils/delete-ghost-guard.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

function mount(goal = { id: 'g1', title: 'Test goal', tracking: { type: 'percentage', value: 0 } }) {
  const el = document.createElement('goal-item');
  document.body.appendChild(el);
  el.goal = goal;
  return el;
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Two dates guaranteed to fall in the same ISO week (Mon–Sun) as each other
// and as "today", regardless of which day of the week the suite happens to
// run on — unlike isoDaysFromNow(0) + isoDaysFromNow(-1), which cross a week
// boundary (and silently under-count the current period) whenever today is
// a Monday.
function isoDaysFromWeekStart(days) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + days); // Mon=0..Sun=6
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

afterEach(() => { document.body.innerHTML = ''; _resetDeleteGuard(); });

describe('goal-item — structure', () => {
  it('renders a bar with the goal title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Test goal');
  });

  it('renders fill width matching percentage', () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 40 } });
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('40%');
  });

  it('shows 0% fill when no goal set', () => {
    const el = document.createElement('goal-item');
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('0%');
  });

  it('updates when goal prop changes', () => {
    const el = mount({ id: 'g1', title: 'First', tracking: { type: 'percentage', value: 10 } });
    el.goal = { id: 'g1', title: 'Updated', tracking: { type: 'percentage', value: 50 } };
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Updated');
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('50%');
  });

  it('renders a delete button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn')).not.toBeNull();
  });

  it('delete button contains an svg icon', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn svg')).not.toBeNull();
  });
});

describe('goal-item — deadline urgency', () => {
  it('is none when there is no dueDate', () => {
    expect(mount().dataset.urgency).toBe('none');
  });

  it('classifies the buckets by how soon the deadline is', () => {
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(-1) }).dataset.urgency).toBe('overdue');
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(0) }).dataset.urgency).toBe('today');
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(5) }).dataset.urgency).toBe('week');
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(20) }).dataset.urgency).toBe('month');
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(60) }).dataset.urgency).toBe('far');
  });

  it('is none when complete or archived, even with a past deadline', () => {
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 100 }, dueDate: isoDaysFromNow(-1) }).dataset.urgency).toBe('none');
    expect(mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(-1), archived: true }).dataset.urgency).toBe('none');
  });

  it('describes the urgency in the bar aria-label', () => {
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: isoDaysFromNow(-1) });
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toBe('Goal, overdue');
  });

  it('uses the plain title as aria-label when there is no deadline', () => {
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 0 } });
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toBe('Goal');
  });

  it('updates urgency when the goal property changes', () => {
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 0 } });
    el.goal = { id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 0 }, dueDate: isoDaysFromNow(-1) };
    expect(el.dataset.urgency).toBe('overdue');
  });
});

describe('goal-item — frequency pace urgency, merged with dueDate to whichever is worse', () => {
  // 2026-08-10 is a Monday.
  const MON = new Date(2026, 7, 10);

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the red today state from an Nx-mode weekly goal\'s own pace, with no dueDate at all', () => {
    vi.setSystemTime(new Date(2026, 7, 14)); // Friday — 3 days left, target 3, slack 0
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'weekly', target: 3, value: 0, entries: [], reminderDays: 'any' } });
    expect(el.dataset.urgency).toBe('today');
  });

  it('shows the yellow week state at slack == 1', () => {
    vi.setSystemTime(new Date(2026, 7, 13)); // Thursday — slack 1
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'weekly', target: 3, value: 0, entries: [], reminderDays: 'any' } });
    expect(el.dataset.urgency).toBe('week');
  });

  it('never earns the full-row overdue state from Nx-mode pace alone', () => {
    vi.setSystemTime(new Date(2026, 7, 16)); // Sunday, way behind pace, week almost over
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'weekly', target: 7, value: 0, entries: [], reminderDays: 'any' } });
    expect(el.dataset.urgency).not.toBe('overdue');
  });

  it('goes full-row overdue for a scheduled-days goal the day after a recoverable miss', () => {
    vi.setSystemTime(new Date(2026, 7, 11)); // Tuesday — Monday was scheduled and missed
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'weekly', target: 3, value: 0, entries: [], reminderDays: ['mon', 'wed', 'fri'] } });
    expect(el.dataset.urgency).toBe('overdue');
  });

  it('a monthly goal gets pace urgency unconditionally, with no reminderDays ever set', () => {
    vi.setSystemTime(new Date(2026, 7, 22)); // Aug 22 — 10 days left, target 10, slack 0
    const el = mount({ id: 'g1', title: 'Goal', tracking: { type: 'monthly', target: 10, value: 0, entries: [] } });
    expect(el.dataset.urgency).toBe('today');
  });

  it('takes the worse of dueDate and frequency pace, even before the deadline — a tight deadline wins over quiet pace', () => {
    vi.setSystemTime(MON); // frequency pace is quiet (plenty of slack all week)
    const el = mount({
      id: 'g1', title: 'Goal',
      tracking: { type: 'weekly', target: 1, value: 0, entries: [], reminderDays: 'any' },
      dueDate: '2026-08-14', // 4 days out -> dueDate's own 'week' bucket
    });
    expect(el.dataset.urgency).toBe('week');
  });

  it('a lapsed deadline always wins the merge, overriding Nx-mode\'s own never-overdue rule', () => {
    vi.setSystemTime(MON);
    const el = mount({
      id: 'g1', title: 'Goal',
      tracking: { type: 'weekly', target: 1, value: 0, entries: [], reminderDays: 'any' },
      dueDate: '2026-08-01',
    });
    expect(el.dataset.urgency).toBe('overdue');
  });

  it('percentage and decreasing goals are unaffected — dueDate urgency alone, as before', () => {
    vi.setSystemTime(MON);
    const pct = mount({ id: 'g1', title: 'Goal', tracking: { type: 'percentage', value: 40 }, dueDate: '2026-08-14' });
    expect(pct.dataset.urgency).toBe('week');
  });
});

describe('goal-item — tap', () => {
  it('dispatches goal-tap on tap', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-tap', e => events.push(e));
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal.title).toBe('Test goal');
  });

  it('dispatches goal-tap on Enter key', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-tap', e => events.push(e));
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(events).toHaveLength(1);
  });
});

describe('goal-item — buttons', () => {
  it('dispatches goal-delete on first click of delete button', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal.id).toBe('g1');
  });
});

describe('goal-item — keyboard', () => {
  it('ArrowRight increases percentage and emits goal-progress', () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 30 } });
    const events = [];
    el.addEventListener('goal-progress', e => events.push(e));
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(events[0].detail.percentage).toBe(35);
  });

  it('ArrowLeft decreases percentage and emits goal-progress', () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 30 } });
    const events = [];
    el.addEventListener('goal-progress', e => events.push(e));
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    expect(events[0].detail.percentage).toBe(25);
  });

  it('does not go below 0', () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 0 } });
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('0%');
  });

  it('does not exceed 100', () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 100 } });
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('100%');
  });
});

describe('goal-item — hold drag', () => {
  it('emits goal-progress on hold-drag end', async () => {
    const el = mount({ id: 'g1', title: 'Run', tracking: { type: 'percentage', value: 0 } });

    el.shadowRoot.querySelector('.bar').getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 40 });

    const events = [];
    el.addEventListener('goal-progress', e => events.push(e));

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
    await vi.waitFor(() => expect(el.classList.contains('hold-active')).toBe(true), { timeout: 600 });
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));

    expect(events).toHaveLength(1);
    expect(events[0].detail.percentage).toBe(50);
  });

  it('a decreasing goal ignores drag entirely — hold toggles instead of scrubbing', async () => {
    const el = mount({ id: 'g1', title: 'No ice cream', tracking: { type: 'decreasing', target: 0, entries: [] } });
    el.shadowRoot.querySelector('.bar').getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 40 });

    const progressEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-progress', e => progressEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
    await vi.waitFor(() => expect(toggleEvents).toHaveLength(1), { timeout: 600 });
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));

    expect(progressEvents).toHaveLength(0);
    expect(el.classList.contains('hold-active')).toBe(false);
  });
});

describe('goal-item — swipe', () => {
  it('bar does not move for dx within dead zone (5px)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 5 });
    expect(el.shadowRoot.querySelector('.bar').style.transform).toBe('translateX(0px)');
  });

  it('right swipe past dead zone moves the bar right (dx=20 → offset 5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 20 });
    expect(el.shadowRoot.querySelector('.bar').style.transform).toBe('translateX(5px)');
  });

  it('bar moves negatively by dx plus dead zone when swiping left past dead zone (dx=-20)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -20 });
    expect(el.shadowRoot.querySelector('.bar').style.transform).toBe('translateX(-5px)');
  });

  it('short left swipe does not commit (distance 119, below 2× reveal width)', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 119, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('left swipe at exactly 2× reveal width (120px) commits', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 120, velocity: 0 });
    expect(el._revealedDir).toBe('left');
  });

  it('right swipe past commit threshold never persists a reveal (colour cycle is momentary)', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 160, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('fast flick commits despite short distance', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 10, velocity: 0.5 });
    expect(el._revealedDir).toBe('left');
  });

  it('_closeReveal applies spring snap-back transition when reduced motion is off', () => {
    const el = mount();
    window.matchMedia = () => ({ matches: false });
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.bar').style.transition)
      .toBe('transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)');
  });

  it('_closeReveal uses transition:none when prefers-reduced-motion is set', () => {
    const el = mount();
    window.matchMedia = () => ({ matches: true });
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.bar').style.transition).toBe('none');
  });
});

describe('goal-item — colour', () => {
  it('right swipe at 2× colour-panel width (96px) dispatches goal-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal.id).toBe('g1');
  });

  it('right swipe below commit threshold does not dispatch goal-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 95, velocity: 0 });
    expect(events).toHaveLength(0);
  });

  it('fast right flick commits colour cycle regardless of distance', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 10, velocity: 0.5 });
    expect(events).toHaveLength(1);
  });

  it('left swipe does not dispatch goal-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('goal-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'left', distance: 160, velocity: 0 });
    expect(events).toHaveLength(0);
  });

  it('applies colour to bar via CSS custom property', () => {
    const el = mount({ id: 'g1', title: 'Move my body', color: '#ff0000', tracking: { type: 'percentage', value: 0 } });
    const val = el.shadowRoot.querySelector('.bar').style.getPropertyValue('--goal-item-color');
    expect(val).toBe('#ff0000');
  });

  it('applies transparent when no colour set', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('.bar').style.getPropertyValue('--goal-item-color');
    expect(val).toBe('transparent');
  });

  it('sets color-panel background when goal has a colour', () => {
    const el = mount({ id: 'g1', title: 'Move my body', color: '#3DAD6A', tracking: { type: 'percentage', value: 0 } });
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('#3DAD6A');
  });

  it('removes color-panel background when goal has no colour', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('');
  });
});

function weeklyGoal(entries = [], target = 3, extra = {}) {
  return { id: 'g1', title: 'Move my body', tracking: { type: 'weekly', target, entries }, ...extra };
}
function monthlyGoal(entries = [], target = 4, extra = {}) {
  return { id: 'g1', title: 'Call parents', tracking: { type: 'monthly', target, entries }, ...extra };
}

describe('goal-item — frequency: role, aria, rendering', () => {
  it('uses role=button with aria-pressed instead of role=slider', () => {
    const el = mount(weeklyGoal());
    const bar = el.shadowRoot.querySelector('.bar');
    expect(bar.getAttribute('role')).toBe('button');
    expect(bar.hasAttribute('aria-valuemin')).toBe(false);
    expect(bar.hasAttribute('aria-valuemax')).toBe(false);
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.getAttribute('aria-pressed')).toBe('false');
  });

  it('percentage goals keep role=slider, no aria-pressed', () => {
    const el = mount({ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 40 } });
    const bar = el.shadowRoot.querySelector('.bar');
    expect(bar.getAttribute('role')).toBe('slider');
    expect(bar.hasAttribute('aria-pressed')).toBe(false);
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
  });

  it('aria-pressed reflects whether today is logged', () => {
    const el = mount(weeklyGoal([isoDaysFromNow(0)]));
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-pressed')).toBe('true');
  });

  it('un-logging today flips aria-pressed back and removes the green ring, not just the tick state', () => {
    const el = mount(weeklyGoal([isoDaysFromNow(0)]));
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-pressed')).toBe('true');
    expect(el.shadowRoot.querySelector('.freq-today').classList.contains('logged')).toBe(true);

    el.goal = weeklyGoal([]);

    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-pressed')).toBe('false');
    expect(el.shadowRoot.querySelector('.freq-today').classList.contains('logged')).toBe(false);
  });

  it('aria-label includes the current-period count and target', () => {
    const el = mount(weeklyGoal([isoDaysFromWeekStart(0), isoDaysFromWeekStart(1)], 3));
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toContain('2 of 3');
  });

  it('aria-label gets a logged-today suffix only when logged', () => {
    const logged = mount(weeklyGoal([isoDaysFromNow(0)]));
    expect(logged.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toContain('logged today');
    const notLogged = mount(weeklyGoal([]));
    expect(notLogged.shadowRoot.querySelector('.bar').getAttribute('aria-label')).not.toContain('logged today');
  });

  it('renders 5 history dots plus one today token when the oldest tracked week has an entry (nothing trimmed)', () => {
    const el = mount(weeklyGoal([isoDaysFromWeekStart(-35)])); // the oldest of the 6 tracked weeks
    expect(el.shadowRoot.querySelectorAll('.freq-dots .freq-dot')).toHaveLength(5);
    expect(el.shadowRoot.querySelector('.freq-today .freq-dot')).not.toBeNull();
  });

  it('renders only the today token when there is no history at all — recentDots trims the leading empty run', () => {
    const el = mount(weeklyGoal()); // no entries anywhere, including this week
    expect(el.shadowRoot.querySelectorAll('.freq-dots .freq-dot')).toHaveLength(0);
    expect(el.shadowRoot.querySelector('.freq-today .freq-dot')).not.toBeNull();
  });

  it('weekly renders the today token as a circle (rx = half the box)', () => {
    const el = mount(weeklyGoal());
    const rx = el.shadowRoot.querySelector('.freq-ring .progress').getAttribute('rx');
    expect(Number(rx)).toBeGreaterThan(15); // full circle, not the squircle radius
  });

  it('monthly renders the today token as a squircle (small rx)', () => {
    const el = mount(monthlyGoal());
    const rx = el.shadowRoot.querySelector('.freq-ring .progress').getAttribute('rx');
    expect(Number(rx)).toBe(7);
  });

  it('bar[data-freq] and data-freq-type reflect the tracking type', () => {
    const weekly = mount(weeklyGoal());
    expect(weekly.shadowRoot.querySelector('.bar').dataset.freq).toBe('true');
    expect(weekly.shadowRoot.querySelector('.bar').dataset.freqType).toBe('weekly');
    const pctEl = mount({ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 } });
    expect(pctEl.shadowRoot.querySelector('.bar').dataset.freq).toBe('false');
  });
});

describe('goal-item — frequency: tap still edits, hold logs', () => {
  it('tap still dispatches goal-tap (unchanged) for a frequency goal', () => {
    const el = mount(weeklyGoal());
    const events = [];
    el.addEventListener('goal-tap', e => events.push(e));
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
    expect(events).toHaveLength(1);
  });

  it('hold-drag on a frequency goal dispatches goal-log-toggle, not goal-progress', async () => {
    const el = mount(weeklyGoal());
    const progressEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-progress', e => progressEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
    await vi.waitFor(() => expect(toggleEvents).toHaveLength(1), { timeout: 600 });
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));

    expect(progressEvents).toHaveLength(0);
    expect(toggleEvents[0].detail.goal.id).toBe('g1');
  });

  it('hold does not add hold-active (no scrub mode for frequency goals)', async () => {
    const el = mount(weeklyGoal());
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
    await new Promise(r => setTimeout(r, 600));
    expect(el.classList.contains('hold-active')).toBe(false);
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
  });

  it('ArrowRight and ArrowLeft both dispatch goal-log-toggle (a toggle, not a scrub)', () => {
    const el = mount(weeklyGoal());
    const events = [];
    el.addEventListener('goal-log-toggle', e => events.push(e));
    const bar = el.shadowRoot.querySelector('.bar');
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(events).toHaveLength(2);
  });

  it('a plain tap on the today token dispatches goal-log-toggle, not goal-tap', () => {
    const el = mount(weeklyGoal());
    const tapEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-tap', e => tapEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    const today = el.shadowRoot.querySelector('.freq-today');
    const rect = today.getBoundingClientRect();
    const opts = { bubbles: true, composed: true, clientX: rect.x, clientY: rect.y, pointerId: 1, button: 0 };
    today.dispatchEvent(new PointerEvent('pointerdown', opts));
    today.dispatchEvent(new PointerEvent('pointerup', opts));

    expect(toggleEvents).toHaveLength(1);
    expect(tapEvents).toHaveLength(0);
  });

  it('a plain tap elsewhere on the bar still dispatches goal-tap, not goal-log-toggle', () => {
    const el = mount(weeklyGoal());
    const tapEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-tap', e => tapEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    const title = el.shadowRoot.querySelector('.title');
    const opts = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    title.dispatchEvent(new PointerEvent('pointerdown', opts));
    title.dispatchEvent(new PointerEvent('pointerup', opts));

    expect(tapEvents).toHaveLength(1);
    expect(toggleEvents).toHaveLength(0);
  });

  it('holding on the today token still dispatches goal-log-toggle (hold path unaffected)', async () => {
    const el = mount(weeklyGoal());
    const toggleEvents = [];
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    const today = el.shadowRoot.querySelector('.freq-today');
    const opts = { bubbles: true, composed: true, clientX: 10, clientY: 10, pointerId: 1, button: 0 };
    today.dispatchEvent(new PointerEvent('pointerdown', opts));
    await vi.waitFor(() => expect(toggleEvents).toHaveLength(1), { timeout: 600 });
    today.dispatchEvent(new PointerEvent('pointerup', opts));
  });
});

function decreasingGoal(entries = [], target = 0, extra = {}) {
  return { id: 'g1', title: 'No ice cream', tracking: { type: 'decreasing', target, entries }, ...extra };
}

describe('goal-item — decreasing: rendering', () => {
  it('sets data-type="decreasing" and data-freq="false"', () => {
    const el = mount(decreasingGoal());
    const bar = el.shadowRoot.querySelector('.bar');
    expect(bar.dataset.type).toBe('decreasing');
    expect(bar.dataset.freq).toBe('false');
  });

  it('other types still set data-type correctly (percentage, weekly, monthly)', () => {
    expect(mount({ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 } })
      .shadowRoot.querySelector('.bar').dataset.type).toBe('percentage');
    expect(mount(weeklyGoal()).shadowRoot.querySelector('.bar').dataset.type).toBe('weekly');
    expect(mount(monthlyGoal()).shadowRoot.querySelector('.bar').dataset.type).toBe('monthly');
  });

  it('renders 6 septagons, the last one carrying the "current" class', () => {
    const el = mount(decreasingGoal());
    const weeks = el.shadowRoot.querySelectorAll('.septagon-strip .septagon-week');
    expect(weeks).toHaveLength(6);
    expect([...weeks].filter(w => w.classList.contains('current'))).toHaveLength(1);
    expect(weeks[weeks.length - 1].classList.contains('current')).toBe(true);
  });

  it('septagonWedgeState resolves the day\'s tracked state, with `future` always overriding it (a not-yet-elapsed day never shows as clean/within/over)', () => {
    expect(septagonWedgeState({ state: 'clean', future: false })).toBe('clean');
    expect(septagonWedgeState({ state: 'within', future: false })).toBe('within');
    expect(septagonWedgeState({ state: 'over', future: false })).toBe('over');
    expect(septagonWedgeState({ state: 'clean', future: true })).toBe('future');
  });

  it('a clean goal\'s current week is 7 wedges, each data-state "clean" or "future" — no within-dot, no second hue anywhere', () => {
    const el = mount(decreasingGoal());
    const current = el.shadowRoot.querySelector('.septagon-week.current .septagon-fill');
    const wedges = [...current.querySelectorAll('path')];
    expect(wedges).toHaveLength(7);
    wedges.forEach(w => expect(['clean', 'future']).toContain(w.getAttribute('data-state')));
    wedges.forEach(w => expect(w.getAttribute('fill')).toBeNull()); // fill/stroke always come from CSS, never inline
    expect(current.querySelector('.septagon-within-dot')).toBeNull();
    expect(current.outerHTML).not.toContain('--color-success');
    expect(current.outerHTML).not.toContain('--color-warning');
    expect(current.outerHTML).not.toContain('--color-danger');
  });

  it('a slip within the allowance renders that wedge data-state="within", solid-filled via CSS (no inline fill override) plus a knockout dot marking it', () => {
    const el = mount(decreasingGoal([isoDaysFromNow(0)], 1)); // allowance 1, 1 slip today -> within
    const current = el.shadowRoot.querySelector('.septagon-week.current .septagon-fill');
    const wedge = current.querySelector('path[data-state="within"]');
    expect(wedge).not.toBeNull();
    expect(wedge.getAttribute('fill')).toBeNull(); // fill comes from the CSS rule, same as "clean"
    expect(current.querySelectorAll('.septagon-within-dot')).toHaveLength(1);
  });

  it('a slip past the allowance renders that wedge data-state="over", solid-filled via CSS same as clean/within (no inline fill override, never a second hue)', () => {
    const el = mount(decreasingGoal([isoDaysFromNow(0)], 0)); // allowance 0 -> any slip is immediately over
    const current = el.shadowRoot.querySelector('.septagon-week.current .septagon-fill');
    const wedge = current.querySelector('path[data-state="over"]');
    expect(wedge).not.toBeNull();
    expect(wedge.getAttribute('fill')).toBeNull(); // fill/stroke both come from the CSS [data-state="over"] rule
    expect(current.querySelector('.septagon-within-dot')).toBeNull(); // "over" never also gets the within-dot
    expect(current.outerHTML).not.toContain('--color-success');
    expect(current.outerHTML).not.toContain('--color-warning');
    expect(current.outerHTML).not.toContain('--color-danger');
  });

  it('no <pattern>/<defs> anywhere in the strip — the hollow-wedge "over" state needs no per-instance SVG defs, unlike the hatch fill it replaced', () => {
    const el = mount(decreasingGoal([isoDaysFromWeekStart(0)], 0)); // a slip early this week -> "over" in the current septagon
    const fills = [...el.shadowRoot.querySelectorAll('.septagon-strip .septagon-fill')];
    expect(fills).toHaveLength(6);
    fills.forEach(f => {
      expect(f.querySelector('pattern')).toBeNull();
      expect(f.querySelector('defs')).toBeNull();
    });
  });

  it('history weeks are a plain filled heptagon with no separate border/ring element — only the current week ever gets a ring', () => {
    const el = mount(decreasingGoal());
    const weeks = [...el.shadowRoot.querySelectorAll('.septagon-strip .septagon-week')];
    const history = weeks.slice(0, -1);
    history.forEach(week => {
      expect(week.children).toHaveLength(1); // just .septagon-fill, nothing else
      expect(week.querySelector('.septagon-ring')).toBeNull();
    });
  });

  it('the current septagon has a separate SVG ring element (not a rim/background trick), invisible until today has a recorded slip', () => {
    const clean = mount(decreasingGoal([]));
    const cleanCurrent = clean.shadowRoot.querySelector('.septagon-week.current');
    expect(cleanCurrent.querySelector('.septagon-ring')).not.toBeNull();
    expect(cleanCurrent.classList.contains('logged')).toBe(false);

    const logged = mount(decreasingGoal([isoDaysFromNow(0)]));
    expect(logged.shadowRoot.querySelector('.septagon-week.current').classList.contains('logged')).toBe(true);
  });

  it('keeps the percentage label hidden, same as frequency types — the septagon strip carries the score instead', () => {
    const el = mount(decreasingGoal());
    expect(el.shadowRoot.querySelector('.pct-label').hidden).toBe(true);
  });
});

describe('goal-item — decreasing: role, aria', () => {
  it('uses role=button with aria-pressed, same as frequency types', () => {
    const el = mount(decreasingGoal());
    const bar = el.shadowRoot.querySelector('.bar');
    expect(bar.getAttribute('role')).toBe('button');
    expect(bar.hasAttribute('aria-valuemin')).toBe(false);
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.getAttribute('aria-pressed')).toBe('false');
  });

  it('aria-pressed reflects whether today is logged', () => {
    const el = mount(decreasingGoal([isoDaysFromNow(0)]));
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-pressed')).toBe('true');
  });

  it('aria-label includes the percent-clean, slip count, and allowance', () => {
    const el = mount(decreasingGoal([isoDaysFromWeekStart(0)], 1));
    const label = el.shadowRoot.querySelector('.bar').getAttribute('aria-label');
    expect(label).toContain('% clean');
    expect(label).toContain('1 slips this week');
    expect(label).toContain('1 allowed');
  });

  it('aria-label gets a slipped-today suffix only when logged', () => {
    const logged = mount(decreasingGoal([isoDaysFromNow(0)]));
    expect(logged.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toContain('slipped today');
    const clean = mount(decreasingGoal([]));
    expect(clean.shadowRoot.querySelector('.bar').getAttribute('aria-label')).not.toContain('slipped today');
  });
});

describe('goal-item — decreasing: tap/hold', () => {
  it('a plain tap on the current septagon dispatches goal-log-toggle, not goal-tap', () => {
    const el = mount(decreasingGoal());
    const tapEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-tap', e => tapEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    const current = el.shadowRoot.querySelector('.septagon-week.current');
    const opts = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    current.dispatchEvent(new PointerEvent('pointerdown', opts));
    current.dispatchEvent(new PointerEvent('pointerup', opts));

    expect(toggleEvents).toHaveLength(1);
    expect(tapEvents).toHaveLength(0);
  });

  it('a plain tap on a history septagon (read-only) still dispatches goal-tap, not goal-log-toggle', () => {
    const el = mount(decreasingGoal());
    const tapEvents = [];
    const toggleEvents = [];
    el.addEventListener('goal-tap', e => tapEvents.push(e));
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));

    const weeks = el.shadowRoot.querySelectorAll('.septagon-strip .septagon-week');
    const history = weeks[0]; // oldest, not .current
    const opts = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    history.dispatchEvent(new PointerEvent('pointerdown', opts));
    history.dispatchEvent(new PointerEvent('pointerup', opts));

    expect(tapEvents).toHaveLength(1);
    expect(toggleEvents).toHaveLength(0);
  });

  it('a plain tap elsewhere on the bar still dispatches goal-tap', () => {
    const el = mount(decreasingGoal());
    const tapEvents = [];
    el.addEventListener('goal-tap', e => tapEvents.push(e));
    const title = el.shadowRoot.querySelector('.title');
    const opts = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    title.dispatchEvent(new PointerEvent('pointerdown', opts));
    title.dispatchEvent(new PointerEvent('pointerup', opts));
    expect(tapEvents).toHaveLength(1);
  });

  it('holding anywhere on the bar dispatches goal-log-toggle, no scrub/hold-active, and the fill width does not change', async () => {
    const el = mount(decreasingGoal());
    const toggleEvents = [];
    const progressEvents = [];
    el.addEventListener('goal-log-toggle', e => toggleEvents.push(e));
    el.addEventListener('goal-progress', e => progressEvents.push(e));

    const widthBefore = el.shadowRoot.querySelector('.fill').style.width;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
    await vi.waitFor(() => expect(toggleEvents).toHaveLength(1), { timeout: 600 });
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 20, pointerId: 1, button: 0 }));

    expect(el.classList.contains('hold-active')).toBe(false);
    expect(progressEvents).toHaveLength(0);
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe(widthBefore);
  });

  it('ArrowRight and ArrowLeft both dispatch goal-log-toggle (a toggle, not a scrub)', () => {
    const el = mount(decreasingGoal());
    const events = [];
    el.addEventListener('goal-log-toggle', e => events.push(e));
    const bar = el.shadowRoot.querySelector('.bar');
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(events).toHaveLength(2);
  });
});

describe('goal-item — decreasing: log tick', () => {
  it('adds .log-tick when a slip is logged for today', () => {
    const el = mount(decreasingGoal([]));
    expect(el.classList.contains('log-tick')).toBe(false);
    el.goal = decreasingGoal([isoDaysFromNow(0)]);
    expect(el.classList.contains('log-tick')).toBe(true);
  });

  it('does not re-trigger .log-tick when un-logging', () => {
    const el = mount(decreasingGoal([isoDaysFromNow(0)]));
    el.classList.remove('log-tick'); // isolate from any mount-time state
    el.goal = decreasingGoal([]);
    expect(el.classList.contains('log-tick')).toBe(false);
  });
});

describe('goal-item — frequency: log tick + celebration', () => {
  it('adds .log-tick when the goal transitions into logged-today', () => {
    const el = mount(weeklyGoal([]));
    expect(el.classList.contains('log-tick')).toBe(false);
    el.goal = weeklyGoal([isoDaysFromNow(0)]);
    expect(el.classList.contains('log-tick')).toBe(true);
  });

  it('does not add .log-tick on the initial mount, even if already logged', () => {
    const el = mount(weeklyGoal([isoDaysFromNow(0)]));
    expect(el.classList.contains('log-tick')).toBe(false);
  });

  it('does not re-trigger .log-tick when un-logging', () => {
    const el = mount(weeklyGoal([isoDaysFromNow(0)]));
    el.classList.remove('log-tick'); // isolate from any mount-time state
    el.goal = weeklyGoal([]);
    expect(el.classList.contains('log-tick')).toBe(false);
  });

  it('triggers the big celebration when the whole window becomes fully met', () => {
    // 5 closed periods already met (weekly, one per week for 5 weeks back) plus
    // today — logging today completes the 6th and final window period.
    const closed = [1, 2, 3, 4, 5].map(w => isoDaysFromNow(-w * 7));
    const el = mount(weeklyGoal(closed, 1));
    expect(el.classList.contains('celebrating')).toBe(false);
    el.goal = weeklyGoal([...closed, isoDaysFromNow(0)], 1);
    expect(el.classList.contains('celebrating')).toBe(true);
  });
});
