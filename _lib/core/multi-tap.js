// A single completed tap can't tell, by itself, whether it's a one-off or
// the first of a burst — the caller has to wait a short window to find out,
// unless the burst has already reached a known maximum, in which case
// there's nothing left to wait for. createTapCounter() is that
// disambiguation pulled out on its own: pure and DOM-free, so it works for
// pointer taps, clicks, or repeated keypresses alike, and is trivially unit
// testable without simulating any real input at all.
//
// onResolve(count) fires exactly once per burst — immediately once `max` is
// reached, or after `windowMs` of silence otherwise, with whatever count the
// burst settled at. A caller that only acts on specific counts (e.g. 1 and 3,
// leaving 2 as a deliberate no-op) just ignores the counts it doesn't handle.
export function createTapCounter({ windowMs = 300, max = Infinity, onResolve } = {}) {
  let count = 0;
  let timer = null;

  function resolve() {
    const settled = count;
    count = 0;
    timer = null;
    onResolve(settled);
  }

  function register() {
    count += 1;
    clearTimeout(timer);
    if (count >= max) { resolve(); return; }
    timer = setTimeout(resolve, windowMs);
  }

  // Interrupts an in-progress burst without resolving it — for a caller that
  // discovers, after the fact, that this sequence of taps wasn't a tap burst
  // at all (e.g. it turned into a swipe).
  function cancel() {
    clearTimeout(timer);
    timer = null;
    count = 0;
  }

  return { register, cancel };
}
