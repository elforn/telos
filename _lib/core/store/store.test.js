import { describe, it, expect, beforeEach, vi } from 'vitest';
import { boot, setState, getState, subscribe, unsubscribe, attachBlob, getBlob, deleteBlob, reset,
  getAllBlobs, getAllEvents, importEvents } from './store-simple.js';

let dbSeq = 0;
function freshName() { return `test-store-simple-${dbSeq++}`; }

beforeEach(reset);

describe('boot', () => {
  it('starts with empty state when no initialState provided', async () => {
    await boot({ dbName: freshName() });
    expect(getState()).toEqual({});
  });

  it('starts from initialState when no stored state exists', async () => {
    await boot({ dbName: freshName(), initialState: { count: 0, items: [] } });
    expect(getState()).toEqual({ count: 0, items: [] });
  });

  it('restores persisted state across two boots', async () => {
    const name = freshName();
    await boot({ dbName: name });
    setState('count', 42);
    await reset();
    await boot({ dbName: name });
    expect(getState().count).toBe(42);
  });

  it('merges: stored values win over initialState defaults', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { count: 0 } });
    setState('count', 7);
    await reset();
    await boot({ dbName: name, initialState: { count: 0, newKey: 'default' } });
    expect(getState().count).toBe(7);
    expect(getState().newKey).toBe('default');
  });
});

describe('setState', () => {
  it('updates the value returned by getState', async () => {
    await boot({ dbName: freshName() });
    setState('flag', true);
    expect(getState().flag).toBe(true);
  });

  it('persists — value survives a reset + reboot', async () => {
    const name = freshName();
    await boot({ dbName: name });
    setState('score', 99);
    await reset();
    await boot({ dbName: name });
    expect(getState().score).toBe(99);
  });

  it('notifies subscribers for the changed key', async () => {
    await boot({ dbName: freshName() });
    const cb = vi.fn();
    subscribe('flag', cb);
    cb.mockClear();
    setState('flag', true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('does not notify subscribers for unchanged keys', async () => {
    await boot({ dbName: freshName() });
    const cb = vi.fn();
    subscribe('items', cb);
    cb.mockClear();
    setState('flag', true);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('subscribe / unsubscribe', () => {
  it('calls callback immediately with current value', async () => {
    await boot({ dbName: freshName(), initialState: { count: 5 } });
    const cb = vi.fn();
    subscribe('count', cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(5);
  });

  it('calls callback immediately with undefined for unknown key', async () => {
    await boot({ dbName: freshName() });
    const cb = vi.fn();
    subscribe('missing', cb);
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it('calls all subscribers when a key changes', async () => {
    await boot({ dbName: freshName() });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribe('count', cb1);
    subscribe('count', cb2);
    cb1.mockClear();
    cb2.mockClear();
    setState('count', 1);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('does not call callback after unsubscribe', async () => {
    await boot({ dbName: freshName() });
    const cb = vi.fn();
    subscribe('count', cb);
    unsubscribe('count', cb);
    cb.mockClear();
    setState('count', 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribe on a key with no registered callbacks does not throw', async () => {
    await boot({ dbName: freshName() });
    expect(() => unsubscribe('nonexistent', vi.fn())).not.toThrow();
  });
});

describe('blob storage', () => {
  beforeEach(async () => {
    await boot({ dbName: freshName() });
  });

  it('attachBlob stores and getBlob retrieves a blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    await attachBlob('img-1', blob);
    const result = await getBlob('img-1');
    expect(result).toBeInstanceOf(Blob);
    const text = await result.text();
    expect(text).toBe('hello');
  });

  it('getBlob returns null for a missing id', async () => {
    expect(await getBlob('missing')).toBeNull();
  });

  it('deleteBlob removes the blob', async () => {
    await attachBlob('img-2', new Blob(['data']));
    await deleteBlob('img-2');
    expect(await getBlob('img-2')).toBeNull();
  });

  it('throws when called before boot', async () => {
    reset();
    await expect(attachBlob('x', new Blob())).rejects.toThrow('Store.attachBlob called before Store.boot');
    await expect(getBlob('x')).rejects.toThrow('Store.getBlob called before Store.boot');
    await expect(deleteBlob('x')).rejects.toThrow('Store.deleteBlob called before Store.boot');
  });
});

describe('sync-compatible API', () => {
  beforeEach(async () => {
    await boot({ dbName: freshName(), initialState: { items: ['a', 'b'] } });
  });

  it('getAllEvents returns a single snapshot event containing current state', async () => {
    const events = await getAllEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('simple:state');
    expect(events[0].payload).toEqual({ items: ['a', 'b'] });
  });

  it('getAllEvents generates a fresh UUID each call (no dedup suppression)', async () => {
    const [e1] = await getAllEvents();
    const [e2] = await getAllEvents();
    expect(e1.id).not.toBe(e2.id);
  });

  it('getAllBlobs returns all attached blobs', async () => {
    await attachBlob('img-1', new Blob(['x'], { type: 'image/jpeg' }));
    await attachBlob('img-2', new Blob(['y'], { type: 'image/png' }));
    const blobs = await getAllBlobs();
    expect(blobs.map(b => b.id).sort()).toEqual(['img-1', 'img-2']);
  });

  it('importEvents writes state to IDB without updating in-memory state', async () => {
    const dbName = freshName();
    reset();
    await boot({ dbName, initialState: { items: [] } });
    const snapshot = [{ id: 'snap', type: 'simple:state', payload: { items: ['restored'] }, recordedAt: 0, occurredAt: 0, deviceId: null }];
    await importEvents(snapshot);
    // In-memory state is NOT updated immediately (must reload, same contract as event-log store)
    expect(getState().items).toEqual([]);
    // But IDB has the new state — verify by rebooting
    reset();
    await boot({ dbName });
    expect(getState().items).toEqual(['restored']);
  });

  it('importEvents ignores events without simple:state type', async () => {
    await importEvents([{ id: 'x', type: 'other:event', payload: { foo: 'bar' } }]);
    // state unchanged
    expect(getState().items).toEqual(['a', 'b']);
  });
});

describe('reset', () => {
  it('clears in-memory state immediately', async () => {
    await boot({ dbName: freshName() });
    setState('x', 1);
    reset();
    expect(getState()).toEqual({});
  });

  it('does not clear IDB — data persists across reset + reboot', async () => {
    const name = freshName();
    await boot({ dbName: name });
    setState('x', 42);
    reset();
    await boot({ dbName: name });
    expect(getState().x).toBe(42);
  });

  it('clears subscriptions', async () => {
    await boot({ dbName: freshName() });
    const cb = vi.fn();
    subscribe('x', cb);
    reset();
    await boot({ dbName: freshName() });
    setState('x', 1);
    expect(cb).toHaveBeenCalledTimes(1); // only the initial call before reset
  });
});
