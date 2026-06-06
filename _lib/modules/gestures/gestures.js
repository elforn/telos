const TAP_THRESHOLD = 18;
const LONG_PRESS_DELAY = 500;

export const Gestures = (Base) => class extends Base {
  connectedCallback() {
    super.connectedCallback?.();

    const hasTap = typeof this.onTap === 'function';
    const hasLongPress = typeof this.onLongPress === 'function';
    const hasSwipe = typeof this.onSwipe === 'function';
    const hasHoldDrag = typeof this.onHoldDragStart === 'function';

    if (!hasTap && !hasLongPress && !hasSwipe && !hasHoldDrag) return;

    if (!this._pointerDown) {
      if (hasHoldDrag || hasSwipe) {
        this.style.touchAction = 'pan-y';
      } else {
        this.style.touchAction = 'manipulation';
      }
      if (hasLongPress || hasHoldDrag) this.style.userSelect = 'none';

      this._pointerDown = this._gestureDown.bind(this);
      this._pointerMove = this._gestureMove.bind(this);
      this._pointerUp = this._gestureUp.bind(this);
      this._pointerCancel = this._gestureCancel.bind(this);
    }

    this.addEventListener('pointerdown', this._pointerDown);

    if (hasHoldDrag && typeof this.onHoldDragKey === 'function' && !this._holdDragKeyHandler) {
      this._holdDragKeyHandler = e => {
        // Only fire when the host itself is focused, not a shadow-DOM child.
        // composedPath()[0] is the actual event target before retargeting.
        if (e.composedPath()[0] !== this) return;
        if (e.key === 'ArrowLeft')  this.onHoldDragKey('left');
        if (e.key === 'ArrowRight') this.onHoldDragKey('right');
      };
      this.addEventListener('keydown', this._holdDragKeyHandler);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    clearTimeout(this._longPressTimer);
    this._gestureRemoveInflight();
    this._gesture = null;
    if (this._pointerDown) this.removeEventListener('pointerdown', this._pointerDown);
    if (this._holdDragKeyHandler) {
      this.removeEventListener('keydown', this._holdDragKeyHandler);
      this._holdDragKeyHandler = null;
    }
  }

  _gestureDown(e) {
    if (e.button !== 0) return;
    // Do not capture here — capturing on pointerdown redirects click events to the
    // host element, breaking clicks on child buttons. Capture is deferred to when
    // the gesture type is confirmed (swipe threshold crossed, or hold timer fires).
    this.addEventListener('pointermove', this._pointerMove);
    this.addEventListener('pointerup', this._pointerUp);
    this.addEventListener('pointercancel', this._pointerCancel);
    this._gesture = {
      startX: e.clientX, startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      phase: 'tracking', // 'tracking' | 'swipe' | 'holdDrag' | 'cancelled'
      originalEvent: e,
    };

    if (typeof this.onHoldDragStart === 'function') {
      this._longPressTimer = setTimeout(() => {
        if (this._gesture?.phase === 'tracking') {
          this._gesture.phase = 'holdDrag';
          this.setPointerCapture(this._gesture.pointerId);
          navigator.vibrate?.(40);
          this.onHoldDragStart(this._gestureEvent('holddragstart',
            this._gesture.startX, this._gesture.startY,
            this._gesture.startX, this._gesture.startY,
            this._gesture));
        }
      }, LONG_PRESS_DELAY);
    } else if (typeof this.onLongPress === 'function') {
      this._longPressTimer = setTimeout(() => {
        if (this._gesture?.phase === 'tracking') {
          this._gesture.phase = 'cancelled';
          const g = this._gesture;
          this.onLongPress(this._gestureEvent('longpress', g.startX, g.startY, g.startX, g.startY, g));
        }
      }, LONG_PRESS_DELAY);
    }
  }

  _gestureMove(e) {
    const g = this._gesture;
    if (!g) return;

    if (g.phase === 'holdDrag') {
      if (typeof this.onHoldDrag === 'function') {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        this.onHoldDrag(this._gestureEventDelta('holddrag', g, e.clientX, e.clientY, dx, dy));
      }
      return;
    }

    if (g.phase === 'swipe') {
      if (typeof this.onSwipeMove === 'function') {
        const dx = e.clientX - g.startX;
        this.onSwipeMove(this._gestureEventDelta('swipemove', g, e.clientX, g.startY, dx, 0));
      }
      return;
    }

    if (g.phase !== 'tracking') return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.sqrt(dx * dx + dy * dy) <= TAP_THRESHOLD) return;

    clearTimeout(this._longPressTimer);

    const isVertical = Math.abs(dy) >= Math.abs(dx);

    if (typeof this.onSwipe === 'function') {
      if (isVertical) {
        g.phase = 'cancelled';
        this._gestureRemoveInflight();
      } else {
        this.setPointerCapture(e.pointerId);
        g.phase = 'swipe';
        if (typeof this.onSwipeMove === 'function') {
          this.onSwipeMove(this._gestureEventDelta('swipemove', g, e.clientX, g.startY, dx, 0));
        }
      }
    } else if (typeof this.onHoldDragStart === 'function') {
      if (isVertical) {
        g.phase = 'cancelled';
        this._gestureRemoveInflight();
      }
      // Horizontal during hold-wait — keep tracking, let hold timer run
    } else {
      g.phase = 'cancelled';
    }
  }

  _gestureUp(e) {
    const g = this._gesture;
    if (!g) return;
    clearTimeout(this._longPressTimer);
    this._gestureRemoveInflight();
    this._gesture = null;

    if (g.phase === 'holdDrag') {
      if (typeof this.onHoldDragEnd === 'function') {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        this.onHoldDragEnd(this._gestureEventDelta('holddragend', g, e.clientX, e.clientY, dx, dy));
      }
      return;
    }

    if (g.phase === 'swipe') {
      if (typeof this.onSwipe === 'function') {
        const dx = e.clientX - g.startX;
        const duration = Date.now() - g.startTime;
        this.onSwipe({
          type: 'swipe',
          startX: g.startX, startY: g.startY,
          endX: e.clientX, endY: g.startY,
          dx, dy: 0,
          distance: Math.abs(dx),
          duration,
          direction: dx > 0 ? 'right' : 'left',
          velocity: duration > 0 ? Math.abs(dx) / duration : 0,
          originalEvent: g.originalEvent,
        });
      }
      return;
    }

    if (g.phase === 'cancelled') return;

    if (typeof this.onTap === 'function') {
      this.onTap(this._gestureEvent('tap', g.startX, g.startY, e.clientX, e.clientY, g));
    }
  }

  _gestureCancel() {
    const g = this._gesture;
    clearTimeout(this._longPressTimer);
    this._gestureRemoveInflight();
    this._gesture = null;
    if (g?.phase === 'holdDrag' && typeof this.onHoldDragEnd === 'function') {
      this.onHoldDragEnd(this._gestureEvent('holddragend', g.startX, g.startY, g.startX, g.startY, g));
    }
  }

  _gestureRemoveInflight() {
    this.removeEventListener('pointermove', this._pointerMove);
    this.removeEventListener('pointerup', this._pointerUp);
    this.removeEventListener('pointercancel', this._pointerCancel);
  }

  _gestureEvent(type, startX, startY, endX, endY, g) {
    const dx = endX - startX;
    const dy = endY - startY;
    return {
      type, startX, startY, endX, endY,
      dx, dy,
      distance: Math.sqrt(dx * dx + dy * dy),
      duration: Date.now() - g.startTime,
      direction: null, velocity: null,
      originalEvent: g.originalEvent,
    };
  }

  _gestureEventDelta(type, g, endX, endY, dx, dy) {
    return {
      type,
      startX: g.startX, startY: g.startY,
      endX, endY, dx, dy,
      distance: Math.sqrt(dx * dx + dy * dy),
      duration: Date.now() - g.startTime,
      direction: dx > 0 ? 'right' : dx < 0 ? 'left' : null,
      velocity: null,
      originalEvent: g.originalEvent,
    };
  }
};

