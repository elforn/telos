// Nothing in the app proactively re-checks "what day is it" — every date
// read (todayISO(), and everything built on it: urgencyOf, frequency
// pace warnings, Fix-a-day's chip labels...) is only ever as fresh as
// whatever last triggered a render (a store write, a navigation, a fresh
// mount). Left open and idle across midnight, the UI simply keeps showing
// yesterday's computed state until something else happens to re-render it.
//
// This closes that gap for the one moment it actually matters: the app
// resuming from the background (visibilitychange -> visible) — not a
// polling timer. Callers pair the tracker below with their own
// `this.listen(document, 'visibilitychange', ...)` (see AppElement) so
// cleanup on disconnect is automatic, the same as every other listener in
// the app.
import { todayISO } from './today-iso.js';

// Returns a function that reports whether the calendar day has moved on
// since the LAST call (false on the very first call, which only seeds the
// baseline). Pure and DOM-free — one tracker per subscriber, since each
// needs its own independent "last known day" baseline.
export function createDayChangeTracker() {
  let lastKnownDay = todayISO();
  return () => {
    const today = todayISO();
    if (today === lastKnownDay) return false;
    lastKnownDay = today;
    return true;
  };
}

// Convenience wiring for the common case: an AppElement page/component that
// wants `onChange()` called once, exactly when the app resumes on a new
// calendar day. Takes the element itself (not just document) so it can use
// AppElement's own listen() — automatic cleanup on disconnect, same as
// every other listener in the app, rather than each call site repeating
// its own add/remove pair.
export function onDayChange(el, onChange) {
  const dayChanged = createDayChangeTracker();
  el.listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible' && dayChanged()) onChange();
  });
}
