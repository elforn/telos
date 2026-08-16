// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, setState, getState, reset } from '../../_lib/core/store/store.js';
import '../../app/strings.js';
import '../../app/pages/home-page.js';
import '../../app/components/goal-item/goal-item.js';
import '../../app/components/year-header/year-header.js';
import '../../app/components/goal-dialog/goal-dialog.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

vi.mock('../../app/utils/handoff.js', () => ({
  buildGoalHandoff: vi.fn(goal => ({ __telosHandoff: true, kind: 'goal', goal })),
  buildYearHandoff: vi.fn((year, yearGoals) => ({ __telosHandoff: true, kind: 'year', goals: { [year]: yearGoals } })),
  shareHandoff: vi.fn().mockResolvedValue(true),
}));

import { buildGoalHandoff, buildYearHandoff, shareHandoff } from '../../app/utils/handoff.js';

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
  // export-sheet's native <dialog> lives two shadow levels in (export-sheet -> modal-dialog -> dialog).
  const goalExportSheet = el.shadowRoot.querySelector('#goal-export-sheet');
  const innerDialog = goalExportSheet?.shadowRoot?.querySelector('#sheet')?.shadowRoot?.querySelector('dialog');
  if (innerDialog) { innerDialog.showModal = () => {}; innerDialog.close = () => {}; }
  return el;
}

afterEach(() => { document.body.innerHTML = ''; reset(); vi.clearAllMocks(); });

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

describe('home-page — accent color defaults', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--color-app-accent');
    document.documentElement.style.removeProperty('--color-app-accent-light');
  });

  it('reads default --color-accent from the --color-app-accent custom property (no per-app hardcoded hex)', async () => {
    document.documentElement.style.setProperty('--color-app-accent', '#123456');
    document.documentElement.style.setProperty('--color-app-accent-light', '#abcdef');
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() => expect(el.style.getPropertyValue('--color-accent')).toBe('#123456'));
    expect(el.style.getPropertyValue('--color-accent-light')).toBe('#abcdef');
  });
});

describe('home-page — store integration', () => {
  it('renders capstone goal-items when goals set via setState', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'Grand Capstone', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('capstone section loses empty class when goals exist', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-section').classList.contains('empty')).toBe(false)
    );
  });

  it('renders milestone goal-items when milestones set', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [{ id: 'm1', title: 'Q1 target', tracking: { type: 'percentage', value: 0 } }], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('renders wow goal-items when wow set', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [], wow: [{ id: 'w1', title: 'First marathon', tracking: { type: 'percentage', value: 0 } }] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#wow-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });

  it('does not show milestones for a different year', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2025': { capstone: [], milestones: [{ id: 'm1', title: 'Past milestone', tracking: { type: 'percentage', value: 0 } }], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#milestone-section').classList.contains('empty')).toBe(true)
    );
  });

  it('keeps the milestone add-row open after tapping add (quick-add from the first entry)', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount();
    // stub the goal-dialog's native <dialog> so open() doesn't need real showModal
    const dlg = el.shadowRoot.querySelector('#dialog').shadowRoot
      .querySelector('#modal').shadowRoot.querySelector('dialog');
    if (dlg) { dlg.showModal = () => {}; dlg.close = () => {}; }
    el.shadowRoot.querySelector('#add-milestone').click();
    expect(el.shadowRoot.querySelector('#milestone-section').classList.contains('add-open')).toBe(true);
  });

  it('removes goal-item when milestone deleted via setState', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', {
      '2026': { capstone: [], milestones: [{ id: 'm1', title: 'Q1', tracking: { type: 'percentage', value: 0 } }], wow: [] },
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
      '2026': { capstone: [], milestones: [], wow: [], focus: [{ id: 'f1', title: 'Daily habit', tracking: { type: 'percentage', value: 0 } }] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#focus-list').querySelectorAll('goal-item').length).toBe(1)
    );
  });
});

