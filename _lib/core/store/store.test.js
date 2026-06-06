import { describe, it, expect, beforeEach, vi } from 'vitest';
import { boot, dispatch, subscribe, unsubscribe, getState, setState, reset, attachBlob, getBlob, deleteBlob, getAllEvents, getAllBlobs, importEvents } from './store.js';

let dbSeq = 0;
function freshName() { return `test-store-${dbSeq++}`; }

function reducer(state, event) {
  switch (event.type) {
    case 'item:added':
      return { ...state, items: [...(state.items ?? []), event.payload] };
    case 'count:incremented':
      return { ...state, count: (state.count ?? 0) + 1 };
    default:
      return state;
  }
}

beforeEach(() => reset());

describe('boot', () => {
  it('initialises state to the result of reducing all existing events', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    expect(getState()).toEqual({});
  });

  it('replays persisted events on second boot', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    await dispatch('item:added', { title: 'hello' });
    reset();
    await boot({ dbName: name, reducer });
    expect(getState().items).toHaveLength(1);
    expect(getState().items[0].title).toBe('hello');
  });
});

describe('dispatch', () => {
  it('updates state after dispatch', async () => {
    await boot({ dbName: freshName(), reducer });
    await dispatch('item:added', { title: 'x' });
    expect(getState().items).toHaveLength(1);
  });

  it('writes an event with all required fields', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer, deviceId: 'dev-1' });
    const before = Date.now();
    await dispatch('count:incremented', { n: 1 });
    reset();
    let captured;
    await boot({ dbName: name, reducer: (s, e) => { captured = e; return s; } });
    expect(captured).toMatchObject({
      id: expect.any(String),
      deviceId: 'dev-1',
      recordedAt: expect.any(Number),
      occurredAt: expect.any(Number),
      type: 'count:incremented',
      payload: { n: 1 },
    });
    expect(captured.recordedAt).toBeGreaterThanOrEqual(before);
  });

  it('deviceId defaults to null when not provided', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    await dispatch('count:incremented', {});
    reset();
    let captured;
    await boot({ dbName: name, reducer: (s, e) => { captured = e; return s; } });
    expect(captured.deviceId).toBeNull();
  });

  it('throws if called before boot', async () => {
    await expect(dispatch('item:added', {})).rejects.toThrow('before Store.boot');
  });

  it('accepts a custom occurredAt', async () => {
    await boot({ dbName: freshName(), reducer });
    const past = Date.now() - 10000;
    await dispatch('item:added', { title: 'past' }, past);
    expect(getState().items[0].title).toBe('past');
  });

  it('stamps deviceId from boot config', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer, deviceId: 'device-abc' });
    await dispatch('count:incremented', {});
    reset();
    // re-boot and check the raw event via a capturing reducer
    let captured;
    await boot({
      dbName: name,
      reducer: (s, e) => { captured = e; return s; },
      deviceId: 'device-abc',
    });
    expect(captured.deviceId).toBe('device-abc');
  });
});

describe('boot — error handling', () => {
  it('rejects when migrations fail, leaving app unstarted', async () => {
    await expect(
      boot({ dbName: freshName(), version: 99, reducer })
    ).rejects.toThrow('No migration defined for schema version');
  });
});

