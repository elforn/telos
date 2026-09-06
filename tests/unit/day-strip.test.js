// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { buildDayStrip, dayStripStyles } from '../../app/utils/day-strip.js';
import '../../app/strings.js';

const ALL_DAY_STATES = [
  { wd: 'mon', state: 'missed' },
  { wd: 'tue', state: 'success' },
  { wd: 'wed', state: 'unscheduled' },
  { wd: 'thu', state: 'pending' },
  { wd: 'fri', state: 'blank' },
  { wd: 'sat', state: 'blank' },
  { wd: 'sun', state: 'blank' },
];

describe('buildDayStrip', () => {
  it('renders one .day-slot per input day, in the given order', () => {
    const strip = buildDayStrip(ALL_DAY_STATES);
    const slots = [...strip.querySelectorAll('.day-slot')];
    expect(slots).toHaveLength(7);
    expect(slots.map(s => s.className)).toEqual([
      'day-slot missed',
      'day-slot success',
      'day-slot unscheduled',
      'day-slot pending',
      'day-slot blank',
      'day-slot blank',
      'day-slot blank',
    ]);
  });

  it('each slot shows its weekday\'s single-letter glyph, not the state', () => {
    const strip = buildDayStrip(ALL_DAY_STATES);
    const slots = [...strip.querySelectorAll('.day-slot')];
    expect(slots.map(s => s.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('is a single "day-strip" element', () => {
    const strip = buildDayStrip(ALL_DAY_STATES);
    expect(strip.className).toBe('day-strip');
  });

  // The colour is the only visual differentiator between states (accepted
  // after /a11y review) — role="img" + aria-label is how non-sighted users
  // get the same per-day picture instead. See day-strip.js's own comment for
  // why this doesn't double-announce inside upcoming-dialog.js's row button.
  it('exposes role="img" so screen readers treat it as one described unit, not 7 untitled spans', () => {
    const strip = buildDayStrip(ALL_DAY_STATES);
    expect(strip.getAttribute('role')).toBe('img');
  });

  it('the aria-label names every day and its own state, in order', () => {
    const strip = buildDayStrip(ALL_DAY_STATES);
    expect(strip.getAttribute('aria-label')).toBe(
      'Mon: missed, Tue: logged, Wed: logged, not scheduled, Thu: scheduled, Fri: not scheduled, Sat: not scheduled, Sun: not scheduled'
    );
  });

  it('handles an empty day list', () => {
    const strip = buildDayStrip([]);
    expect(strip.querySelectorAll('.day-slot')).toHaveLength(0);
    expect(strip.getAttribute('aria-label')).toBe('');
  });
});

describe('dayStripStyles', () => {
  it('defines a colour rule for every one of the 5 states', () => {
    const css = dayStripStyles();
    for (const state of ['missed', 'success', 'unscheduled', 'pending', 'blank']) {
      expect(css).toContain(`.day-slot.${state}`);
    }
  });

  it('is a plain string safe to splice into a consumer\'s own <style> block', () => {
    expect(typeof dayStripStyles()).toBe('string');
  });
});
