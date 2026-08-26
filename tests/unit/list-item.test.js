// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/list-item/list-item.js';
import { _resetDeleteGuard } from '../../app/utils/delete-ghost-guard.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const ITEM = { id: 'i1', title: 'Buy flowers', status: 'open', tags: [], inGoals: [] };

function mount(item = ITEM) {
  const el = document.createElement('list-item');
  document.body.appendChild(el);
  el.item = item;
  return el;
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tap(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
  el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
}

afterEach(() => { document.body.innerHTML = ''; _resetDeleteGuard(); });

describe('list-item — structure', () => {
  it('renders the item title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Buy flowers');
  });

  it('renders the status badge text', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Open');
  });

  it('sets data-status attribute on badge', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('open');
  });

  it('renders paused status correctly', () => {
    const el = mount({ ...ITEM, status: 'paused' });
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Paused');
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('paused');
  });

  it('renders done status correctly', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Done');
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('done');
  });

  it('has a delete button', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn')).not.toBeNull();
  });

  it('delete button contains an svg icon', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#delete-btn svg')).not.toBeNull();
  });

  it('has role=listitem on host', () => {
    const el = mount();
    expect(el.getAttribute('role')).toBe('listitem');
  });

  it('updates title when item property changes', () => {
    const el = mount();
    el.item = { ...ITEM, title: 'Updated title' };
    expect(el.shadowRoot.querySelector('.title').textContent).toBe('Updated title');
  });

  it('updates badge when status changes', () => {
    const el = mount();
    el.item = { ...ITEM, status: 'done' };
    expect(el.shadowRoot.querySelector('.badge').dataset.status).toBe('done');
    expect(el.shadowRoot.querySelector('.badge').textContent).toBe('Done');
  });

  it('note icon is hidden when item has no note', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('false');
  });

  it('note icon is visible when item has a note', () => {
    const el = mount({ ...ITEM, note: 'A reminder' });
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('true');
  });

  it('note icon updates when note is added', () => {
    const el = mount();
    el.item = { ...ITEM, note: 'New note' };
    expect(el.shadowRoot.querySelector('.row').dataset.hasNote).toBe('true');
  });

  it('url icon is hidden when item has no url', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').dataset.hasUrl).toBe('false');
  });

  it('url icon is visible when item has a url', () => {
    const el = mount({ ...ITEM, url: 'https://example.com' });
    expect(el.shadowRoot.querySelector('.row').dataset.hasUrl).toBe('true');
  });
});

describe('list-item — due-date urgency', () => {
  const urgency = el => el.dataset.urgency;

  it('is none when there is no dueDate', () => {
    expect(urgency(mount())).toBe('none');
  });

  it('classifies the buckets by how soon the date is', () => {
    expect(urgency(mount({ ...ITEM, dueDate: isoDaysFromNow(-1) }))).toBe('overdue');
    expect(urgency(mount({ ...ITEM, dueDate: isoDaysFromNow(0) }))).toBe('today');
    expect(urgency(mount({ ...ITEM, dueDate: isoDaysFromNow(5) }))).toBe('week');
    expect(urgency(mount({ ...ITEM, dueDate: isoDaysFromNow(20) }))).toBe('month');
    expect(urgency(mount({ ...ITEM, dueDate: isoDaysFromNow(60) }))).toBe('far');
  });

  it('is none for done or closed items, even with a past date', () => {
    expect(urgency(mount({ ...ITEM, status: 'done', dueDate: isoDaysFromNow(-1) }))).toBe('none');
    expect(urgency(mount({ ...ITEM, status: 'closed', dueDate: isoDaysFromNow(-1) }))).toBe('none');
  });

  it('describes the urgency in the row aria-label', () => {
    const el = mount({ ...ITEM, dueDate: isoDaysFromNow(-1) });
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Buy flowers, overdue');
  });

  it('uses the plain title as aria-label when there is no date', () => {
    expect(mount().shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Buy flowers');
  });

  it('updates urgency when the item property changes', () => {
    const el = mount();
    el.item = { ...ITEM, dueDate: isoDaysFromNow(-1) };
    expect(urgency(el)).toBe('overdue');
  });
});

describe('list-item — item-tap event', () => {
  it('dispatches item-tap on tap', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events).toHaveLength(1);
  });

  it('item-tap detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events[0].detail.item.id).toBe('i1');
    expect(events[0].detail.item.title).toBe('Buy flowers');
  });

  it('item-tap bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-tap', e => events.push(e));
    tap(el);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

describe('list-item — item-delete event', () => {
  it('dispatches item-delete on first click of delete button', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events).toHaveLength(1);
  });

  it('item-delete detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('item-delete bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('does not dispatch item-tap on either delete click', () => {
    const el = mount();
    const tapEvents = [];
    el.addEventListener('item-tap', e => tapEvents.push(e));
    el.shadowRoot.querySelector('#delete-btn').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 })
    );
    el.shadowRoot.querySelector('#delete-btn').click();
    el.shadowRoot.querySelector('#delete-btn').click();
    expect(tapEvents).toHaveLength(0);
  });
});

describe('list-item — item-color-cycle event', () => {
  it('dispatches item-color-cycle on right swipe past commit threshold (96px)', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
    expect(events).toHaveLength(1);
  });

  it('item-color-cycle detail contains the item', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('item-color-cycle bubbles and is composed', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('short right swipe (95px) does not dispatch item-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 95, velocity: 0 });
    expect(events).toHaveLength(0);
  });

  it('fast right flick dispatches item-color-cycle despite short distance', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'right', distance: 10, velocity: 0.5 });
    expect(events).toHaveLength(1);
  });

  it('left swipe does not dispatch item-color-cycle', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-color-cycle', e => events.push(e));
    el.onSwipe({ direction: 'left', distance: 160, velocity: 0 });
    expect(events).toHaveLength(0);
  });
});