describe('subscribe / unsubscribe', () => {
  it('calls callback immediately with current value', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('items', cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it('calls callback when subscribed key changes', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('items', cb);
    cb.mockClear();
    await dispatch('item:added', { title: 'y' });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0]).toHaveLength(1);
  });

  it('does not call callback when a different key changes', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('items', cb);
    cb.mockClear();
    await dispatch('count:incremented', {});
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not call callback after unsubscribe', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('items', cb);
    unsubscribe('items', cb);
    cb.mockClear();
    await dispatch('item:added', { title: 'z' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('calls all subscribers when a key changes', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribe('items', cb1);
    subscribe('items', cb2);
    cb1.mockClear();
    cb2.mockClear();
    await dispatch('item:added', { title: 'multi' });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('unsubscribe on a key with no registered callbacks does not throw', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    expect(() => unsubscribe('nonexistent', cb)).not.toThrow();
  });
});

describe('setState', () => {
  it('updates the value returned by getState', async () => {
    await boot({ dbName: freshName(), reducer });
    setState('updateAvailable', true);
    expect(getState().updateAvailable).toBe(true);
  });

  it('notifies subscribers for the changed key', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('updateAvailable', cb);
    cb.mockClear();
    setState('updateAvailable', true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('does not notify subscribers for unchanged keys', async () => {
    await boot({ dbName: freshName(), reducer });
    const cb = vi.fn();
    subscribe('items', cb);
    cb.mockClear();
    setState('updateAvailable', true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('is cleared by reset', async () => {
    await boot({ dbName: freshName(), reducer });
    setState('updateAvailable', true);
    reset();
    await boot({ dbName: freshName(), reducer });
    expect(getState().updateAvailable).toBeUndefined();
  });
});

describe('blob storage', () => {
  beforeEach(async () => {
    await boot({ dbName: freshName(), reducer });
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
    const result = await getBlob('missing');
    expect(result).toBeNull();
  });

  it('deleteBlob removes the blob', async () => {
    const blob = new Blob(['data']);
    await attachBlob('img-2', blob);
    await deleteBlob('img-2');
    const result = await getBlob('img-2');
    expect(result).toBeNull();
  });

  it('throws when called before boot', async () => {
    reset();
    await expect(attachBlob('x', new Blob())).rejects.toThrow('Store.attachBlob called before Store.boot');
    await expect(getBlob('x')).rejects.toThrow('Store.getBlob called before Store.boot');
    await expect(deleteBlob('x')).rejects.toThrow('Store.deleteBlob called before Store.boot');
  });
});

describe('importEvents', () => {
  it('writes events as-is to IDB, readable on next boot', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    const foreign = [
      { id: 'evt-1', deviceId: 'other', recordedAt: 1000, occurredAt: 1000, type: 'item:added', payload: { title: 'imported' } },
    ];
    await importEvents(foreign);
    reset();
    await boot({ dbName: name, reducer });
    expect(getState().items[0].title).toBe('imported');
  });

  it('is idempotent — importing the same event twice does not duplicate', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    const evt = { id: 'evt-x', deviceId: null, recordedAt: 1000, occurredAt: 1000, type: 'item:added', payload: { title: 'x' } };
    await importEvents([evt]);
    await importEvents([evt]);
    reset();
    await boot({ dbName: name, reducer });
    expect(getState().items).toHaveLength(1);
  });

  it('throws when called before boot', async () => {
    reset();
    await expect(importEvents([])).rejects.toThrow('Store.importEvents called before Store.boot');
  });
});

describe('getAllEvents', () => {
  it('returns all dispatched events sorted by recordedAt', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    await dispatch('item:added', { title: 'a' });
    await dispatch('item:added', { title: 'b' });
    const events = await getAllEvents();
    expect(events).toHaveLength(2);
    expect(events[0].recordedAt).toBeLessThanOrEqual(events[1].recordedAt);
  });

  it('returns empty array when no events exist', async () => {
    await boot({ dbName: freshName(), reducer });
    expect(await getAllEvents()).toEqual([]);
  });

  it('throws when called before boot', async () => {
    reset();
    await expect(getAllEvents()).rejects.toThrow('Store.getAllEvents called before Store.boot');
  });
});

describe('getAllBlobs', () => {
  it('returns all stored blobs', async () => {
    await boot({ dbName: freshName(), reducer });
    await attachBlob('b1', new Blob(['x'], { type: 'text/plain' }));
    await attachBlob('b2', new Blob(['y'], { type: 'text/plain' }));
    const blobs = await getAllBlobs();
    expect(blobs).toHaveLength(2);
    expect(blobs.map(b => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('returns empty array when no blobs exist', async () => {
    await boot({ dbName: freshName(), reducer });
    expect(await getAllBlobs()).toEqual([]);
  });

  it('throws when called before boot', async () => {
    reset();
    await expect(getAllBlobs()).rejects.toThrow('Store.getAllBlobs called before Store.boot');
  });
});
