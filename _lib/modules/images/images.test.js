// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compressImage } from './images.js';

// OffscreenCanvas and createImageBitmap are not available in happy-dom — stub them.
function makeMockBitmap(width, height) {
  return { width, height, close: vi.fn() };
}

function makeCanvas(w, h) {
  const ctx = { drawImage: vi.fn() };
  return {
    width: w, height: h,
    getContext: () => ctx,
    convertToBlob: vi.fn(async () => new Blob(['x'.repeat(100)], { type: 'image/jpeg' })),
  };
}

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn());
  vi.stubGlobal('OffscreenCanvas', vi.fn());
});

describe('compressImage', () => {
  it('returns a Blob', async () => {
    const bitmap = makeMockBitmap(800, 600);
    const canvas = makeCanvas(800, 600);
    vi.mocked(createImageBitmap).mockResolvedValue(bitmap);
    vi.mocked(OffscreenCanvas).mockImplementation(function(w, h) { return makeCanvas(w, h); });

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressImage(file);
    expect(result).toBeInstanceOf(Blob);
  });

  it('scales down images wider than maxWidth', async () => {
    const bitmap = makeMockBitmap(2400, 1800);
    let capturedW, capturedH;
    vi.mocked(createImageBitmap).mockResolvedValue(bitmap);
    vi.mocked(OffscreenCanvas).mockImplementation(function(w, h) {
      capturedW = w; capturedH = h;
      return makeCanvas(w, h);
    });

    const file = new File([''], 'big.jpg', { type: 'image/jpeg' });
    await compressImage(file, { maxWidth: 1200 });
    expect(capturedW).toBe(1200);
    expect(capturedH).toBe(900);
  });

  it('does not upscale images smaller than maxWidth', async () => {
    const bitmap = makeMockBitmap(600, 400);
    let capturedW;
    vi.mocked(createImageBitmap).mockResolvedValue(bitmap);
    vi.mocked(OffscreenCanvas).mockImplementation(function(w, h) {
      capturedW = w;
      return makeCanvas(w, h);
    });

    const file = new File([''], 'small.jpg', { type: 'image/jpeg' });
    await compressImage(file, { maxWidth: 1200 });
    expect(capturedW).toBe(600);
  });

  it('closes the bitmap after use', async () => {
    const bitmap = makeMockBitmap(400, 300);
    vi.mocked(createImageBitmap).mockResolvedValue(bitmap);
    vi.mocked(OffscreenCanvas).mockImplementation(function(w, h) { return makeCanvas(w, h); });

    const file = new File([''], 'x.jpg', { type: 'image/jpeg' });
    await compressImage(file);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
