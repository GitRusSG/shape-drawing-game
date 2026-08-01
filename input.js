/**
 * InputRouter — Processes pointer, touch, and keyboard events on the canvas
 * and dispatches to ShapeStore.
 *
 * Dependencies (available as globals):
 *   - ShapeStore with addVertex(x, y), closeShape()
 *   - segmentLength(from, to) for distance calculations
 *   - ANCHOR_RADIUS (12px) from renderer.js
 *
 * Handles:
 *   - Canvas click: close-shape, add-vertex, or ignore (out of bounds)
 *   - Touch: validate tap (duration <= 500ms, movement <= 10px), convert to canvas coords
 *   - Synthesized click prevention after touch
 *   - Multi-touch: process only first touch point
 */

var INPUT_TOUCH_MAX_DURATION = 500;  // ms
var INPUT_TOUCH_MAX_MOVEMENT = 10;   // px
var INPUT_SYNTH_CLICK_DELAY = 300;   // ms to ignore synthesized click after touch

class InputRouter {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to listen on
   * @param {ShapeStore} store - The shape store to dispatch actions to
   */
  constructor(canvas, store) {
    this._canvas = canvas;
    this._store = store;

    // Touch tracking state
    this._touchId = null;          // identifier of the tracked touch (first touch)
    this._touchStartTime = 0;
    this._touchStartX = 0;
    this._touchStartY = 0;

    // Synthesized click suppression
    this._suppressClick = false;
    this._suppressTimer = null;

    // Bind event handlers
    this._onClickBound = this._onClick.bind(this);
    this._onTouchStartBound = this._onTouchStart.bind(this);
    this._onTouchEndBound = this._onTouchEnd.bind(this);
    this._onTouchCancelBound = this._onTouchCancel.bind(this);

    // Attach listeners
    this._canvas.addEventListener('click', this._onClickBound);
    this._canvas.addEventListener('touchstart', this._onTouchStartBound, { passive: false });
    this._canvas.addEventListener('touchend', this._onTouchEndBound, { passive: false });
    this._canvas.addEventListener('touchcancel', this._onTouchCancelBound);
  }

  /**
   * Handles mouse click on the canvas.
   * Ignores synthesized clicks that follow a processed touch event.
   * @param {MouseEvent} e
   */
  _onClick(e) {
    // Suppress synthesized click after touch
    if (this._suppressClick) {
      return;
    }

    var coords = this._getCanvasCoords(e.clientX, e.clientY);
    if (coords === null) {
      return;
    }

    this.handleCanvasClick(coords.x, coords.y);
  }

  /**
   * Handles touchstart — records the first touch point.
   * Multi-touch: only tracks the first touch; ignores additional touches.
   * @param {TouchEvent} e
   */
  _onTouchStart(e) {
    // If already tracking a touch, ignore additional touch points (multi-touch)
    if (this._touchId !== null) {
      return;
    }

    var touch = e.changedTouches[0];
    this._touchId = touch.identifier;
    this._touchStartTime = Date.now();
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
  }

