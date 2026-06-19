// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportData, importData, downloadExport, readImportFile, previewImport, applyReplace, applyMerge } from './sync.js';
import { boot, reset, attachBlob, getBlob, getAllEvents, getState } from '../../core/store/store.js';
import * as Store from '../../core/store/store.js';

// dispatch is only exported by the event-log store. In simple-store apps store.js
// doesn't export it — a static import would throw a SyntaxError at module load time.
const { dispatch } = Store;

// happy-dom does not implement URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

let dbSeq = 0;
function freshName() { return `sync-test-${dbSeq++}`; }
const reducer = (s, e) => {
  if (e.type === 'item:added') return { ...s, items: [...(s.items ?? []), e.payload] };
  return s;
};

beforeEach(async () => {
  reset();
  await boot({ dbName: freshName(), reducer });
});

afterEach(() => reset());

// ── Binary export ─────────────────────────────────────────────────────────────

describe('exportData (binary)', () => {
  it('returns a Uint8Array starting with SCLE magic', async () => {
    const result = await exportData();
    expect(result).toBeInstanceOf(Uint8Array);
    // first 4 bytes are uncompressed SCLE magic: S=0x53 C=0x43 L=0x4C E=0x45
    expect(result[0]).toBe(0x53); // S
    expect(result[1]).toBe(0x43); // C
    expect(result[2]).toBe(0x4c); // L
    expect(result[3]).toBe(0x45); // E
    // bytes [4..] are gzip compressed
    expect(result[4]).toBe(0x1f);
    expect(result[5]).toBe(0x8b);
  });

  it.skipIf(!dispatch)('binary round-trip: events survive export → import', async () => {
    await dispatch('item:added', { title: 'hello' });
    const uint8 = await exportData();

    reset();
    await boot({ dbName: freshName(), reducer });

    const result = await importData(uint8);
    expect(result.eventsAdded).toBe(1);
    const all = await getAllEvents();
    expect(all[0].payload.title).toBe('hello');
  });

  it('binary round-trip: blobs survive export → import', async () => {
    const mockBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    vi.spyOn(Store, 'getAllBlobs').mockResolvedValueOnce([{ id: 'img-bin', blob: mockBlob }]);

    const uint8 = await exportData();

    vi.restoreAllMocks();
    reset();
    await boot({ dbName: freshName(), reducer });

    const result = await importData(uint8);
    expect(result.imagesAdded).toBe(1);
    const stored = await getBlob('img-bin');
    expect(stored).toBeTruthy();
    expect(stored.type).toBe('image/jpeg');
  });

  it.skipIf(!dispatch)('skips duplicate events on binary reimport', async () => {
    await dispatch('item:added', { title: 'dup' });
    const uint8 = await exportData();
    const result = await importData(uint8);
    expect(result.eventsAdded).toBe(0);
  });

  it.skipIf(!dispatch)('filters events when eventFilter provided', async () => {
    await dispatch('item:added', { year: '2025', title: 'a' });
    await dispatch('item:added', { year: '2026', title: 'b' });
    const uint8 = await exportData({ eventFilter: e => e.payload.year === '2026' });

    reset();
    await boot({ dbName: freshName(), reducer });
    const result = await importData(uint8);
    expect(result.eventsAdded).toBe(1);
    const all = await getAllEvents();
    expect(all[0].payload.title).toBe('b');
  });
});

// ── Binary import validation ──────────────────────────────────────────────────

describe('importData (binary validation)', () => {
  it('throws on bad magic bytes', async () => {
    // Does not start with SCLE — rejected before any decompression attempt
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    await expect(importData(bad)).rejects.toThrow('Invalid file (bad magic bytes)');
  });

  it('throws on too-short input', async () => {
    await expect(importData(new Uint8Array([1, 2, 3]))).rejects.toThrow('Invalid file (bad magic bytes)');
  });
});

// ── Legacy JSON import ────────────────────────────────────────────────────────

