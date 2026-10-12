// Roving-tabindex keyboard navigation for a role="listbox" whose options are
// real <button> elements.
//
// Without it a listbox is one Tab stop per option. That is operable, but it
// means tabbing past forty goals to reach the footer, and it contradicts what
// role="listbox" tells assistive technology to expect: a single stop for the
// list, with arrows moving inside it.
//
// Both pickers in this app render their options as <button>s on purpose, so
// click, Enter and Space all come from the platform rather than being
// re-implemented. The only thing missing is focus movement, which is all this
// module supplies — it never selects anything, it only decides which option
// currently holds the tab stop.
export function attachListboxKeys(container, { selector = '[role="option"]' } = {}) {
  const options = () => [...container.querySelectorAll(selector)];

  const focusAt = (list, index) => {
    // Clamped rather than wrapped: at either end the arrow key simply stops,
    // which is the behaviour a list of goals reads as. (Wrapping is allowed by
    // the APG but surprises people more often than it helps.)
    const next = Math.max(0, Math.min(list.length - 1, index));
    list.forEach((el, i) => { el.tabIndex = i === next ? 0 : -1; });
    list[next]?.focus();
  };

  const onKeydown = e => {
    const list = options();
    if (!list.length) return;
    const current = list.indexOf(e.target.closest(selector));
    if (current === -1) return; // a keypress on the container itself, or on chrome between groups
    const target = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: list.length - 1,
    }[e.key];
    if (target === undefined) return;
    // Otherwise the arrow scrolls the list's own overflow instead of moving
    // the selection, and the focused option slides out of view.
    e.preventDefault();
    focusAt(list, target);
  };
  container.addEventListener('keydown', onKeydown);

  return {
    // Must run after every re-render: freshly created options carry no
    // tabindex at all, which makes every one of them a tab stop again.
    //
    // The stop lands on the first already-selected option when there is one,
    // so reopening a picker puts the user where their selection is rather
    // than back at the top.
    syncTabStops() {
      const list = options();
      const active = Math.max(0, list.findIndex(el => el.getAttribute('aria-selected') === 'true'));
      list.forEach((el, i) => { el.tabIndex = i === active ? 0 : -1; });
    },
    detach() { container.removeEventListener('keydown', onKeydown); },
  };
}