  /**
   * Handles touchend — validates as a tap if duration and movement are within thresholds.
   * @param {TouchEvent} e
   */
  _onTouchEnd(e) {
    // Find the touch we're tracking
    var touch = null;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._touchId) {
        touch = e.changedTouches[i];
        break;
      }
    }

    if (touch === null) {
      return;
    }

    // Reset touch tracking
    var startTime = this._touchStartTime;
    var startX = this._touchStartX;
    var startY = this._touchStartY;
    this._touchId = null;

    // Validate duration
    var duration = Date.now() - startTime;
    if (duration > INPUT_TOUCH_MAX_DURATION) {
      return;
    }

    // Validate movement
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    var movement = Math.sqrt(dx * dx + dy * dy);
    if (movement > INPUT_TOUCH_MAX_MOVEMENT) {
      return;
    }

    // Convert touch end position to canvas coordinates
    var coords = this._getCanvasCoords(touch.clientX, touch.clientY);
    if (coords === null) {
      return;
    }

    // Process as a canvas click
    this.handleCanvasClick(coords.x, coords.y);

    // Suppress the next synthesized mouse click
    this._setSuppressClick();
  }

  /**
   * Handles touchcancel — resets touch state.
   * @param {TouchEvent} e
   */
  _onTouchCancel(e) {
    // Check if the cancelled touch is the one we're tracking
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._touchId) {
        this._touchId = null;
        break;
      }
    }
  }

  /**
   * Converts client coordinates to canvas pixel coordinates.
   * Returns null if the position is outside the canvas bounds.
   *
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @returns {{x: number, y: number}|null} Canvas coordinates rounded to integer, or null if out of bounds
   */
  _getCanvasCoords(clientX, clientY) {
    var rect = this._canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;

    // Check bounds: x in [0, width-1], y in [0, height-1]
    if (x < 0 || x > rect.width - 1 || y < 0 || y > rect.height - 1) {
      return null;
    }

    // Round to nearest integer
    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Processes a validated canvas click at (x, y).
   * Logic:
   *   1. If open shape exists with >= 3 vertices and click is within ANCHOR_RADIUS
   *      of the first vertex → close shape
   *   2. If click is near an existing vertex (from any closed shape), snap to that vertex
   *   3. Otherwise → add vertex at click position
   *
   * @param {number} x - Canvas X coordinate (integer)
   * @param {number} y - Canvas Y coordinate (integer)
   */
  handleCanvasClick(x, y) {
    var openShape = this._store.getOpenShape();

    if (openShape !== null && openShape.getVertexCount() >= 3) {
      // Check distance to first vertex
      var firstVertex = openShape.vertices[0];
      var dist = segmentLength({ x: x, y: y }, firstVertex);

      if (dist <= ANCHOR_RADIUS) {
        // Close the shape
        this._store.closeShape();
        return;
      }
    }

    // Check if click is near an existing vertex from closed shapes — snap to it
    var snapVertex = this._findNearbyVertex(x, y);
    if (snapVertex !== null) {
      // Force-add the snapped vertex, bypassing min-distance check if needed
      this._store.addVertexForce(snapVertex.x, snapVertex.y);
      return;
    }

    // Add vertex at click position
    this._store.addVertex(x, y);
  }

  /**
   * Finds the nearest vertex from any closed shape within ANCHOR_RADIUS of (x, y).
   * Also checks the open shape's vertices (so you can connect back to your own dots).
   * Returns the vertex coordinates if found, or null.
   *
   * @param {number} x - Click X coordinate
   * @param {number} y - Click Y coordinate
   * @returns {{x: number, y: number}|null}
   */
  _findNearbyVertex(x, y) {
    var closestDist = ANCHOR_RADIUS;
    var closestVertex = null;

    // Search closed shapes
    var closedShapes = this._store.getClosedShapes();
    for (var i = 0; i < closedShapes.length; i++) {
      var verts = closedShapes[i].vertices;
      for (var j = 0; j < verts.length; j++) {
        var d = segmentLength({ x: x, y: y }, verts[j]);
        if (d <= closestDist) {
          closestDist = d;
          closestVertex = verts[j];
        }
      }
    }

    // Also search the open shape's existing vertices (except the last one,
    // which would trigger the min-distance rejection anyway)
    var openShape = this._store.getOpenShape();
    if (openShape !== null && openShape.vertices.length > 1) {
      // Check all vertices except the last (to avoid snapping to where we just were)
      for (var k = 0; k < openShape.vertices.length - 1; k++) {
        var d2 = segmentLength({ x: x, y: y }, openShape.vertices[k]);
        if (d2 <= closestDist) {
          closestDist = d2;
          closestVertex = openShape.vertices[k];
        }
      }
    }

    return closestVertex;
  }

  /**
   * Sets the suppress-click flag to prevent the synthesized mouse click
   * that browsers emit after a touchend event from creating a duplicate vertex.
   */
  _setSuppressClick() {
    this._suppressClick = true;

    if (this._suppressTimer !== null) {
      clearTimeout(this._suppressTimer);
    }

    this._suppressTimer = setTimeout(function () {
      this._suppressClick = false;
      this._suppressTimer = null;
    }.bind(this), INPUT_SYNTH_CLICK_DELAY);
  }

  /**
   * Cleans up event listeners. Call when the input router is no longer needed.
   */
  destroy() {
    this._canvas.removeEventListener('click', this._onClickBound);
    this._canvas.removeEventListener('touchstart', this._onTouchStartBound);
    this._canvas.removeEventListener('touchend', this._onTouchEndBound);
    this._canvas.removeEventListener('touchcancel', this._onTouchCancelBound);

    if (this._suppressTimer !== null) {
      clearTimeout(this._suppressTimer);
      this._suppressTimer = null;
    }
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputRouter, INPUT_TOUCH_MAX_DURATION, INPUT_TOUCH_MAX_MOVEMENT, INPUT_SYNTH_CLICK_DELAY };
}