describe('home-page — goal mutations', () => {
  it('adds a capstone goal when goal-created fires after clicking add', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true, detail: { title: 'New Capstone' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    const item = el.shadowRoot.querySelector('#capstone-list goal-item');
    expect(item._goal.title).toBe('New Capstone');
    expect(item._goal.tracking.value).toBe(0);
  });

  it('edits title when goal-title-changed fires after goal-tap on existing goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Old Title', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Old Title', tracking: { type: 'percentage', value: 0 } } },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-title-changed', {
      bubbles: true, composed: true, detail: { title: 'New Title' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.title).toBe('New Title')
    );
  });

  it('updates progress when goal-progress fires', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
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
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.tracking.value).toBe(50)
    );
  });

  it('toggles today\'s entry when goal-log-toggle fires from a frequency goal-item', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'weekly', target: 3, entries: [] } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-log-toggle', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1' } },
    }));
    await vi.waitFor(() => {
      const entries = getState().goals['2026'].capstone[0].tracking.entries;
      expect(entries).toHaveLength(1);
    });
  });

  it('goal-log-toggle un-logs when today is already logged', async () => {
    const todayIso = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'weekly', target: 3, entries: [todayIso] } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-log-toggle', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1' } },
    }));
    await vi.waitFor(() => {
      expect(getState().goals['2026'].capstone[0].tracking.entries).toEqual([]);
    });
  });

  it('toggles an arbitrary entry when goal-entry-toggle fires from the dialog', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'weekly', target: 3, entries: [] } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    // goal-tap sets _editingGoal, which goal-entry-toggle relies on (mirrors
    // how goal-tags-changed etc. resolve which goal/section to mutate).
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1', title: 'Goal', tracking: { type: 'weekly', target: 3, entries: [] } } },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-entry-toggle', {
      bubbles: true, composed: true,
      detail: { goal: { id: 'c1' }, iso: '2026-01-05' },
    }));
    await vi.waitFor(() => {
      expect(getState().goals['2026'].capstone[0].tracking.entries).toEqual(['2026-01-05']);
    });
  });

  it('goal-created carries the chosen tracking through to the stored goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: { '2026': { capstone: [], milestones: [], wow: [] } }, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true,
      detail: { title: 'Move my body', notes: undefined, dueDate: undefined, tags: [], tracking: { type: 'weekly', target: 5, entries: [] } },
    }));
    await vi.waitFor(() => {
      const goal = getState().goals['2026'].capstone.find(g => g.title === 'Move my body');
      expect(goal.tracking).toEqual({ type: 'weekly', target: 5, entries: [] });
    });
  });

  it('removes goal when goal-delete fires from goal-item swipe', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
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

  it('stores notes when goal-created includes one', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true, detail: { title: 'Goal', notes: 'Some context' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')?._goal?.notes).toBe('Some context')
    );
  });

  it('stores dueDate when goal-created includes one', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true, detail: { title: 'Goal', dueDate: '2026-12-31' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')?._goal?.dueDate).toBe('2026-12-31')
    );
  });

  it('updates notes when goal-notes-changed fires after goal-tap on existing goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } } },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-notes-changed', {
      bubbles: true, composed: true, detail: { notes: 'Updated notes' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.notes).toBe('Updated notes')
    );
  });

  it('updates dueDate when goal-duedate-changed fires after goal-tap on existing goal', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } } },
    }));
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-duedate-changed', {
      bubbles: true, composed: true, detail: { dueDate: '2026-11-15' },
    }));
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')._goal.dueDate).toBe('2026-11-15')
    );
  });

  it('carries tags and dueDate onto the item created from a goal', async () => {
    await boot({ dbName: freshName(), initialState: {
      goals: {}, images: {},
      lists: [{ id: 'l1', name: 'Groceries', items: [] }],
    } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-create-item', {
      bubbles: true, composed: true,
      detail: {
        goal: { id: 'g1', title: 'Goal', tags: ['garden', 'urgent'], dueDate: '2026-08-01' },
        targetListIds: ['l1'], newListName: null, copy: true,
        fromYear: '2026', fromSection: 'capstone',
      },
    }));
    await vi.waitFor(() => {
      const item = getState().lists[0].items[0];
      expect(item.tags).toEqual(['garden', 'urgent']);
      expect(item.dueDate).toBe('2026-08-01');
    });
  });

  it('removes goal when goal-delete fires from dialog', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    }, images: {} } });
    const el = mount(2026);
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    el.shadowRoot.querySelector('#capstone-list').dispatchEvent(new CustomEvent('goal-tap', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', tracking: { type: 'percentage', value: 0 } } },
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
      '2026': { capstone: [{ id: 'c1', title: 'Before', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(1)
    );
    const original = el.shadowRoot.querySelector('#capstone-list goal-item');
    setState('goals', {
      '2026': { capstone: [{ id: 'c1', title: 'After', tracking: { type: 'percentage', value: 50 } }], milestones: [], wow: [] },
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
        { id: 'c1', title: 'A', tracking: { type: 'percentage', value: 0 } },
        { id: 'c2', title: 'B', tracking: { type: 'percentage', value: 0 } },
      ], milestones: [], wow: [] },
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );
    setState('goals', {
      '2026': { capstone: [{ id: 'c2', title: 'B', tracking: { type: 'percentage', value: 0 } }], milestones: [], wow: [] },
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
      { id: 'c1', title: 'A', tracking: { type: 'percentage', value: 0 } },
      { id: 'c2', title: 'B', tracking: { type: 'percentage', value: 0 } },
      { id: 'c3', title: 'C', tracking: { type: 'percentage', value: 0 } },
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
      { id: 'c1', title: 'A', tracking: { type: 'percentage', value: 0 } },
      { id: 'c2', title: 'B', tracking: { type: 'percentage', value: 0 } },
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
      { id: 'c1', title: 'A', tracking: { type: 'percentage', value: 0 } },
    ], milestones: [
      { id: 'm1', title: 'M', tracking: { type: 'percentage', value: 0 } },
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

// ── home-page — _rebuildTagChips ──────────────────────────────────────────────

describe('home-page — _rebuildTagChips', () => {
  it('creates a chip for each unique tag across goals', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._rebuildTagChips([
      { id: 'g1', title: 'A', tags: ['health', 'finance'] },
      { id: 'g2', title: 'B', tags: ['health'] },
    ]);
    const chips = el.shadowRoot.querySelector('#filter-tag-row').querySelectorAll('.filter-tag-chip');
    expect(chips.length).toBe(2);
  });

  it('sorts tags alphabetically', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._rebuildTagChips([
      { id: 'g1', title: 'A', tags: ['zebra', 'apple', 'mango'] },
    ]);
    const chips = [...el.shadowRoot.querySelector('#filter-tag-row').querySelectorAll('.filter-tag-chip')];
    expect(chips.map(c => c.dataset.tag)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('hides the tag row when no tags are present', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._rebuildTagChips([{ id: 'g1', title: 'A', tags: [] }]);
    expect(el.shadowRoot.querySelector('#filter-tag-row').hidden).toBe(true);
  });

  it('shows the tag row when tags are present', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._rebuildTagChips([{ id: 'g1', title: 'A', tags: ['focus'] }]);
    expect(el.shadowRoot.querySelector('#filter-tag-row').hidden).toBe(false);
  });

  it('marks active chips based on current filter', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._filter.tags = new Set(['health']);
    el._rebuildTagChips([{ id: 'g1', title: 'A', tags: ['health', 'finance'] }]);
    const chips = [...el.shadowRoot.querySelector('#filter-tag-row').querySelectorAll('.filter-tag-chip')];
    const healthChip   = chips.find(c => c.dataset.tag === 'health');
    const financeChip  = chips.find(c => c.dataset.tag === 'finance');
    expect(healthChip.classList.contains('active')).toBe(true);
    expect(financeChip.classList.contains('active')).toBe(false);
  });
});

// ── home-page — _applyGoalFilter ─────────────────────────────────────────────

describe('home-page — _applyGoalFilter', () => {
  it('hides goal-items that do not match the text query', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Run a marathon', tracking: { type: 'percentage', value: 0 }, tags: [] },
      { id: 'c2', title: 'Learn piano',    tracking: { type: 'percentage', value: 0 }, tags: [] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );

    el._filter = { query: 'piano', states: new Set(), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    const marathon = items.find(i => i._goal.title === 'Run a marathon');
    const piano    = items.find(i => i._goal.title === 'Learn piano');
    expect(marathon.hidden).toBe(true);
    expect(piano.hidden).toBe(false);
  });

  it('shows all goal-items when query is empty', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Alpha', tracking: { type: 'percentage', value: 0 }, tags: [] },
      { id: 'c2', title: 'Beta',  tracking: { type: 'percentage', value: 0 }, tags: [] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );

    el._filter = { query: '', states: new Set(), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.every(i => !i.hidden)).toBe(true);
  });

  it('filters by state: "done" shows only 100% goals', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Done goal',    tracking: { type: 'percentage', value: 100 }, tags: [] },
      { id: 'c2', title: 'Ongoing goal', tracking: { type: 'percentage', value: 50 },  tags: [] },
      { id: 'c3', title: 'Fresh goal',   tracking: { type: 'percentage', value: 0 },   tags: [] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );

    el._filter = { query: '', states: new Set(['done']), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Done goal').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Ongoing goal').hidden).toBe(true);
    expect(items.find(i => i._goal.title === 'Fresh goal').hidden).toBe(true);
  });

  it('filters by state: "not-started" shows only 0% goals', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Done',    tracking: { type: 'percentage', value: 100 }, tags: [] },
      { id: 'c2', title: 'Ongoing', tracking: { type: 'percentage', value: 50 },  tags: [] },
      { id: 'c3', title: 'Fresh',   tracking: { type: 'percentage', value: 0 },   tags: [] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );

    el._filter = { query: '', states: new Set(['not-started']), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Fresh').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Done').hidden).toBe(true);
    expect(items.find(i => i._goal.title === 'Ongoing').hidden).toBe(true);
  });

  it('filters by tag: hides goals that do not have the tag', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Health goal',  tracking: { type: 'percentage', value: 0 }, tags: ['health'] },
      { id: 'c2', title: 'Finance goal', tracking: { type: 'percentage', value: 0 }, tags: ['finance'] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );

    el._filter = { query: '', states: new Set(), dates: new Set(), tags: new Set(['health']) };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Health goal').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Finance goal').hidden).toBe(true);
  });

  it('archived goals are hidden by default (no showArchived flag)', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Active goal',   tracking: { type: 'percentage', value: 0 }, tags: [] },
      { id: 'c2', title: 'Archived goal', tracking: { type: 'percentage', value: 0 }, tags: [], archived: true },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );

    el._filter = { query: '', states: new Set(), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Active goal').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Archived goal').hidden).toBe(true);
  });

  it('archived state pill reveals archived goals and hides non-archived', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Active goal',   tracking: { type: 'percentage', value: 0 }, tags: [] },
      { id: 'c2', title: 'Archived goal', tracking: { type: 'percentage', value: 0 }, tags: [], archived: true },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(2)
    );

    el._filter = { query: '', states: new Set(['archived']), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Archived goal').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Active goal').hidden).toBe(true);
  });

  it('archived + done pills are OR: shows archived goals and done non-archived goals', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Done goal',     tracking: { type: 'percentage', value: 100 }, tags: [] },
      { id: 'c2', title: 'Ongoing goal',  tracking: { type: 'percentage', value: 50 },  tags: [] },
      { id: 'c3', title: 'Archived goal', tracking: { type: 'percentage', value: 0 },   tags: [], archived: true },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );

    el._filter = { query: '', states: new Set(['done', 'archived']), dates: new Set(), tags: new Set() };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Done goal').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Ongoing goal').hidden).toBe(true);
    expect(items.find(i => i._goal.title === 'Archived goal').hidden).toBe(false);
  });

  it('combines query and tag filter (AND logic)', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Run daily',    tracking: { type: 'percentage', value: 0 }, tags: ['health'] },
      { id: 'c2', title: 'Run finances', tracking: { type: 'percentage', value: 0 }, tags: ['finance'] },
      { id: 'c3', title: 'Piano',        tracking: { type: 'percentage', value: 0 }, tags: ['health'] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );

    el._filter = { query: 'run', states: new Set(), dates: new Set(), tags: new Set(['health']) };
    el._applyGoalFilter();

    const items = [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    expect(items.find(i => i._goal.title === 'Run daily').hidden).toBe(false);
    expect(items.find(i => i._goal.title === 'Run finances').hidden).toBe(true);
    expect(items.find(i => i._goal.title === 'Piano').hidden).toBe(true);
  });

  it('filters by deadline: "overdue" and "none" pills', async () => {
    const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    setState('goals', { '2026': { capstone: [
      { id: 'c1', title: 'Overdue goal', tracking: { type: 'percentage', value: 20 }, tags: [], dueDate: iso(-2) },
      { id: 'c2', title: 'Soon goal',    tracking: { type: 'percentage', value: 20 }, tags: [], dueDate: iso(20) },
      { id: 'c3', title: 'No-date goal', tracking: { type: 'percentage', value: 20 }, tags: [] },
    ], milestones: [], wow: [], focus: [] } });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item').length).toBe(3)
    );
    const items = () => [...el.shadowRoot.querySelector('#capstone-list').querySelectorAll('goal-item')];
    const byTitle = t => items().find(i => i._goal.title === t);

    el._filter = { query: '', states: new Set(), dates: new Set(['overdue']), tags: new Set() };
    el._applyGoalFilter();
    expect(byTitle('Overdue goal').hidden).toBe(false);
    expect(byTitle('Soon goal').hidden).toBe(true);
    expect(byTitle('No-date goal').hidden).toBe(true);

    el._filter = { query: '', states: new Set(), dates: new Set(['none']), tags: new Set() };
    el._applyGoalFilter();
    expect(byTitle('No-date goal').hidden).toBe(false);
    expect(byTitle('Overdue goal').hidden).toBe(true);
  });
});

