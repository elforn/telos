/**
 * Keyed child reconciliation — the library's render primitive for lists.
 *
 * Reuses existing `tagName` children of `container` matched by id, creates
 * missing ones, removes leftovers, and appends in `items` order. `assign` is
 * called for every kept and created element *before* it is (re)appended, so
 * property setters run while the element is in its previous position.
 * Appending an already-connected element moves it — kept elements preserve
 * identity, focus, and internal state.
 *
 * @param {Element} container  parent whose children are reconciled
 * @param {Array}   items      data items, in desired display order
 * @param {string}  tagName    custom element tag to match and create
 * @param {(el: Element, item: object) => void} assign  applied to every element
 * @param {object}  [options]
 * @param {(item: object) => string} [options.getId]  item id (default `item.id`)
 * @param {(el: Element) => string}  [options.getElId] element id for matching.
 *   When omitted, elements are matched by `el.dataset.id` and the helper sets
 *   `dataset.id` on created elements. When provided (e.g. `el => el._goal?.id`),
 *   `assign` is responsible for the element carrying its id.
 */
export function syncChildren(container, items, tagName, assign, { getId = i => i.id, getElId } = {}) {
  const elId = getElId ?? (el => el.dataset.id);

  const byId = new Map();
  container.querySelectorAll(tagName).forEach(el => {
    const id = elId(el);
    if (id) byId.set(id, el);
  });

  const ordered = items.map(item => {
    const id = getId(item);
    let el = byId.get(id);
    if (el) {
      byId.delete(id);
    } else {
      el = document.createElement(tagName);
      if (!getElId) el.dataset.id = id;
    }
    assign(el, item);
    return el;
  });

  byId.forEach(el => el.remove());
  ordered.forEach(el => container.appendChild(el));
}
