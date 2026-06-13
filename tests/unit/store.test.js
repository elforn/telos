import { describe, it, expect, beforeEach } from 'vitest';
import { boot, setState, getState, subscribe, reset } from '../../_lib/core/store/store.js';

let dbSeq = 0;
function freshName() { return `telos-store-${dbSeq++}`; }

beforeEach(() => reset());

describe('Simple store — boot', () => {
  it('boots with initialState when no prior data exists', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    expect(getState()).toEqual({ goals: {}, images: {} });
  });

  it('restores persisted state on a second boot', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { goals: {} } });
    setState('goals', { '2026': { capstone: [{ id: '1', title: 'Persisted', percentage: 0 }], milestones: [], wow: [] } });
    reset();
    await boot({ dbName: name, initialState: { goals: {} } });
    expect(getState().goals?.['2026']?.capstone?.[0]?.title).toBe('Persisted');
  });

  it('merges initialState with stored state, stored values win', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { goals: {}, images: {} } });
    setState('goals', { '2025': { capstone: [], milestones: [], wow: [] } });
    reset();
    await boot({ dbName: name, initialState: { goals: {}, images: {} } });
    expect(getState().goals).toHaveProperty('2025');
    expect(getState().images).toBeDefined();
  });
});

describe('Simple store — SW update race condition', () => {
  it('setState before boot does not corrupt stored data', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { goals: {} } });
    setState('goals', { '2026': { capstone: [{ id: '1', title: 'Race goal' }], milestones: [], wow: [], focus: [] } });
    reset();

    // Simulate sw-manager calling setState before boot — _db is null so the IDB
    // write must fail rather than overwrite the stored goals with {}.
    // Absorb the async rejection from put(null, ...) so Vitest doesn't flag it.
    const rejection = new Promise(r => process.once('unhandledRejection', r));
    setState('updateAvailable', true);
    await rejection;

    await boot({ dbName: name, initialState: { goals: {} } });
    expect(getState().goals?.['2026']?.capstone?.[0]?.title).toBe('Race goal');
  });

  it('setState after boot adds key without wiping stored data', async () => {
    const name = freshName();
    await boot({ dbName: name, initialState: { goals: {} } });
    setState('goals', { '2026': { capstone: [{ id: '1', title: 'Race goal' }], milestones: [], wow: [], focus: [] } });
    reset();

    await boot({ dbName: name, initialState: { goals: {} } });
    // sw-manager fires setState AFTER boot — goals must survive the write
    setState('updateAvailable', true);
    reset();

    await boot({ dbName: name, initialState: { goals: {} } });
    expect(getState().goals?.['2026']?.capstone?.[0]?.title).toBe('Race goal');
  });
});

describe('Simple store — setState / getState', () => {
  it('updates state synchronously', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    setState('goals', { '2026': { capstone: [], milestones: [], wow: [] } });
    expect(getState().goals).toHaveProperty('2026');
  });

  it('notifies subscriber on state change', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {} } });
    let received;
    subscribe('goals', val => { received = val; });
    const goals = { '2026': { capstone: [{ id: '1', title: 'Test', percentage: 0 }], milestones: [], wow: [] } };
    setState('goals', goals);
    expect(received).toEqual(goals);
  });

  it('calls subscriber immediately with current value on subscribe', async () => {
    await boot({ dbName: freshName(), initialState: { goals: { '2026': { capstone: [], milestones: [], wow: [] } } } });
    let received;
    subscribe('goals', val => { received = val; });
    expect(received).toHaveProperty('2026');
  });

  it('does not notify subscriber for an unrelated key change', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    let calls = 0;
    subscribe('goals', () => { calls++; });
    const before = calls;
    setState('images', { '2026': 'some-blob-id' });
    expect(calls).toBe(before);
  });

  it('images key tracks year photo blobId', async () => {
    await boot({ dbName: freshName(), initialState: { goals: {}, images: {} } });
    setState('images', { '2026': 'blob-uuid' });
    expect(getState().images?.['2026']).toBe('blob-uuid');
  });
});