describe('importData (legacy JSON)', () => {
  it('throws for missing socleVersion', async () => {
    await expect(importData({})).rejects.toThrow('Invalid or incompatible');
  });

  it('throws for wrong socleVersion', async () => {
    await expect(importData({ socleVersion: 99 })).rejects.toThrow('Invalid or incompatible');
  });

  it('throws for null input', async () => {
    await expect(importData(null)).rejects.toThrow('Invalid or incompatible');
  });

  it('imports events from legacy JSON payload', async () => {
    const foreign = [
      { id: 'e1', deviceId: null, recordedAt: 1000, occurredAt: 1000, type: 'item:added', payload: { title: 'imported' } },
    ];
    const result = await importData({ socleVersion: 1, events: foreign, images: [] });
    expect(result.eventsAdded).toBe(1);
    expect(result.imagesAdded).toBe(0);
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
  });

  it.skipIf(!dispatch)('skips duplicate events (idempotent on id)', async () => {
    await dispatch('item:added', { title: 'original' });
    const existing = await getAllEvents();
    const result = await importData({ socleVersion: 1, events: existing, images: [] });
    expect(result.eventsAdded).toBe(0);
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
  });

  it('imports blobs from legacy data URL', async () => {
    const payload = {
      socleVersion: 1,
      events: [],
      images: [{ id: 'img-legacy', dataUrl: 'data:image/jpeg;base64,cGl4ZWxz' }],
    };
    const result = await importData(payload);
    expect(result.imagesAdded).toBe(1);
    const blob = await getBlob('img-legacy');
    expect(blob).toBeTruthy();
    expect(blob.type).toBe('image/jpeg');
  });

  it('skips duplicate blobs on second legacy import', async () => {
    const payload = {
      socleVersion: 1,
      events: [],
      images: [{ id: 'img-2', dataUrl: 'data:image/jpeg;base64,cGl4ZWxz' }],
    };
    await importData(payload);
    const result = await importData(payload);
    expect(result.imagesAdded).toBe(0);
  });
});

// ── downloadExport ────────────────────────────────────────────────────────────

describe('downloadExport', () => {
  it('creates an anchor with correct filename and clicks it', () => {
    const clicks = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = () => clicks.push(el.download);
      return el;
    });

    downloadExport(new Uint8Array([1, 2, 3]), 'backup.youryear');
    expect(clicks).toEqual(['backup.youryear']);
    vi.restoreAllMocks();
  });
});

// ── readImportFile ────────────────────────────────────────────────────────────

describe('readImportFile', () => {
  it('returns Uint8Array for a binary file (SCLE magic)', async () => {
    // Build a minimal valid binary payload: compress(SCLE + version + ...)
    // Easier: just check detection works by mocking the first 4 bytes
    const exportedBytes = await exportData(); // real gzip with SCLE inside
    const file = new File([exportedBytes], 'data.youryear', { type: 'application/octet-stream' });
    const result = await readImportFile(file);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('returns parsed object for a JSON file', async () => {
    const content = JSON.stringify({ socleVersion: 1, events: [], images: [] });
    const file = new File([content], 'export.json', { type: 'application/json' });
    const result = await readImportFile(file);
    expect(result.socleVersion).toBe(1);
  });

  it('rejects on invalid JSON', async () => {
    const file = new File(['not json {{'], 'bad.json', { type: 'application/json' });
    await expect(readImportFile(file)).rejects.toThrow('Invalid JSON');
  });
});

// ── previewImport ─────────────────────────────────────────────────────────────

describe('previewImport', () => {
  it('throws on bad magic bytes', async () => {
    await expect(previewImport(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]))).rejects.toThrow('Invalid file (bad magic bytes)');
  });

  it('throws for invalid socleVersion in legacy JSON', async () => {
    await expect(previewImport({ socleVersion: 99, events: [], images: [] })).rejects.toThrow('Invalid or incompatible');
  });

  it('binary event-log file → type: log, events array, empty blobs', async () => {
    const binary = await exportData();
    const parsed = await previewImport(binary);
    expect(parsed.type).toBe('log');
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.blobs).toEqual([]);
  });

  it.skipIf(!dispatch)('binary event-log file → events contain dispatched data', async () => {
    await dispatch('item:added', { title: 'preview-me' });
    const binary = await exportData();
    const parsed = await previewImport(binary);
    expect(parsed.type).toBe('log');
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].payload.title).toBe('preview-me');
  });

  it('binary simple-state file → type: simple with payload', async () => {
    vi.spyOn(Store, 'getAllEvents').mockResolvedValueOnce([{
      id: 'snap-preview',
      type: 'simple:state',
      payload: { items: ['x', 'y'] },
      deviceId: null,
      recordedAt: 1000,
      occurredAt: 1000,
    }]);
    const binary = await exportData();
    vi.restoreAllMocks();
    const parsed = await previewImport(binary);
    expect(parsed.type).toBe('simple');
    expect(parsed.payload.items).toEqual(['x', 'y']);
    expect(parsed.blobs).toEqual([]);
  });

  it('legacy JSON with log events → type: log', async () => {
    const parsed = await previewImport({
      socleVersion: 1,
      events: [{ id: 'e1', type: 'item:added', payload: {}, deviceId: null, recordedAt: 1, occurredAt: 1 }],
      images: [],
    });
    expect(parsed.type).toBe('log');
    expect(parsed.events).toHaveLength(1);
  });

  it('legacy JSON with simple:state event → type: simple', async () => {
    const parsed = await previewImport({
      socleVersion: 1,
      events: [{ id: 'snap-1', type: 'simple:state', payload: { score: 7 }, deviceId: null, recordedAt: 1, occurredAt: 1 }],
      images: [],
    });
    expect(parsed.type).toBe('simple');
    expect(parsed.payload.score).toBe(7);
  });

  it('does not write anything to IDB', async () => {
    const binary = await exportData();
    await previewImport(binary);
    const all = await getAllEvents();
    expect(all).toHaveLength(0);
  });
});

