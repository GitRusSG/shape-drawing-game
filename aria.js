/**
 * AriaLiveRegion — Updates the ARIA live region with current state information.
 *
 * Subscribes to EventBus 'change' event and updates #aria-live textContent
 * with a summary of the current store state (<= 200 characters).
 *
 * Format:
 *   "X vertices in current shape. Y closed shapes. Last shape was closed."
 *   or without the "last shape was closed" suffix if the most recent action was not a close.
 *
 * The "no change occurred" announcement is handled by KeyboardHandler directly.
 *
 * Requirements: 9.4, 9.5, 9.7
 */
class AriaLiveRegion {
  /**
   * @param {ShapeStore} store - The ShapeStore instance
   * @param {EventBus} eventBus - The EventBus to subscribe to
   */
  constructor(store, eventBus) {
    this._store = store;
    this._eventBus = eventBus;
    this._ariaLive = document.getElementById('aria-live');
    this._prevClosedCount = store.getClosedShapeCount();

    this._handleChange = this._handleChange.bind(this);
    this._eventBus.on('change', this._handleChange);
  }

  /**
   * Handles store 'change' events by updating the ARIA live region text.
   * Detects whether the most recent action was a shape close by comparing
   * the closed shape count before and after the change.
   */
  _handleChange() {
    var currentClosedCount = this._store.getClosedShapeCount();
    var wasClosed = currentClosedCount > this._prevClosedCount;
    this._prevClosedCount = currentClosedCount;

    this._update(wasClosed);
  }

  /**
   * Builds and sets the ARIA live region text.
   * Text is kept <= 200 characters.
   *
   * @param {boolean} lastWasClosed - Whether the most recent action closed a shape
   */
  _update(lastWasClosed) {
    if (!this._ariaLive) {
      return;
    }

    var vertexCount = this._store.getVertexCount();
    var closedCount = this._store.getClosedShapeCount();

    var text = vertexCount + ' vertices in current shape. ' +
               closedCount + ' closed shapes.';

    if (lastWasClosed) {
      text += ' Last shape was closed.';
    }

    // Ensure text does not exceed 200 characters
    if (text.length > 200) {
      text = text.substring(0, 200);
    }

    this._ariaLive.textContent = text;
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AriaLiveRegion };
}
