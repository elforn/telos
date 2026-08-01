// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildListHandoff, buildItemHandoff, buildItemsHandoff, buildGoalHandoff, buildYearHandoff, shareHandoff } from '../../app/utils/handoff.js';

const realShare     = navigator.share;
const realCanShare  = navigator.canShare;
const realClipboard = navigator.clipboard;

afterEach(() => {
  navigator.share    = realShare;
  navigator.canShare = realCanShare;
  Object.defineProperty(navigator, 'clipboard', { value: realClipboard, configurable: true });
  vi.restoreAllMocks();
});

describe('buildListHandoff', () => {
  it('wraps the list under a lists key and strips inGoals from every item', () => {
    const list = { id: 'l1', name: 'Groceries', items: [{ id: 'i1', title: 'Milk', inGoals: [{ year: '2026', section: 'focus', goalId: 'g1' }] }] };
    const payload = buildListHandoff(list);
    expect(payload).toMatchObject({ __telosHandoff: true, kind: 'list' });
    expect(payload.lists).toHaveLength(1);
    expect(payload.lists[0].id).toBe('l1');
    expect(payload.lists[0].items[0].inGoals).toEqual([]);
  });
});

describe('buildItemHandoff', () => {
  it('carries a bare item with inGoals stripped', () => {
    const item = { id: 'i1', title: 'Milk', inGoals: [{ year: '2026', section: 'focus', goalId: 'g1' }] };
    const payload = buildItemHandoff(item);
    expect(payload).toEqual({ __telosHandoff: true, kind: 'item', item: { ...item, inGoals: [] } });
  });
});

describe('buildItemsHandoff', () => {
  it('carries an array of bare items with inGoals stripped from each', () => {
    const items = [
      { id: 'i1', title: 'Milk', inGoals: [{ year: '2026', section: 'focus', goalId: 'g1' }] },
      { id: 'i2', title: 'Eggs', inGoals: [] },
    ];
    const payload = buildItemsHandoff(items);
    expect(payload).toEqual({
      __telosHandoff: true,
      kind: 'items',
      items: [{ ...items[0], inGoals: [] }, { ...items[1], inGoals: [] }],
    });
  });
});

describe('buildGoalHandoff', () => {
  it('carries a bare goal unchanged', () => {
    const goal = { id: 'g1', title: 'Run a marathon', tags: [], percentage: 40 };
    expect(buildGoalHandoff(goal)).toEqual({ __telosHandoff: true, kind: 'goal', goal });
  });
});

describe('buildYearHandoff', () => {
  it('nests the year goals under a goals key by year', () => {
    const yearGoals = { capstone: [{ id: 'c1', title: 'Capstone', tags: [], percentage: 50 }], milestones: [], wow: [], focus: [] };
    const payload = buildYearHandoff(2027, yearGoals);
    expect(payload).toEqual({
      __telosHandoff: true,
      kind: 'year',
      goals: { '2027': yearGoals },
    });
  });

  it('coerces a numeric year to a string key', () => {
    const payload = buildYearHandoff(2027, { capstone: [], milestones: [], wow: [], focus: [] });
    expect(Object.keys(payload.goals)).toEqual(['2027']);
  });
});

// shareHandoff shares/downloads a plain-text .txt file, not the ZIP format
// exportData uses for full backups — .txt/text/plain is on Chromium's
// share-file allowlist (confirmed via source), unlike zip, which canShare()
// accepted but share() always rejected with NotAllowedError regardless of
// MIME label.
describe('shareHandoff', () => {
  it('shares a .txt file with the socleVersion/events envelope wrapping the payload', async () => {
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share    = vi.fn().mockResolvedValue(undefined);

    await shareHandoff({ __telosHandoff: true, kind: 'list', lists: [] }, 'Groceries');

    expect(navigator.share).toHaveBeenCalledOnce();
    const [{ files, title }] = navigator.share.mock.calls[0];
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toMatch(/^\d+_telos-list-groceries\.txt$/);
    expect(files[0].type).toBe('text/plain');
    expect(title).toBe('Groceries');

    const text = await files[0].text();
    const envelope = JSON.parse(text);
    expect(envelope.socleVersion).toBe(1);
    expect(envelope.events).toEqual([
      { type: 'simple:state', payload: { __telosHandoff: true, kind: 'list', lists: [] } },
    ]);
  });

  it('slugifies the share title into the filename', async () => {
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share    = vi.fn().mockResolvedValue(undefined);
    await shareHandoff({ kind: 'item' }, 'Milk & Eggs!');
    const [{ files }] = navigator.share.mock.calls[0];
    expect(files[0].name).toMatch(/^\d+_telos-item-milk-eggs\.txt$/);
  });

  it('falls back to a text download when navigator.share/canShare is unavailable', async () => {
    navigator.canShare = undefined;
    navigator.share    = undefined;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await shareHandoff({ kind: 'goal' }, 'Run a marathon');
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('returns without downloading when the user cancels the share sheet', async () => {
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share    = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await shareHandoff({ kind: 'goal' }, 'Run a marathon');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('falls back to download on a genuine share failure (not a user cancel)', async () => {
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share    = vi.fn().mockRejectedValue(new Error('boom'));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await shareHandoff({ kind: 'goal' }, 'Run a marathon');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(consoleErr).toHaveBeenCalled();
  });
});
