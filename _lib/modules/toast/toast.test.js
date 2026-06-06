// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast, _resetToast } from './toast.js';

describe('toast', () => {
  beforeEach(() => _resetToast());
  afterEach(() => _resetToast());

  it('creates a toast element with the correct class for info', () => {
    toast('Hello');
    const el = document.querySelector('.socle-toast-info');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('Hello');
  });

  it('creates a success toast', () => {
    toast('Saved', 'success');
    expect(document.querySelector('.socle-toast-success')).toBeTruthy();
  });

  it('creates an error toast', () => {
    toast('Failed', 'error');
    expect(document.querySelector('.socle-toast-error')).toBeTruthy();
  });

  it('removes the toast after 3000ms', () => {
    vi.useFakeTimers();
    toast('Bye');
    expect(document.querySelector('.socle-toast')).toBeTruthy();
    vi.advanceTimersByTime(3000);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('reuses the same container for multiple toasts', () => {
    toast('First');
    toast('Second');
    expect(document.querySelectorAll('#toast-container').length).toBe(1);
    expect(document.querySelectorAll('.socle-toast').length).toBe(2);
  });

  it('injects styles only once', () => {
    toast('A');
    toast('B');
    const styleCount = document.querySelectorAll('style').length;
    toast('C');
    expect(document.querySelectorAll('style').length).toBe(styleCount);
  });

  it('toast element has role=status', () => {
    toast('Info');
    expect(document.querySelector('.socle-toast').getAttribute('role')).toBe('status');
  });
});
