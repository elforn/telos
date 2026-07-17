/**
 * Drag-to-reorder controller.
 *
 * Manages the ghost clone, insert line, edge auto-scroll, drop-index maths, and
 * keyboard reorder for a list of items. The drag is *initiated by the consumer*:
 * an item's drag handle calls `setPointerCapture` on pointerdown and dispatches a
 * bubbling `dragStartEvent` carrying `{ element, startX, startY, ... }`. `attach`
 * listens for that event on `container` (rather than installing its own
 * pointerdown) and runs the drag from there.
 *
 * Two modes:
 *  - Single-list: `container` is the list element; items are found with
 *    `container.querySelectorAll(itemSelector)`; drops call `onMove(from, to)`.
 *  - Cross-section: pass `sections` (`[{ name, sectionEl, listEl }]`). The drag
 *    can cross sections; the target section is whichever `sectionEl` is under the
 *    pointer; drops call `onMoveSection(fromSection, from, toSection, to)`.
 *
 * `from`/`to` are insertion-slot indices in the item array *including* the
 * dragged element (it stays in the DOM during the drag). A drop that would not
 * change order (`from === to || from === to - 1`, within the same section) is a
 * no-op and the callback does not fire.
 *
 * @param {Element} container  element the drag-start / reorder-key events bubble to
 * @param {object}  options
 * @param {string}  options.itemSelector       selector matching the draggable items
 * @param {string}  options.dragStartEvent      custom event name that begins a drag
 * @param {string}  [options.reorderKeyEvent]   custom event name for keyboard reorder
 * @param {(detail: object) => string} options.cloneLabel  text for the drag clone
 * @param {(from: number, to: number) => void} [options.onMove]  single-list drop
 * @param {Array<{name: string, sectionEl: Element, listEl: Element}>} [options.sections]
 * @param {(fromSection: string, from: number, toSection: string, to: number) => void} [options.onMoveSection]
 * @returns {() => void} detach — removes listeners and tears down an in-flight drag
 */
