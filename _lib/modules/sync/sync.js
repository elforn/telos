import { getAllEvents, getAllBlobs, importEvents, attachBlob, setState, getState } from '../../core/store/store.js';
import { zipEntries, unzipEntries } from './zip.js';

const SOCLE_VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Legacy JSON helpers ───────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportData({ eventFilter } = {}) {
  const allEvents = await getAllEvents();
  const events = eventFilter ? allEvents.filter(eventFilter) : allEvents;

  const allBlobs = await getAllBlobs();
  let blobsToExport;
  if (eventFilter) {
    const referencedIds = new Set(events.flatMap(e => e.payload?.imageId ? [e.payload.imageId] : []));
    blobsToExport = allBlobs.filter(b => referencedIds.has(b.id));
  } else {
    blobsToExport = allBlobs;
  }

  const jsonBytes = enc.encode(JSON.stringify({
    socleVersion: SOCLE_VERSION,
    exportedAt: new Date().toISOString(),
    events,
    blobs: blobsToExport.map(({ id, blob }) => ({ id, mime: blob.type })),
  }));

  const entries = [{ filename: 'data.json', bytes: jsonBytes }];
  for (const { id, blob } of blobsToExport) {
    entries.push({
      filename: `images/${id}`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      compress: false,
    });
  }

  return zipEntries(entries);
}

export async function exportSlice(payload) {
  const jsonBytes = enc.encode(JSON.stringify({
    socleVersion: SOCLE_VERSION,
    exportedAt: new Date().toISOString(),
    events: [{ type: 'simple:state', payload }],
  }));
  // compress: false — must stay stored (method 0). deflate() crosses the task queue
  // via CompressionStream/Response.arrayBuffer(), which expires the transient user
  // activation required by navigator.share(). Stored entries resolve via microtasks only.
  return zipEntries([{ filename: 'data.json', bytes: jsonBytes, compress: false }]);
}

// ── Import ────────────────────────────────────────────────────────────────────

async function importBinary(uint8) {
  const entries = await unzipEntries(uint8);
  const jsonBytes = entries.get('data.json');
  if (!jsonBytes) throw new Error('Invalid file (missing data.json)');

  const { events = [], blobs: blobMeta = [] } = JSON.parse(dec.decode(jsonBytes));

  const existingEvents = new Set((await getAllEvents()).map(e => e.id));
  const newEvents = events.filter(e => !existingEvents.has(e.id));
  await importEvents(newEvents);

  const existingBlobs = new Set((await getAllBlobs()).map(b => b.id));
  let imagesAdded = 0;
  for (const { id, mime } of blobMeta) {
    if (!existingBlobs.has(id)) {
      const imgBytes = entries.get(`images/${id}`);
      if (!imgBytes) throw new Error(`Missing image entry: images/${id}`);
      await attachBlob(id, new Blob([imgBytes], { type: mime }));
      imagesAdded++;
    }
  }

  return { eventsAdded: newEvents.length, imagesAdded };
}

async function importLegacyJSON(data) {
  if (data?.socleVersion !== SOCLE_VERSION) {
    throw new Error(`Invalid or incompatible export file (socleVersion: ${data?.socleVersion ?? 'missing'})`);
  }

  const existing = new Set((await getAllEvents()).map(e => e.id));
  const newEvents = (data.events ?? []).filter(e => !existing.has(e.id));
  await importEvents(newEvents);

  const existingBlobs = new Set((await getAllBlobs()).map(b => b.id));
  const newImages = (data.images ?? []).filter(img => !existingBlobs.has(img.id));
  let imagesAdded = 0;
  for (const { id, dataUrl } of newImages) {
    await attachBlob(id, dataUrlToBlob(dataUrl));
    imagesAdded++;
  }

  return { eventsAdded: newEvents.length, imagesAdded };
}

export async function importData(input) {
  if (input instanceof Uint8Array) {
    if (input.length < 4 || input[0] !== 0x50 || input[1] !== 0x4B || input[2] !== 0x03 || input[3] !== 0x04) {
      throw new Error('Invalid file');
    }
    return importBinary(input);
  }
  return importLegacyJSON(input);
}