describe('home-page — create with active filter', () => {
  it('shows a hidden-by-filter toast whose Show action reveals the new goal', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._filter = { query: '', states: new Set(['done']), dates: new Set(), tags: new Set() };
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true, detail: { title: 'Invisible goal' },
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-info');
      expect(toastEl?.textContent).toContain('hidden by the current filter');
    });
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')?.hidden).toBe(true)
    );

    document.querySelector('#toast-container .socle-toast-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#capstone-list goal-item')?.hidden).toBe(false)
    );
  });

  it('keeps the saved toast when the new goal matches the active filter', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    const el = mount(2026);
    el._filter = { query: '', states: new Set(['not-started']), dates: new Set(), tags: new Set() };
    el.shadowRoot.querySelector('#add-capstone').click();
    el.shadowRoot.dispatchEvent(new CustomEvent('goal-created', {
      bubbles: true, composed: true, detail: { title: 'Visible goal' },
    }));

    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('Goal saved');
    });
    expect(el.shadowRoot.querySelector('#capstone-list goal-item')?.hidden).toBe(false);
  });
});

describe('home-page — share goal', () => {
  it('shares the goal via goal-share-request from the dialog', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {
      '2026': { capstone: [{ id: 'c1', title: 'Goal', tags: [], tracking: { type: 'percentage', value: 40 } }], milestones: [], wow: [] },
    } } });
    const el = mount(2026);
    const goal = { id: 'c1', title: 'Goal', tags: [], tracking: { type: 'percentage', value: 40 } };
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-share-request', {
      bubbles: true, composed: true, detail: { goal },
    }));
    await vi.waitFor(() => expect(shareHandoff).toHaveBeenCalledOnce());
    expect(buildGoalHandoff).toHaveBeenCalledWith(goal);
    expect(shareHandoff.mock.calls[0][1]).toBe('Goal');
  });

  it('toasts an error if sharing the goal fails', async () => {
    _resetToast();
    shareHandoff.mockRejectedValueOnce(new Error('share failed'));
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-share-request', {
      bubbles: true, composed: true, detail: { goal: { id: 'c1', title: 'Goal', tags: [], tracking: { type: 'percentage', value: 0 } } },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});

