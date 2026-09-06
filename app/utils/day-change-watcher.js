// Nothing in the app proactively re-checks "what day is it" — every date
// read (todayISO(), and everything built on it: urgencyOf, frequency
// pace warnings, Fix-a-day's chip labels...) is only ever as fresh as
// whatever last triggered a render (a store write, a navigation, a fresh
// mount). Left open and idle across midnight, the UI simply keeps showing
// yesterday's computed state until something else happens to re-render it.
//
// Two triggers close that gap: the app resuming from the background
// (visibilitychange -> visible), and — since a phone left face-up and
// unlocked, or a desktop tab that simply never loses focus, can sail
// straight through midnight without ever backgrounding — a one-shot timer
// armed for the next local midnight, re-arming itself each time it fires.
// Not a polling loop: exactly one timer alive per subscriber at any moment,
// self-terminating once the element leaves the DOM (see
// scheduleMidnightCheck) rather than needing its own teardown wired through
// AppElement, since `listen()` only manages addEventListener pairs, not
// timers. Callers pair the tracker below with their own
// `this.listen(document, 'visibilitychange', ...)` (see AppElement) so
// *that* half's cleanup on disconnect is automatic, the same as every other
// listener in the app.
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

// A couple of seconds of margin past the exact instant of midnight — pure
// paranoia against firing a hair early on a slow/throttled timer and still
// reading yesterday's date.
const MIDNIGHT_MARGIN_MS = 2000;

// Arms a one-shot timer for the next local midnight and re-arms itself each
// time it fires — the continuously-visible-through-midnight case
// visibilitychange can't catch on its own (see the module doc above).
// Checks `el.isConnected` on each firing rather than threading a second
// cleanup path through AppElement: once the element's left the DOM, the
// chain simply stops rescheduling itself instead of ticking forever.
function scheduleMidnightCheck(el, check) {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => {
    if (!el.isConnected) return; // element's gone — nothing left to re-render, stop the chain here
    check();
    scheduleMidnightCheck(el, check);
  }, nextMidnight - now + MIDNIGHT_MARGIN_MS);
}

// Convenience wiring for the common case: an AppElement page/component that
// wants `onChange()` called once, exactly when the app resumes on a new
// calendar day — or, failing that, once when the day actually turns over
// even if the app never left the foreground to trigger a resume. Takes the
// element itself (not just document) so it can use AppElement's own
// listen() for the visibilitychange half — automatic cleanup on disconnect,
// same as every other listener in the app, rather than each call site
// repeating its own add/remove pair.
export function onDayChange(el, onChange) {
  const dayChanged = createDayChangeTracker();
  const check = () => { if (dayChanged()) onChange(); };
  el.listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  scheduleMidnightCheck(el, check);
}