Gestures.attach = (element, handlers) => {
  let gesture = null;
  let longPressTimer = null;

  const removeInflight = () => {
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
  };

  const makeEvent = (type, g, endX, endY, dx, dy) => ({
    type,
    startX: g.startX, startY: g.startY,
    endX, endY, dx, dy,
    distance: Math.sqrt(dx * dx + dy * dy),
    duration: Date.now() - g.startTime,
    direction: dx > 0 ? 'right' : dx < 0 ? 'left' : null,
    velocity: null,
    originalEvent: g.originalEvent,
  });

  const onDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Capture immediately — attach() targets structural sub-elements (drag handles,
    // sliders) that have no interactive children that need to receive click events.
    element.setPointerCapture(e.pointerId);
    gesture = { startX: e.clientX, startY: e.clientY, startTime: Date.now(), phase: 'tracking', originalEvent: e };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    if (handlers.onHoldDragStart) {
      longPressTimer = setTimeout(() => {
        if (gesture?.phase === 'tracking') {
          gesture.phase = 'holdDrag';
          navigator.vibrate?.(40);
          handlers.onHoldDragStart(makeEvent('holddragstart', gesture, gesture.startX, gesture.startY, 0, 0));
        }
      }, LONG_PRESS_DELAY);
    }
  };

  const hasSwipe = !!(handlers.onSwipe || handlers.onSwipeMove);
  const hasHoldDragHandlers = !!(handlers.onHoldDragStart || handlers.onHoldDrag || handlers.onHoldDragEnd);

  if (hasHoldDragHandlers && !element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '0');
  }

  let keydownHandler = null;
  if (hasHoldDragHandlers) {
    keydownHandler = e => {
      if (e.key === 'ArrowLeft')  handlers.onHoldDragKey?.('left');
      if (e.key === 'ArrowRight') handlers.onHoldDragKey?.('right');
    };
    element.addEventListener('keydown', keydownHandler);
  }

  const onMove = (e) => {
    if (!gesture) return;
    const g = gesture;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.phase === 'holdDrag') {
      handlers.onHoldDrag?.(makeEvent('holddrag', g, e.clientX, e.clientY, dx, dy));
      return;
    }
    if (g.phase === 'swipe') {
      handlers.onSwipeMove?.(makeEvent('swipemove', g, e.clientX, g.startY, dx, 0));
      return;
    }
    if (g.phase !== 'tracking') return;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD) {
      clearTimeout(longPressTimer);
      const isVertical = Math.abs(dy) >= Math.abs(dx);
      if (hasSwipe) {
        if (isVertical) {
          g.phase = 'cancelled';
          element.releasePointerCapture(e.pointerId);
          removeInflight();
        } else {
          g.phase = 'swipe';
          handlers.onSwipeMove?.(makeEvent('swipemove', g, e.clientX, g.startY, dx, 0));
        }
      } else if (handlers.onHoldDragStart) {
        if (isVertical) {
          g.phase = 'cancelled';
          element.releasePointerCapture(e.pointerId);
          removeInflight();
        }
      } else {
        g.phase = 'cancelled';
      }
    }
  };

  const onUp = (e) => {
    const g = gesture;
    clearTimeout(longPressTimer);
    removeInflight();
    gesture = null;
    if (g?.phase === 'holdDrag') {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      handlers.onHoldDragEnd?.(makeEvent('holddragend', g, e.clientX, e.clientY, dx, dy));
      return;
    }
    if (g?.phase === 'swipe') {
      const dx = e.clientX - g.startX;
      const duration = Date.now() - g.startTime;
      handlers.onSwipe?.({
        type: 'swipe',
        startX: g.startX, startY: g.startY,
        endX: e.clientX, endY: g.startY,
        dx, dy: 0,
        distance: Math.abs(dx),
        duration,
        direction: dx > 0 ? 'right' : 'left',
        velocity: duration > 0 ? Math.abs(dx) / duration : 0,
        originalEvent: g.originalEvent,
      });
    }
  };

  const onCancel = () => {
    const g = gesture;
    clearTimeout(longPressTimer);
    removeInflight();
    gesture = null;
    if (g?.phase === 'holdDrag') {
      handlers.onHoldDragEnd?.(makeEvent('holddragend', g, g.startX, g.startY, 0, 0));
    }
  };

  element.style.touchAction = (hasSwipe || !!handlers.onHoldDragStart) ? 'pan-y' : 'none';
  element.style.userSelect = 'none';
  element.addEventListener('pointerdown', onDown);

  return () => {
    clearTimeout(longPressTimer);
    removeInflight();
    element.removeEventListener('pointerdown', onDown);
    if (keydownHandler) element.removeEventListener('keydown', keydownHandler);
    gesture = null;
  };
};
