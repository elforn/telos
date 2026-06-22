// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-item/goal-item.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

function mount(goal = { id: 'g1', title: 'Test goal', percentage: 0 }) {
  const el = document.createElement('goal-item');
  document.body.appendChild(el);
  el.goal = goal;
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('goal-item — structure', () => {
  it('renders a bar with the goal title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Test goal');
  });

  it('renders fill width matching percentage', () => {
    const el = mount({ id: 'g1', title: 'Run', percentage: 40 });
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('40%');
  });

  it('shows 0% fill when no goal set', () => {
    const el = document.createElement('goal-item');
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('0%');
  });

  it('updates when goal prop changes', () => {
    const el = mount({ id: 'g1', title: 'First', percentage: 10 });
    el.goal = { id: 'g1', title: 'Updated', percentage: 50 };
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
    const el = mount({ id: 'g1', title: 'Run', percentage: 30 });
    const events = [];
    el.addEventListener('goal-progress', e => events.push(e));
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(events[0].detail.percentage).toBe(35);
  });

  it('ArrowLeft decreases percentage and emits goal-progress', () => {
    const el = mount({ id: 'g1', title: 'Run', percentage: 30 });
    const events = [];
    el.addEventListener('goal-progress', e => events.push(e));
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    expect(events[0].detail.percentage).toBe(25);
  });

  it('does not go below 0', () => {
    const el = mount({ id: 'g1', title: 'Run', percentage: 0 });
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('0%');
  });

  it('does not exceed 100', () => {
    const el = mount({ id: 'g1', title: 'Run', percentage: 100 });
    el.shadowRoot.querySelector('.bar').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(el.shadowRoot.querySelector('.fill').style.width).toBe('100%');
  });
});

describe('goal-item — hold drag', () => {
  it('emits goal-progress on hold-drag end', async () => {
    const el = mount({ id: 'g1', title: 'Run', percentage: 0 });

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
