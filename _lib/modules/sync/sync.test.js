// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportData, importData, downloadExport, readImportFile } from './sync.js';
import { boot, reset, attachBlob, getBlob, getAllEvents } from '../../core/store/store.js';
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
