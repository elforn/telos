const enc = new TextEncoder();
const dec = new TextDecoder();

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; }
function u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; }
function r16(b, o) { return new DataView(b.buffer, b.byteOffset + o, 2).getUint16(0, true); }
function r32(b, o) { return new DataView(b.buffer, b.byteOffset + o, 4).getUint32(0, true); }

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

async function deflate(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// entries: [{ filename: string, bytes: Uint8Array, compress?: boolean }]
// compress defaults to true; pass false for already-compressed content (images).
export async function zipEntries(entries) {
  const parts = [];
  const meta  = [];
  let offset  = 0;

  for (const { filename, bytes, compress = true } of entries) {
    const fn       = enc.encode(filename);
    const method   = compress ? 8 : 0;
    const data     = compress ? await deflate(bytes) : bytes;
    const checksum = crc32(bytes);

    const lh = concat([
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
      u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(checksum), u32(data.byteLength), u32(bytes.byteLength),
      u16(fn.byteLength), u16(0), fn,
    ]);

    parts.push(lh, data);
    meta.push({ fn, checksum, method, cSize: data.byteLength, uSize: bytes.byteLength, offset });
    offset += lh.byteLength + data.byteLength;
  }

  const cd = concat(meta.map(({ fn, checksum, method, cSize, uSize, offset: lo }) =>
    concat([
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(checksum), u32(cSize), u32(uSize),
      u16(fn.byteLength), u16(0), u16(0), u16(0), u16(0), u32(0), u32(lo), fn,
    ])
  ));

  return concat([
    ...parts,
    cd,
    concat([
      new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
      u16(0), u16(0), u16(meta.length), u16(meta.length),
      u32(cd.byteLength), u32(offset), u16(0),
    ]),
  ]);
}

// Returns Map<filename, Uint8Array>. Parses local file headers sequentially from offset 0 —
// valid since we control the writer and always put entries before the central directory.
export async function unzipEntries(zipBytes) {
  const out = new Map();
  let off = 0;
  while (off + 30 <= zipBytes.byteLength && r32(zipBytes, off) === 0x04034B50) {
    const method = r16(zipBytes, off + 8);
    const cSize  = r32(zipBytes, off + 18);
    const fnLen  = r16(zipBytes, off + 26);
    const exLen  = r16(zipBytes, off + 28);
    const fn     = dec.decode(zipBytes.slice(off + 30, off + 30 + fnLen));
    const start  = off + 30 + fnLen + exLen;
    const data   = zipBytes.slice(start, start + cSize);
    out.set(fn, method === 8 ? await inflate(data) : data);
    off = start + cSize;
  }
  return out;
}