export const Reorder = {
  attach(container, {
    itemSelector,
    dragStartEvent,
    reorderKeyEvent,
    cloneLabel,
    onMove,
    sections,
    onMoveSection,
  }) {
    const SCROLL_ZONE = 100;
    const MAX_SPEED   = 14;
    const crossSection = Array.isArray(sections) && sections.length > 0;

    let drag       = null;
    let insertLine = null;

    const listElFor  = name => sections.find(s => s.name === name)?.listEl;
    const sectionOf  = el => sections.find(s => s.listEl.contains(el))?.name ?? null;
    const sectionAtY = y => {
      for (const s of sections) {
        const r = s.sectionEl.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) return s.name;
      }
      return null;
    };

    const insertIndexAt = (listEl, y, ghostEl) => {
      const items = [...listEl.querySelectorAll(itemSelector)];
      for (const item of items.filter(el => el !== ghostEl)) {
        const r = item.getBoundingClientRect();
        if (y < r.top + r.height / 2) return items.indexOf(item);
      }
      return items.length;
    };

    const updateInsertLine = (listEl, targetIndex, ghostEl) => {
      const items = [...listEl.querySelectorAll(itemSelector)];
      if (targetIndex >= items.length) listEl.appendChild(insertLine);
      else listEl.insertBefore(insertLine, items[targetIndex]);
    };

    const createClone = (rect, label) => {
      const clone = document.createElement('div');
      clone.setAttribute('aria-hidden', 'true');
      clone.style.cssText = [
        'position:fixed',
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'background:var(--color-surface)',
        'border:0.5px solid var(--color-border)',
        'border-radius:var(--radius-md)',
        'box-shadow:var(--shadow-drag, 0 8px 24px rgba(0,0,0,0.18))',
        'display:flex',
        'align-items:center',
        'padding:0 var(--space-3)',
        'pointer-events:none',
        'z-index:9999',
        'overflow:hidden',
        'white-space:nowrap',
        'text-overflow:ellipsis',
        'font-family:var(--font-family)',
        'font-size:var(--font-size-body)',
        'font-weight:var(--font-weight-medium)',
        'color:var(--color-text-primary)',
      ].join(';');
      clone.textContent = label;
      return clone;
    };

    const commitMove = (fromSection, fromIndex, toSection, toIndex) => {
      if (crossSection) {
        if (fromSection === toSection && (fromIndex === toIndex || fromIndex === toIndex - 1)) return;
        onMoveSection(fromSection, fromIndex, toSection, toIndex);
      } else {
        if (fromIndex === toIndex || fromIndex === toIndex - 1) return;
        onMove(fromIndex, toIndex);
      }
    };

    const onDragMove = e => {
      if (!drag) return;
      const { dragEl, clone, offsetX, offsetY } = drag;

      clone.style.left = `${e.clientX - offsetX}px`;
      clone.style.top  = `${e.clientY - offsetY}px`;

      const vh = window.innerHeight;
      if (e.clientY < SCROLL_ZONE)
        drag.scrollSpeed = -MAX_SPEED * (1 - e.clientY / SCROLL_ZONE);
      else if (e.clientY > vh - SCROLL_ZONE)
        drag.scrollSpeed =  MAX_SPEED * (1 - (vh - e.clientY) / SCROLL_ZONE);
      else
        drag.scrollSpeed = 0;

      let listEl = drag.listEl;
      if (crossSection) {
        drag.targetSection = sectionAtY(e.clientY) ?? drag.targetSection;
        listEl = listElFor(drag.targetSection);
      }
      const idx = insertIndexAt(listEl, e.clientY, dragEl);
      drag.targetIndex = idx;
      updateInsertLine(listEl, idx, dragEl);
    };

    const endDrag = () => {
      if (!drag) return;
      const { dragEl, clone, fromSection, fromIndex, targetSection, targetIndex } = drag;

      dragEl.removeEventListener('pointermove',   onDragMove);
      dragEl.removeEventListener('pointerup',     endDrag);
      dragEl.removeEventListener('pointercancel', endDrag);
      dragEl.style.opacity = '';
      cancelAnimationFrame(drag.scrollRaf);
      clone.remove();
      insertLine?.remove();
      drag = null;

      commitMove(fromSection, fromIndex, targetSection, targetIndex);
    };

    const onDragStart = e => {
      const { element: dragEl, startX, startY } = e.detail;

      let listEl, fromSection = null;
      if (crossSection) {
        fromSection = sectionOf(dragEl);
        if (!fromSection) return;
        listEl = listElFor(fromSection);
      } else {
        listEl = container;
      }

      const items     = [...listEl.querySelectorAll(itemSelector)];
      const fromIndex = items.indexOf(dragEl);
      const rect      = dragEl.getBoundingClientRect();

      dragEl.style.opacity = '0.4';

      const clone = createClone(rect, cloneLabel(e.detail));
      clone.style.left = `${rect.left}px`;
      clone.style.top  = `${rect.top}px`;
      document.body.appendChild(clone);

      if (!insertLine) {
        insertLine = document.createElement('div');
        insertLine.style.cssText = 'height:2px;border-radius:1px;margin-block:calc(var(--space-2)/2);pointer-events:none;background:var(--color-accent)';
      }

      drag = {
        dragEl, clone, listEl,
        fromSection, fromIndex,
        targetSection: fromSection, targetIndex: fromIndex,
        offsetX: startX - rect.left, offsetY: startY - rect.top,
        scrollSpeed: 0, scrollRaf: null,
      };

      const scrollLoop = () => {
        if (!drag) return;
        if (drag.scrollSpeed !== 0) window.scrollBy(0, drag.scrollSpeed);
        drag.scrollRaf = requestAnimationFrame(scrollLoop);
      };
      drag.scrollRaf = requestAnimationFrame(scrollLoop);

      dragEl.addEventListener('pointermove',   onDragMove);
      dragEl.addEventListener('pointerup',     endDrag);
      dragEl.addEventListener('pointercancel', endDrag);
    };

    const onReorderKey = e => {
      const dragEl = e.composedPath().find(n => n.matches?.(itemSelector));
      if (!dragEl) return;

      let listEl, section = null;
      if (crossSection) {
        section = sectionOf(dragEl);
        if (!section) return;
        listEl = listElFor(section);
      } else {
        listEl = container;
      }

      const items     = [...listEl.querySelectorAll(itemSelector)];
      const fromIndex = items.indexOf(dragEl);
      if (fromIndex === -1) return;
      const toIndex = e.detail.direction === -1 ? Math.max(0, fromIndex - 1) : fromIndex + 2;
      commitMove(section, fromIndex, section, toIndex);
    };

    container.addEventListener(dragStartEvent, onDragStart);
    if (reorderKeyEvent) container.addEventListener(reorderKeyEvent, onReorderKey);

    return function detach() {
      container.removeEventListener(dragStartEvent, onDragStart);
      if (reorderKeyEvent) container.removeEventListener(reorderKeyEvent, onReorderKey);
      if (drag) {
        drag.dragEl.removeEventListener('pointermove',   onDragMove);
        drag.dragEl.removeEventListener('pointerup',     endDrag);
        drag.dragEl.removeEventListener('pointercancel', endDrag);
        drag.dragEl.style.opacity = '';
        cancelAnimationFrame(drag.scrollRaf);
        drag.clone.remove();
        insertLine?.remove();
        drag = null;
      }
    };
  },
};
