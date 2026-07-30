import { describe, it, expect } from 'vitest';
import { zipEntries, unzipEntries } from './zip.js';

describe('zipEntries / unzipEntries', () => {
  it('round-trips a single deflated entry', async () => {
    const bytes = new TextEncoder().encode('{"hello":"world"}');
    const zip = await zipEntries([{ filename: 'data.json', bytes }]);
    const entries = await unzipEntries(zip);
    expect(entries.get('data.json')).toEqual(bytes);
  });

  it('round-trips a stored entry (compress: false)', async () => {
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02]);
    const zip = await zipEntries([{ filename: 'images/img-1', bytes, compress: false }]);
    const entries = await unzipEntries(zip);
    expect(entries.get('images/img-1')).toEqual(bytes);
  });

  it('round-trips multiple entries (mixed methods)', async () => {
    const json = new TextEncoder().encode('{"events":[]}');
    const img  = new Uint8Array([0xFF, 0xD8, 0xFF]);
    const zip  = await zipEntries([
      { filename: 'data.json', bytes: json },
      { filename: 'images/abc', bytes: img, compress: false },
    ]);
    const entries = await unzipEntries(zip);
    expect(entries.get('data.json')).toEqual(json);
    expect(entries.get('images/abc')).toEqual(img);
  });

  it('starts with the PK local file header signature', async () => {
    const zip = await zipEntries([{ filename: 'x', bytes: new Uint8Array([1, 2, 3]) }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4B); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('CRC-32 in local file header matches independently computed value', async () => {
    const bytes = new TextEncoder().encode('crc check payload');
    const zip   = await zipEntries([{ filename: 'f', bytes }]);

    // CRC-32 is at offset 14 in the local file header (LE uint32)
    const headerCrc = new DataView(zip.buffer).getUint32(14, true);

    // Independent CRC-32 implementation — same polynomial, separate code
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    const expected = (c ^ 0xFFFFFFFF) >>> 0;

    expect(headerCrc).toBe(expected);
  });

  it('stored entry has compression method 0 in local file header', async () => {
    const zip = await zipEntries([{ filename: 'img', bytes: new Uint8Array([1, 2, 3, 4]), compress: false }]);
    // Compression method is at offset 8 (LE uint16)
    const method = new DataView(zip.buffer).getUint16(8, true);
    expect(method).toBe(0);
  });

  it('deflated entry has compression method 8 in local file header', async () => {
    const zip = await zipEntries([{ filename: 'f', bytes: new TextEncoder().encode('hello') }]);
    const method = new DataView(zip.buffer).getUint16(8, true);
    expect(method).toBe(8);
  });
});
