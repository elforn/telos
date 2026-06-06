export async function compressImage(file, { maxWidth = 1200, quality = 0.8 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale  = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width  * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
