import { getAllEvents, getAllBlobs, importEvents, attachBlob } from '../../core/store/store.js';

const SOCLE_VERSION = 1;
const BINARY_VERSION = 1;
const MAGIC = 'SCLE';
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Binary helpers ────────────────────────────────────────────────────────────

async function compress(bytes) {
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompress(bytes) {
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function u32le(val) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, val, true);
  return b;
}

function u16le(val) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, val, true);
  return b;
}

function readU32LE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function readU16LE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

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

  const eventsBytes = enc.encode(JSON.stringify({
    socleVersion: SOCLE_VERSION,
    exportedAt: new Date().toISOString(),
    events,
  }));

  // Inner payload (to be gzip-compressed): version + events + images
  const payload = [
    new Uint8Array([BINARY_VERSION]),
    u32le(eventsBytes.byteLength),
    eventsBytes,
    u16le(blobsToExport.length),
  ];

  for (const { id, blob } of blobsToExport) {
    const idBytes   = enc.encode(id);
    const mimeBytes = enc.encode(blob.type);
    const imgBytes  = new Uint8Array(await blob.arrayBuffer());
    payload.push(
      new Uint8Array([idBytes.length]),
      idBytes,
      new Uint8Array([mimeBytes.length]),
      mimeBytes,
      u32le(imgBytes.byteLength),
      imgBytes,
    );
  }

  // File layout: 4-byte magic (uncompressed) + gzip payload
  // Magic is outside gzip so format detection needs no decompression.
  const compressed = await compress(concat(payload));
  return concat([enc.encode(MAGIC), compressed]);
}

// ── Import ────────────────────────────────────────────────────────────────────

async function importBinary(uint8) {
  // First 4 bytes are the uncompressed SCLE magic; the rest is gzip.
  if (uint8.length < 5 || dec.decode(uint8.slice(0, 4)) !== MAGIC) {
    throw new Error('Invalid file (bad magic bytes)');
  }

  const bytes = await decompress(uint8.slice(4));
  let off = 0;

  const version = bytes[off++];
  if (version !== BINARY_VERSION) throw new Error(`Unsupported format version: ${version}`);

  const eventsLen = readU32LE(bytes, off); off += 4;
  const { events } = JSON.parse(dec.decode(bytes.slice(off, off + eventsLen)));
  off += eventsLen;

  const existing = new Set((await getAllEvents()).map(e => e.id));
  const newEvents = (events ?? []).filter(e => !existing.has(e.id));
  await importEvents(newEvents);

  const imageCount = readU16LE(bytes, off); off += 2;
  const existingBlobs = new Set((await getAllBlobs()).map(b => b.id));
  let imagesAdded = 0;

  for (let i = 0; i < imageCount; i++) {
    const idLen = bytes[off++];
    const id = dec.decode(bytes.slice(off, off + idLen)); off += idLen;

    const mimeLen = bytes[off++];
    const mime = dec.decode(bytes.slice(off, off + mimeLen)); off += mimeLen;

    const imgLen = readU32LE(bytes, off); off += 4;
    if (!existingBlobs.has(id)) {
      await attachBlob(id, new Blob([bytes.slice(off, off + imgLen)], { type: mime }));
      imagesAdded++;
    }
    off += imgLen;
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
  if (input instanceof Uint8Array) return importBinary(input);
  return importLegacyJSON(input);
}

// ── Download / file read ──────────────────────────────────────────────────────

export function downloadExport(uint8, filename) {
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
  if (dec.decode(header) === MAGIC) {
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
