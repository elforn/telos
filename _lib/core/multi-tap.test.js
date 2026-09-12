import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTapCounter } from './multi-tap.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createTapCounter', () => {
  it('resolves with count 1 after the window when only one tap is registered', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    expect(onResolve).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('resolves with the settled count after a burst of taps within the window', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    vi.advanceTimersByTime(100);
    counter.register();
    vi.advanceTimersByTime(100);
    expect(onResolve).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('each tap resets the window — a burst only resolves once taps stop', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    vi.advanceTimersByTime(299);
    counter.register();
    vi.advanceTimersByTime(299);
    expect(onResolve).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('resolves immediately, with no wait, once max is reached', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, max: 3, onResolve });
    counter.register();
    counter.register();
    counter.register();
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('does not fire a second time for taps beyond max within the same burst', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, max: 3, onResolve });
    counter.register();
    counter.register();
    counter.register(); // resolves here, with 3
    counter.register(); // starts a brand-new burst
    expect(onResolve).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenCalledTimes(2);
    expect(onResolve).toHaveBeenNthCalledWith(2, 1);
  });

  it('starts a fresh burst after a previous one resolves', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenNthCalledWith(1, 1);

    counter.register();
    counter.register();
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenNthCalledWith(2, 2);
  });

  it('cancel discards an in-progress burst without resolving it', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    counter.register();
    counter.cancel();
    vi.advanceTimersByTime(300);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('a tap registered after cancel starts a fresh burst at count 1', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ windowMs: 300, onResolve });
    counter.register();
    counter.register();
    counter.cancel();
    counter.register();
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('defaults to a 300ms window and unbounded max when not specified', () => {
    const onResolve = vi.fn();
    const counter = createTapCounter({ onResolve });
    counter.register();
    counter.register();
    counter.register();
    counter.register();
    counter.register();
    expect(onResolve).not.toHaveBeenCalled(); // no max, so no burst is ever "reached"
    vi.advanceTimersByTime(300);
    expect(onResolve).toHaveBeenCalledExactlyOnceWith(5);
  });
});
