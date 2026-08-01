/**
 * KeyboardHandler — Manages keyboard activation of control buttons.
 *
 * Responsibilities:
 * - Suppress Space key default scroll behavior on control buttons
 * - Ensure Enter/Space triggers the same ShapeStore action as a click
 * - Maintain focus on the activated control after state change
 * - Detect when activation produces no state change and announce via ARIA live region
 *
 * Requirements: 9.1, 9.3, 9.6, 9.7
 */
class KeyboardHandler {
  /**
   * @param {ShapeStore} store - The ShapeStore instance
   * @param {EventBus} eventBus - The EventBus for detecting state changes
   */
  constructor(store, eventBus) {
    this._store = store;
    this._eventBus = eventBus;

    this._btnUndo = document.getElementById('btn-undo');
    this._btnClear = document.getElementById('btn-clear');
    this._btnCancel = document.getElementById('btn-cancel');
    this._ariaLive = document.getElementById('aria-live');

    this._buttons = [this._btnUndo, this._btnClear, this._btnCancel];

    this._bindEvents();
  }

  /**
   * Binds keydown event listeners on each control button.
   */
  _bindEvents() {
    for (var i = 0; i < this._buttons.length; i++) {
      var btn = this._buttons[i];
      if (btn) {
        btn.addEventListener('keydown', this._handleKeydown.bind(this));
      }
    }
  }

  /**
   * Handles keydown events on control buttons.
   * On Enter or Space:
   *   1. Prevents default (suppresses Space scroll)
   *   2. Activates the control's action on ShapeStore
   *   3. Detects whether state changed
   *   4. If no change, updates ARIA live region with "no change occurred"
   *   5. Ensures focus remains on the activated button
   *
   * @param {KeyboardEvent} event
   */
  _handleKeydown(event) {
    // Only handle Enter and Space
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    // Prevent default behavior (Space scroll, Enter form submit)
    event.preventDefault();

    var button = event.currentTarget;

    // Determine if the store has meaningful content before activation.
    // This lets us detect "no real change" even if the method emits 'change' unconditionally.
    var hadContent = this._store.getClosedShapeCount() > 0 || this._store.getOpenShape() !== null;

    // Track whether a 'change' event fires during activation
    var changed = false;
    var changeListener = function() {
      changed = true;
    };
    this._eventBus.on('change', changeListener);

    // Activate the appropriate store method
    if (button === this._btnUndo) {
      this._store.undo();
    } else if (button === this._btnClear) {
      this._store.clear();
    } else if (button === this._btnCancel) {
      this._store.cancel();
    }

    // Remove our temporary listener
    this._eventBus.off('change', changeListener);

    // Determine if a real state change occurred.
    // clear() always emits 'change', but if store was already empty, nothing actually changed.
    var realChange = changed;
    if (button === this._btnClear && !hadContent) {
      realChange = false;
    }

    // Req 9.7: If no state change occurred, announce via ARIA live region
    if (!realChange && this._ariaLive) {
      this._ariaLive.textContent = 'No change occurred.';
    }

    // Req 9.6: Keep focus on the activated control
    button.focus();
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KeyboardHandler };
}
