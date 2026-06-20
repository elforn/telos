// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/home-page.js';
import '../../app/components/goal-item/goal-item.js';
import '../../app/components/year-header/year-header.js';
import '../../app/components/goal-dialog/goal-dialog.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

let dbSeq = 0;
function freshName() { return `home-page-test-${dbSeq++}`; }

function mount(year = 2026) {
  const el = document.createElement('home-page');
  el.params = { year: String(year) };
  document.body.appendChild(el);
  const header = el.shadowRoot.querySelector('year-header');
  if (header) {
    header.shadowRoot.querySelectorAll('dialog').forEach(d => {
      d.showModal = () => {};
      d.close    = () => {};
    });
  }
  return el;
}

afterEach(() => { document.body.innerHTML = ''; reset(); });

describe('home-page — structure', () => {
  it('renders a <main> landmark', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('main')).not.toBeNull();
  });

  it('renders a year-header component', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('year-header')).not.toBeNull();
  });

  it('renders the capstone section', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#capstone-section')).not.toBeNull();
  });

  it('renders milestone and wow sections', () => {
    const el = mount();
    expect(el.shadowRoot.querySelector('#milestone-section')).not.toBeNull();
    expect(el.shadowRoot.querySelector('#wow-section')).not.toBeNull();
  });
});

describe('home-page — store integration', () => {
  it('renders capstone goal-items when goals set via setState', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'Grand Capstone', percentage: 0 }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('capstone section loses empty class when goals exist', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-section').classList.contains('empty')).toBe(false)
    );
  });

  it('renders milestone goal-items when milestones set', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [{ id: 'm1', title: 'Q1 target', percentage: 0 }], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('renders wow goal-items when wow set', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [], wow: [{ id: 'w1', title: 'First marathon', percentage: 0 }] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#wow-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('does not show milestones for a different year', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2025': { capstone: [], milestones: [{ id: 'm1', title: 'Past milestone', percentage: 0 }], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-section').classList.contains('empty')).toBe(true)
    );
  });

  it('removes goal-item when milestone deleted via setState', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [{ id: 'm1', title: 'Q1', percentage: 0 }], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    setState('goals', { '2026': { capstone: [], milestones: [], wow: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-list').querySelectorAll('goal-item').length).toBe(0)
    );
  });

  it('renders focus goal-items when focus set', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [], wow: [], focus: [{ id: 'f1', title: 'Daily habit', percentage: 0 }] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#focus-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });
});

describe('home-page — goal mutations', () => {
  it('adds a capstone goal when goal-saved fires after clicking add', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-saved', {
      bubbles: true, composed: true, detail: { title: 'New Capstone' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    const item = el.shadowRoot.querySelector('#capstone-list goal-item');
    expect(item._goal.title).toBe('New Capstone');
    expect(item._goal.percentage).toBe(0);
  });

  it('edits title when goal-saved fires after goal-tap on existing goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Old Title', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Old Title', percentage: 0 } },
    }));
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-saved', {
      bubbles: true, composed: true, detail: { title: 'New Title' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.title).toBe('New Title')
    );
  });

  it('updates progress when goal-progress fires', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-progress', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1' }, percentage: 50 },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.percentage).toBe(50)
    );
  });

  it('marks goal failed when goal-progress fires with percentage -1', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-progress', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1' }, percentage: -1 },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.percentage).toBe(-1)
    );
  });

  it('removes goal when goal-delete fires from goal-item swipe', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-delete', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1' } },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(0)
    );
  });

  it('stores description when goal-saved includes one', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-saved', {
      bubbles: true, composed: true, detail: { title: 'Goal', description: 'Some context' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')?._goal?.description).toBe('Some context')
    );
  });

  it('updates description when editing an existing goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', percentage: 0 } },
    }));
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-saved', {
      bubbles: true, composed: true, detail: { title: 'Goal', description: 'Updated notes' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.description).toBe('Updated notes')
    );
  });

  it('removes goal when goal-delete fires from dialog', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', percentage: 0 }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', percentage: 0 } },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-delete', {
      bubbles: true, composed: true,
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(0)
    );
  });
});

describe('home-page — _renderList key diffing', () => {
  it('reuses existing goal-item element when goal is updated', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'Before', percentage: 0 }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    const original = el.shadowRoot.querySelector('#capstone-list goal-item');
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'After', percentage: 50 }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.title).toBe('After')
    );
    expect(el.shadowRoot.querySelector('#capstone-list goal-item')).toBe(original);
  });

  it('removes the correct element when one of two goals is deleted', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [
        { id: 'c1', title: 'A', percentage: 0 },
        { id: 'c2', title: 'B', percentage: 0 },
      ], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );
    setState('goals', {
      '2026': { capstone: [{ id: 'c2', title: 'B', percentage: 0 }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.id).toBe('c2');
  });
});

describe('home-page — goal reorder', () => {
  it('_placeGoal reorders within a section', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'A', percentage: 0 },
      { id: 'c2', title: 'B', percentage: 0 },
      { id: 'c3', title: 'C', percentage: 0 },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );
    el._placeGoal('capstone', 0, 'capstone', 3); // move A to end
    await vi.waitFor(() =>
      expect(getState().goals['2026'].capstone.map(g => g.title)).toEqual(['B', 'C', 'A'])
    );
  });

  it('_placeGoal is a no-op when dropping in same position', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'A', percentage: 0 },
      { id: 'c2', title: 'B', percentage: 0 },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );
    el._placeGoal('capstone', 0, 'capstone', 0);
    expect(getState().goals['2026'].capstone.map(g => g.title)).toEqual(['A', 'B']);
  });

  it('_placeGoal moves a goal to a precise position in another section', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'A', percentage: 0 },
    ], milestones: [
      { id: 'm1', title: 'M', percentage: 0 },
    ], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el._placeGoal('capstone', 0, 'milestones', 0); // drop A before M
    await vi.waitFor(() => {
      const goals = getState().goals['2026'];
      expect(goals.capstone).toHaveLength(0);
      expect(goals.milestones.map(g => g.title)).toEqual(['A', 'M']);
    });
  });
});