describe('home-page — share goal markdown', () => {
  let writeText;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('builds markdown for the goal and copies it (no navigator.share in this environment)', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    const goal = { id: 'c1', title: 'Run a 5k', tags: [], tracking: { type: 'percentage', value: 40 } };
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-export-request', {
      bubbles: true, composed: true, detail: { goal },
    }));
    el.shadowRoot.querySelector('#goal-export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain('Run a 5k');
  });

  it('shows the copied toast after the clipboard fallback', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    const goal = { id: 'c1', title: 'Run a 5k', tags: [], tracking: { type: 'percentage', value: 40 } };
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-export-request', {
      bubbles: true, composed: true, detail: { goal },
    }));
    el.shadowRoot.querySelector('#goal-export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('Copied to clipboard');
    });
  });

  it('does nothing if extract-confirm fires without a prior goal-export-request', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('#goal-export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await new Promise(r => setTimeout(r, 0));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('toasts an error if the clipboard write rejects', async () => {
    _resetToast();
    writeText.mockRejectedValueOnce(new Error('denied'));
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    const goal = { id: 'c1', title: 'Run a 5k', tags: [], tracking: { type: 'percentage', value: 40 } };
    el.shadowRoot.querySelector('#dialog').dispatchEvent(new CustomEvent('goal-export-request', {
      bubbles: true, composed: true, detail: { goal },
    }));
    el.shadowRoot.querySelector('#goal-export-sheet').dispatchEvent(new CustomEvent('extract-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});

describe('home-page — share year', () => {
  it('shares the whole current year via year-share-request from year-header', async () => {
    const yearGoals = { capstone: [{ id: 'c1', title: 'Goal', tags: [], tracking: { type: 'percentage', value: 40 } }], milestones: [], wow: [], focus: [] };
    await boot({ dbName: freshName(), initialState: { goals: { '2026': yearGoals } } });
    const el = mount(2026);
    el.shadowRoot.querySelector('year-header').dispatchEvent(new CustomEvent('year-share-request', {
      bubbles: true, composed: true,
    }));
    await vi.waitFor(() => expect(shareHandoff).toHaveBeenCalledOnce());
    expect(buildYearHandoff).toHaveBeenCalledWith(2026, expect.objectContaining({ capstone: yearGoals.capstone }));
    expect(shareHandoff.mock.calls[0][1]).toBe('2026');
  });

  it('toasts an error if sharing the year fails', async () => {
    _resetToast();
    shareHandoff.mockRejectedValueOnce(new Error('share failed'));
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('year-header').dispatchEvent(new CustomEvent('year-share-request', {
      bubbles: true, composed: true,
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});

describe('home-page — export year markdown', () => {
  let writeText;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('builds markdown for the whole year and copies it (no navigator.share in this environment)', async () => {
    const yearGoals = { capstone: [{ id: 'c1', title: 'Run a 5k', tags: [], tracking: { type: 'percentage', value: 40 } }], milestones: [], wow: [], focus: [] };
    await boot({ dbName: freshName(), initialState: { goals: { '2026': yearGoals } } });
    const el = mount(2026);
    el.shadowRoot.querySelector('year-header').dispatchEvent(new CustomEvent('year-export-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain('Run a 5k');
  });

  it('shows the copied toast after the clipboard fallback', async () => {
    _resetToast();
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('year-header').dispatchEvent(new CustomEvent('year-export-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-success');
      expect(toastEl?.textContent).toContain('Copied to clipboard');
    });
  });

  it('toasts an error if the clipboard write rejects', async () => {
    _resetToast();
    writeText.mockRejectedValueOnce(new Error('denied'));
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    const el = mount(2026);
    el.shadowRoot.querySelector('year-header').dispatchEvent(new CustomEvent('year-export-confirm', {
      bubbles: true, composed: true, detail: { metadata: false, notes: false },
    }));
    await vi.waitFor(() => {
      const toastEl = document.querySelector('#toast-container .socle-toast-error');
      expect(toastEl).not.toBeNull();
    });
  });
});
