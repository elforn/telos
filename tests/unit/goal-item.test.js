// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-item/goal-item.js';
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
});

describe('goal-item — swipe', () => {
  it('bar does not move for dx within dead zone (5px)', () => {
    const el = mount();
    el.onSwipeMove({ dx: 5 });
    expect(el.shadowRoot.querySelector('.bar').style.transform).toBe('translateX(0px)');
  });

  it('right swipe (dx=20) does not move the bar', () => {
    const el = mount();
    el.onSwipeMove({ dx: 20 });
    expect(el.shadowRoot.querySelector('.bar').style.transform).toBe('translateX(0px)');
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

  it('right swipe does not commit', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 160, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('fast flick commits despite short distance', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 10, velocity: 0.5 });
    expect(el._revealedDir).toBe('left');
  });

  it('_closeReveal applies spring snap-back transition', () => {
    const el = mount();
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.bar').style.transition)
      .toBe('transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)');
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

  it('aria-label includes the current-period count and target', () => {
    const el = mount(weeklyGoal([isoDaysFromNow(0), isoDaysFromNow(-1)], 3));
    expect(el.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toContain('2 of 3');
  });

  it('aria-label gets a logged-today suffix only when logged', () => {
    const logged = mount(weeklyGoal([isoDaysFromNow(0)]));
    expect(logged.shadowRoot.querySelector('.bar').getAttribute('aria-label')).toContain('logged today');
    const notLogged = mount(weeklyGoal([]));
    expect(notLogged.shadowRoot.querySelector('.bar').getAttribute('aria-label')).not.toContain('logged today');
  });

  it('renders 5 history dots plus one today token', () => {
    const el = mount(weeklyGoal());
    expect(el.shadowRoot.querySelectorAll('.freq-dots .freq-dot')).toHaveLength(5);
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
    expect(Number(rx)).toBe(8);
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