describe('list-item — colour', () => {
  it('applies colour to row via CSS custom property', () => {
    const el = mount({ ...ITEM, color: '#ff0000' });
    const val = el.shadowRoot.querySelector('.row').style.getPropertyValue('--item-color');
    expect(val).toBe('#ff0000');
  });

  it('applies transparent when no colour set', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('.row').style.getPropertyValue('--item-color');
    expect(val).toBe('transparent');
  });

  it('sets color-panel background when item has a colour', () => {
    const el = mount({ ...ITEM, color: '#3DAD6A' });
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('#3DAD6A');
  });

  it('removes color-panel background when item has no colour', () => {
    const el = mount();
    const val = el.shadowRoot.querySelector('#color-panel').style.getPropertyValue('--color-panel-bg');
    expect(val).toBe('');
  });
});

describe('list-item — done row styling', () => {
  it('row has data-status="done" when item is done', () => {
    const el = mount({ ...ITEM, status: 'done' });
    expect(el.shadowRoot.querySelector('.row').dataset.status).toBe('done');
  });

  it('row has data-status="open" for open items', () => {
    const el = mount({ ...ITEM, status: 'open' });
    expect(el.shadowRoot.querySelector('.row').dataset.status).toBe('open');
  });
});

describe('list-item — aria labels', () => {
  it('row has aria-label matching item title', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('Buy flowers');
  });

  it('row aria-label updates when title changes', () => {
    const el = mount();
    el.item = { ...ITEM, title: 'New title' };
    expect(el.shadowRoot.querySelector('.row').getAttribute('aria-label')).toBe('New title');
  });
});

describe('list-item — swipe', () => {
  it('row does not move for dx within dead zone (dx=-5)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -5 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(0px)');
  });

  it('row moves left by dx plus dead zone when swiping left past dead zone (dx=-20)', () => {
    const el = mount();
    el.onSwipeMove({ dx: -20 });
    expect(el.shadowRoot.querySelector('.row').style.transform).toBe('translateX(-5px)');
  });

  it('left swipe at exactly 2× delete width (120px) commits reveal', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 120, velocity: 0 });
    expect(el._revealedDir).toBe('left');
  });

  it('left swipe at 119px does not commit', () => {
    const el = mount();
    el.onSwipe({ direction: 'left', distance: 119, velocity: 0 });
    expect(el._revealedDir).toBeNull();
  });

  it('right swipe always snaps back (never reveals)', () => {
    const el = mount();
    el.onSwipe({ direction: 'right', distance: 96, velocity: 0 });
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
    expect(el.shadowRoot.querySelector('.row').style.transition)
      .toBe('transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)');
  });

  it('_closeReveal uses transition:none when prefers-reduced-motion is set', () => {
    const el = mount();
    window.matchMedia = () => ({ matches: true });
    el._closeReveal();
    expect(el.shadowRoot.querySelector('.row').style.transition).toBe('none');
  });
});

describe('list-item — pointerup fires actions', () => {
  it('dispatches item-delete on single pointerup', async () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail.item.id).toBe('i1');
  });

  it('keyboard click (detail=0) dispatches item-delete on first press', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    expect(events).toHaveLength(1);
  });

  it('pointerup followed by synthesized click (detail=1) fires exactly once', async () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    const btn = el.shadowRoot.querySelector('#delete-btn');
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });
});

// ── Selection mode ────────────────────────────────────────────────────────────

describe('list-item — selection mode', () => {
  it('selected property adds .selected class to host', () => {
    const el = mount();
    el.selected = true;
    expect(el.classList.contains('selected')).toBe(true);
  });

  it('selected = false removes .selected class', () => {
    const el = mount();
    el.selected = true;
    el.selected = false;
    expect(el.classList.contains('selected')).toBe(false);
  });

  it('selected property sets aria-selected attribute', () => {
    const el = mount();
    el.selected = true;
    expect(el.getAttribute('aria-selected')).toBe('true');
    el.selected = false;
    expect(el.getAttribute('aria-selected')).toBe('false');
  });

  it('tap in selection mode emits item-select-toggle instead of item-tap', () => {
    const el = mount();
    el.selectionMode = true;
    const taps   = [];
    const toggles = [];
    el.addEventListener('item-tap',           e => taps.push(e));
    el.addEventListener('item-select-toggle', e => toggles.push(e));
    tap(el);
    expect(taps).toHaveLength(0);
    expect(toggles).toHaveLength(1);
    expect(toggles[0].detail.item).toEqual(ITEM);
  });

  it('tap outside selection mode still emits item-tap', () => {
    const el = mount();
    el.selectionMode = false;
    const taps = [];
    el.addEventListener('item-tap', e => taps.push(e));
    tap(el);
    expect(taps).toHaveLength(1);
  });

  it('item-select-toggle is bubbles and composed', () => {
    const el = mount();
    el.selectionMode = true;
    const events = [];
    el.addEventListener('item-select-toggle', e => events.push(e));
    tap(el);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('onLongPress dispatches item-long-press with item detail', () => {
    const el = mount();
    const events = [];
    el.addEventListener('item-long-press', e => events.push(e));
    el.onLongPress();
    expect(events).toHaveLength(1);
    expect(events[0].detail.item).toEqual(ITEM);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});