// ── Preview / merge-aware import ──────────────────────────────────────────────

async function _readZip(uint8) {
  const entries = await unzipEntries(uint8);
  const jsonBytes = entries.get('data.json');
  if (!jsonBytes) throw new Error('Invalid file (missing data.json)');

  const { events = [], blobs: blobMeta = [] } = JSON.parse(dec.decode(jsonBytes));

  const blobs = blobMeta.map(({ id, mime }) => {
    const imgBytes = entries.get(`images/${id}`);
    if (!imgBytes) throw new Error(`Missing image entry: images/${id}`);
    return { id, blob: new Blob([imgBytes], { type: mime }) };
  });

  const snapshot = events.find(e => e.type === 'simple:state');
  return snapshot
    ? { type: 'simple', payload: snapshot.payload, blobs }
    : { type: 'log', events, blobs };
}

function _readLegacyJSON(data) {
  if (data?.socleVersion !== SOCLE_VERSION) {
    throw new Error(`Invalid or incompatible export file (socleVersion: ${data?.socleVersion ?? 'missing'})`);
  }
  const events = data.events ?? [];
  const blobs = (data.images ?? []).map(({ id, dataUrl }) => ({ id, blob: dataUrlToBlob(dataUrl) }));
  const snapshot = events.find(e => e.type === 'simple:state');
  return snapshot
    ? { type: 'simple', payload: snapshot.payload, blobs }
    : { type: 'log', events, blobs };
}

async function _writeNewBlobs(blobs) {
  const existingIds = new Set((await getAllBlobs()).map(b => b.id));
  for (const { id, blob } of blobs) {
    if (!existingIds.has(id)) await attachBlob(id, blob);
  }
}

// Parse without applying — returns { type: 'simple', payload, blobs } for simple-store
// files or { type: 'log', events, blobs } for event-log files.
export async function previewImport(raw) {
  if (raw instanceof Uint8Array) {
    if (raw.length < 4 || raw[0] !== 0x50 || raw[1] !== 0x4B || raw[2] !== 0x03 || raw[3] !== 0x04) {
      throw new Error('Invalid file');
    }
    return _readZip(raw);
  }
  return _readLegacyJSON(raw);
}

// Overwrite — for simple store: setState each key (in-memory + IDB, no reload needed).
// For event-log: importEvents (IDB only, reload still needed).
export async function applyReplace(parsed) {
  if (parsed.type === 'simple') {
    for (const [key, value] of Object.entries(parsed.payload)) setState(key, value);
  } else {
    const existing = new Set((await getAllEvents()).map(e => e.id));
    await importEvents(parsed.events.filter(e => !existing.has(e.id)));
  }
  await _writeNewBlobs(parsed.blobs);
}

// Merge — for simple store: mergeStrategy(currentState, payload) → setState each key.
// For event-log: importEvents (dedup-by-ID is already merge semantics).
export async function applyMerge(parsed, mergeStrategy) {
  if (parsed.type === 'simple') {
    const merged = mergeStrategy(getState(), parsed.payload);
    for (const [key, value] of Object.entries(merged)) setState(key, value);
  } else {
    const existing = new Set((await getAllEvents()).map(e => e.id));
    await importEvents(parsed.events.filter(e => !existing.has(e.id)));
  }
  await _writeNewBlobs(parsed.blobs);
}

// ── Download / file read ──────────────────────────────────────────────────────

export function downloadExport(uint8, filename) {
  // application/octet-stream, not application/zip — Android's download manager maps
  // application/zip to its canonical extension (.zip) and appends it, turning
  // "export.telos" into "export.telos.zip". octet-stream has no canonical extension
  // so the download attribute's filename is preserved as-is.
  // (The share path in app code uses application/zip independently, as required by
  // navigator.share's file-type safelist — that constraint does not apply here.)
  const blob = new Blob([uint8], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readImportFile(file) {
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04) {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch { reject(new Error('Invalid JSON')); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
