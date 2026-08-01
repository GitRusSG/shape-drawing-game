/**
 * UIPanel — Manages measurements display, color legend, and info/error messages.
 *
 * Subscribes to EventBus 'change' event and updates DOM measurements within 100ms.
 * Displays a color legend with >= 5 swatches evenly spaced from 0 to reference length.
 * Shows auto-dismissing messages for error/info conditions.
 *
 * Dependencies (available as globals):
 *   - segmentLength(from, to) → number
 *   - perimeter(shape) → number
 *   - colorScale(length, referenceLength) → {h, s, l}
 *   - ShapeStore with getOpenShape(), getClosedShapes(), getClosedShapeCount()
 *   - Shape with vertices, closed, getSegments(), getVertexCount()
 *   - EventBus with on/off/emit
 *
 * HTML elements expected:
 *   - #measure-vertices (dd element for vertex count)
 *   - #measure-segment (dd element for last segment length "X px")
 *   - #measure-perimeter (dd element for perimeter "X px")
 *   - #measure-closed (dd element for closed shape count)
 *   - #legend-swatches (container div for color legend swatches)
 *   - #messages (div for info/error messages)
 */

var MESSAGE_DISMISS_MS = 3000;
var LEGEND_SWATCH_COUNT = 7;

class UIPanel {
  /**
   * @param {ShapeStore} store - The shape store to read state from
   * @param {EventBus} eventBus - The event bus to subscribe to
   * @param {number} referenceLength - The reference length for the color legend (canvas diagonal)
   */
  constructor(store, eventBus, referenceLength) {
    this._store = store;
    this._eventBus = eventBus;
    this._referenceLength = referenceLength;

    // DOM element references
    this._elVertices = document.getElementById('measure-vertices');
    this._elSegment = document.getElementById('measure-segment');
    this._elPerimeter = document.getElementById('measure-perimeter');
    this._elClosed = document.getElementById('measure-closed');
    this._elSwatches = document.getElementById('legend-swatches');
    this._elMessages = document.getElementById('messages');

    // Message dismiss state
    this._messageTimer = null;
    this._dismissOnClickBound = this._dismissOnClick.bind(this);

    // Track last perimeter for display persistence (keep displayed until next close)
    this._lastPerimeter = 0;
    // Track previous closed shape count to detect when a new shape is closed
    this._prevClosedCount = store.getClosedShapeCount();

    // Bind change handler
    this._onChangeBound = this._onStoreChange.bind(this);
    this._eventBus.on('change', this._onChangeBound);

    // Render initial state
    this.renderColorLegend();
    this.updateMeasurements();
  }

  /**
   * Updates the reference length (e.g., on canvas resize) and re-renders legend.
   * @param {number} referenceLength
   */
  setReferenceLength(referenceLength) {
    this._referenceLength = referenceLength;
    this.renderColorLegend();
  }

  /**
   * Renders the color legend with >= 5 swatches evenly spaced from 0 to referenceLength.
   * Each swatch shows a colored rectangle and a numeric label in pixels.
   */
  renderColorLegend() {
    if (!this._elSwatches) return;

    var refLen = this._referenceLength;
    var count = LEGEND_SWATCH_COUNT;

    // Clear existing swatches
    this._elSwatches.innerHTML = '';

    for (var i = 0; i < count; i++) {
      // Evenly spaced lengths from 0 to referenceLength inclusive
      var len = (count > 1) ? (refLen * i / (count - 1)) : 0;
      var color = colorScale(len, refLen);
      var label = Math.round(len);

      var swatchEl = document.createElement('div');
      swatchEl.className = 'swatch';

      var colorEl = document.createElement('div');
      colorEl.className = 'swatch-color';
      colorEl.style.backgroundColor = 'hsl(' + color.h + ', ' + color.s + '%, ' + color.l + '%)';

      var labelEl = document.createElement('span');
      labelEl.textContent = label + ' px';

      swatchEl.appendChild(colorEl);
      swatchEl.appendChild(labelEl);
      this._elSwatches.appendChild(swatchEl);
    }
  }

  /**
   * Updates all measurement displays from the current store state.
   * Called on every 'change' event from the EventBus.
   */
  updateMeasurements() {
    var openShape = this._store.getOpenShape();
    var closedCount = this._store.getClosedShapeCount();

    // Vertex count
    var vertexCount = 0;
    var lastSegLen = 0;

    if (openShape !== null) {
      vertexCount = openShape.getVertexCount();

      // Last segment length: length of the most recently drawn segment
      var segments = openShape.getSegments();
      if (segments.length > 0) {
        var lastSeg = segments[segments.length - 1];
        lastSegLen = Math.round(segmentLength(lastSeg.from, lastSeg.to));
      }
    }

    // Update DOM
    if (this._elVertices) {
      this._elVertices.textContent = vertexCount;
    }
    if (this._elSegment) {
      this._elSegment.textContent = lastSegLen + ' px';
    }
    if (this._elPerimeter) {
      this._elPerimeter.textContent = this._lastPerimeter + ' px';
    }
    if (this._elClosed) {
      this._elClosed.textContent = closedCount;
    }
  }

  /**
   * Internal handler for store 'change' events.
   * Checks if the closed shape count increased (shape was just closed) to update perimeter.
   * Per Req 6.2: perimeter is kept displayed until the *next* shape is closed.
   * Per Req 6.6: if store is empty, display 0.
   */
  _onStoreChange() {
    var closedShapes = this._store.getClosedShapes();
    var currentClosedCount = closedShapes.length;

    // Update perimeter only when a new shape is closed (count increased)
    if (currentClosedCount > this._prevClosedCount) {
      var lastClosed = closedShapes[closedShapes.length - 1];
      this._lastPerimeter = Math.round(perimeter(lastClosed));
    }

    // If store is completely empty, reset perimeter (Req 6.6)
    if (currentClosedCount === 0 && this._store.getOpenShape() === null) {
      this._lastPerimeter = 0;
    }

    this._prevClosedCount = currentClosedCount;
    this.updateMeasurements();
  }

  /**
   * Shows a message in the messages area. Auto-dismisses after 3 seconds
   * or on the next click anywhere in the document, whichever comes first.
   *
   * @param {string} text - The message to display
   */
  showMessage(text) {
    if (!this._elMessages) return;

    // Clear any existing message first
    this._clearMessage();

    this._elMessages.textContent = text;

    // Auto-dismiss after 3 seconds
    this._messageTimer = setTimeout(function () {
      this._clearMessage();
    }.bind(this), MESSAGE_DISMISS_MS);

    // Dismiss on next click anywhere
    document.addEventListener('click', this._dismissOnClickBound, { once: true });
  }

  /**
   * Clears the current message and any pending dismiss timers.
   */
  _clearMessage() {
    if (this._elMessages) {
      this._elMessages.textContent = '';
    }
    if (this._messageTimer !== null) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    // Remove click listener if still active
    document.removeEventListener('click', this._dismissOnClickBound);
  }

  /**
   * Click handler for auto-dismiss on next click.
   */
  _dismissOnClick() {
    this._clearMessage();
  }

  /**
   * Cleans up event listeners. Call when panel is no longer needed.
   */
  destroy() {
    this._eventBus.off('change', this._onChangeBound);
    this._clearMessage();
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIPanel, MESSAGE_DISMISS_MS, LEGEND_SWATCH_COUNT };
}
