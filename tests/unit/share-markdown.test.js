// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { shareMarkdown } from '../../app/utils/share-markdown.js';

const realShare = navigator.share;

afterEach(() => {
  navigator.share = realShare;
  vi.restoreAllMocks();
});

describe('shareMarkdown', () => {
  it('shares the text via navigator.share when available', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareMarkdown('# Hello', 'My title');

    expect(navigator.share).toHaveBeenCalledWith({ title: 'My title', text: '# Hello' });
    expect(writeText).not.toHaveBeenCalled();
    expect(result).toBe('shared');
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    navigator.share = undefined;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareMarkdown('# Hello', 'My title');

    expect(writeText).toHaveBeenCalledWith('# Hello');
    expect(result).toBe('copied');
  });

  it('returns "cancelled" without copying when the user cancels the share sheet', async () => {
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareMarkdown('# Hello', 'My title');

    expect(writeText).not.toHaveBeenCalled();
    expect(result).toBe('cancelled');
  });

  it('falls back to clipboard on a genuine share failure (not a user cancel)', async () => {
    navigator.share = vi.fn().mockRejectedValue(new Error('boom'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await shareMarkdown('# Hello', 'My title');

    expect(writeText).toHaveBeenCalledWith('# Hello');
    expect(result).toBe('copied');
  });
});
