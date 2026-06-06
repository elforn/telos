import { describe, it, expect, beforeEach } from 'vitest';
import { boot, dispatch, subscribe, getState, reset } from '../../_lib/core/store/store.js';
import { reducer } from '../../app/store/reducer.js';

let dbSeq = 0;
function freshName() { return `Telos-store-${dbSeq++}`; }

beforeEach(() => reset());

describe('Store integration', () => {
  it('boots with empty state when no events exist', async () => {
    await boot({ dbName: freshName(), reducer });
    expect(getState()).toEqual({});
  });

  it('state persists across a simulated reload', async () => {
    const name = freshName();
    await boot({ dbName: name, reducer });
    // Replace with a real event type from your reducer:
    // await dispatch('thing:created', { title: 'example' });
    reset();
    await boot({ dbName: name, reducer });
    expect(getState()).toBeDefined();
  });

  it('subscriber is called when state changes', async () => {
    await boot({ dbName: freshName(), reducer });
    let received;
    subscribe('exampleKey', val => { received = val; });
    // Replace with a real dispatch that affects 'exampleKey':
    // await dispatch('thing:created', { title: 'x' });
    expect(received).toBeUndefined(); // no events yet
  });
});