// ── applyReplace ──────────────────────────────────────────────────────────────

describe('applyReplace', () => {
  it('log type: writes new events to IDB', async () => {
    const parsed = await previewImport({
      socleVersion: 1,
      events: [{ id: 'r-e1', type: 'item:added', payload: { title: 'imported' }, deviceId: null, recordedAt: 1, occurredAt: 1 }],
      images: [],
    });
    await applyReplace(parsed);
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('r-e1');
  });

  it('log type: skips duplicate events', async () => {
    const parsed = await previewImport({
      socleVersion: 1,
      events: [{ id: 'r-dup', type: 'item:added', payload: {}, deviceId: null, recordedAt: 1, occurredAt: 1 }],
      images: [],
    });
    await applyReplace(parsed);
    await applyReplace(parsed);
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
  });

  it('simple type: updates in-memory state via setState for each key', async () => {
    const parsed = { type: 'simple', payload: { count: 42, label: 'hello' }, blobs: [] };
    await applyReplace(parsed);
    const state = getState();
    expect(state.count).toBe(42);
    expect(state.label).toBe('hello');
  });

  it('adds new blobs from parsed data', async () => {
    const mockBlob = new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' });
    const parsed = { type: 'log', events: [], blobs: [{ id: 'replace-img', blob: mockBlob }] };
    await applyReplace(parsed);
    const stored = await getBlob('replace-img');
    expect(stored).toBeTruthy();
    expect(stored.type).toBe('image/jpeg');
  });

  it('skips blobs that already exist', async () => {
    const original = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
    await attachBlob('existing-img', original);
    const imported = new Blob([new Uint8Array([2])], { type: 'image/png' });
    const parsed = { type: 'log', events: [], blobs: [{ id: 'existing-img', blob: imported }] };
    await applyReplace(parsed);
    const stored = await getBlob('existing-img');
    expect(stored.type).toBe('image/jpeg');
  });
});

// ── applyMerge ────────────────────────────────────────────────────────────────

describe('applyMerge', () => {
  it('log type: writes new events (dedup is merge)', async () => {
    const parsed = await previewImport({
      socleVersion: 1,
      events: [{ id: 'm-e1', type: 'item:added', payload: {}, deviceId: null, recordedAt: 1, occurredAt: 1 }],
      images: [],
    });
    await applyMerge(parsed, () => { throw new Error('should not be called for log type'); });
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
  });

  it('simple type: calls mergeStrategy(currentState, payload) and applies result', async () => {
    const parsed = { type: 'simple', payload: { items: [10, 20] }, blobs: [] };
    const mergeStrategy = (current, imported) => ({ items: [...(current.items ?? []), ...imported.items] });
    await applyMerge(parsed, mergeStrategy);
    expect(getState().items).toEqual([10, 20]);
  });

  it('simple type: mergeStrategy receives current state at call time', async () => {
    const initial = { type: 'simple', payload: { items: ['a'] }, blobs: [] };
    await applyReplace(initial);

    const received = [];
    const mergeStrategy = (current, imported) => {
      received.push({ current: current.items, imported: imported.items });
      return { items: [...current.items, ...imported.items] };
    };

    const parsed = { type: 'simple', payload: { items: ['b', 'c'] }, blobs: [] };
    await applyMerge(parsed, mergeStrategy);

    expect(received[0].current).toEqual(['a']);
    expect(received[0].imported).toEqual(['b', 'c']);
    expect(getState().items).toEqual(['a', 'b', 'c']);
  });

  it('adds blobs for both log and simple types', async () => {
    const mockBlob = new Blob([new Uint8Array([9])], { type: 'image/png' });
    const parsed = { type: 'simple', payload: {}, blobs: [{ id: 'merge-img', blob: mockBlob }] };
    await applyMerge(parsed, (c, i) => ({ ...c, ...i }));
    const stored = await getBlob('merge-img');
    expect(stored).toBeTruthy();
  });
});
