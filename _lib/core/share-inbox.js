// Consume-once reader for the share-inbox cache populated by the Share Target SW handler.
//
// The app's manifest.json share_target entry must use:
//   method: 'POST', enctype: 'multipart/form-data'
//   params: { title: 'title', text: 'text', url: 'url',
//             files: [{ name: 'files', accept: [...] }] }
// The 'files' param name must stay 'files' — that is what the SW reads via fd.getAll('files').
//
// Returns null if no share is pending. The pending entry is deleted on read (consume-once).

export async function readShareInbox() {
  const cache = await caches.open('share-inbox');
  const indexResp = await cache.match('pending');
  if (!indexResp) return null;
  await cache.delete('pending');
  const { title, text, url, files: filesIndex } = await indexResp.json();
  const files = await Promise.all(filesIndex.map(async f => {
    const r = await cache.match(f.key);
    if (r) await cache.delete(f.key);
    const blob = r
      ? new Blob([await r.arrayBuffer()], { type: f.type || 'application/octet-stream' })
      : new Blob([], { type: f.type || 'application/octet-stream' });
    return { name: f.name, type: f.type, blob };
  }));
  return { title, text, url, files };
}
