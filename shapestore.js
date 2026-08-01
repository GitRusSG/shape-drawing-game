/**
 * ShapeStore — Manages application state for the Shape Drawing Game.
 * Holds a list of closed shapes and an optional open shape.
 * All mutations emit a 'change' event via the provided EventBus.
 *
 * Constants:
 *   VERTEX_LIMIT = 100 (max vertices per shape)
 *   SHAPE_LIMIT = 100 (max closed shapes)
 */

// In Node.js, Shape must be required; in browser, it's a global from shape.js script tag.
if (typeof Shape === 'undefined' && typeof require !== 'undefined') {
  var Shape = require('./shape').Shape;
}

var VERTEX_LIMIT = 100;
var SHAPE_LIMIT = 100;

class ShapeStore {
  /**
   * @param {EventBus} eventBus - The event bus to emit 'change' events on
   */
  constructor(eventBus) {
    this._eventBus = eventBus;
    /** @type {Array<Shape>} */
    this.closedShapes = [];
    /** @type {Shape|null} */
    this.openShape = null;
  }

  /**
   * Adds a vertex at (x, y) to the open shape.
   * Creates a new open shape if none exists.
   * Rejects if:
   *   - Vertex limit (100) is reached on the open shape
   *   - Shape limit (100) is reached and no open shape exists (cannot create new shape)
   *   - The new vertex is less than 1px away from the last vertex
   *
   * Coordinates are stored as integers (rounded to nearest).
   * Emits 'change' on success.
   *
   * @param {number} x - X coordinate in canvas pixel space
   * @param {number} y - Y coordinate in canvas pixel space
   * @returns {boolean} true if vertex was added, false if rejected
   */
  addVertex(x, y) {
    var ix = Math.round(x);
    var iy = Math.round(y);

    if (this.openShape === null) {
      // Cannot create a new open shape if shape limit is reached
      // (Shape limit applies to closed shapes, but we still allow an open shape)
      // Actually per requirements, shape limit is on closed shapes.
      // Creating an open shape is always allowed.
      this.openShape = new Shape([{ x: ix, y: iy }], false);
      this._eventBus.emit('change');
      return true;
    }

    // Check vertex limit
    if (this.openShape.getVertexCount() >= VERTEX_LIMIT) {
      return false;
    }

    // Check minimum segment length (>= 1px from last vertex)
    var lastVertex = this.openShape.vertices[this.openShape.vertices.length - 1];
    var dx = ix - lastVertex.x;
    var dy = iy - lastVertex.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) {
      return false;
    }

    this.openShape.vertices.push({ x: ix, y: iy });
    this._eventBus.emit('change');
    return true;
  }

  /**
   * Closes the current open shape if it has >= 3 vertices.
   * Marks shape as closed, moves it to closedShapes, and clears open shape.
   * Emits 'change' on success.
   *
   * @returns {boolean} true if shape was closed, false if not possible
   */
  closeShape() {
    if (this.openShape === null) {
      return false;
    }

    if (this.openShape.getVertexCount() < 3) {
      return false;
    }

    // Enforce shape limit on closed shapes
    if (this.closedShapes.length >= SHAPE_LIMIT) {
      return false;
    }

    this.openShape.closed = true;
    this.closedShapes.push(this.openShape);
    this.openShape = null;
    this._eventBus.emit('change');
    return true;
  }

  /**
   * Undo the last action:
   * - If open shape has >= 2 vertices: remove the last vertex
   * - If open shape has exactly 1 vertex: remove the vertex AND the open shape
   * - If no open shape and closed shapes exist: remove the last closed shape
   * - If nothing to undo: no-op (no event emitted)
   *
   * Emits 'change' if state changed.
   */
  undo() {
    if (this.openShape !== null) {
      if (this.openShape.getVertexCount() >= 2) {
        // Remove last vertex from open shape
        this.openShape.vertices.pop();
        this._eventBus.emit('change');
      } else if (this.openShape.getVertexCount() === 1) {
        // Remove the single vertex and the open shape
        this.openShape = null;
        this._eventBus.emit('change');
      }
      // If open shape has 0 vertices (shouldn't happen), no-op
      return;
    }

    // No open shape — remove last closed shape if any
    if (this.closedShapes.length > 0) {
      this.closedShapes.pop();
      this._eventBus.emit('change');
    }
    // Else: empty store, no-op
  }

  /**
   * Cancel the current open shape entirely.
   * Retains all closed shapes.
   * No-op if no open shape exists.
   *
   * Emits 'change' if state changed.
   */
  cancel() {
    if (this.openShape === null) {
      return;
    }
    this.openShape = null;
    this._eventBus.emit('change');
  }

  /**
   * Clear all shapes (closed and open).
   * Emits 'change'.
   */
  clear() {
    this.closedShapes = [];
    this.openShape = null;
    this._eventBus.emit('change');
  }

  /**
   * Returns the vertex count of the open shape, or 0 if no open shape exists.
   * @returns {number}
   */
  getVertexCount() {
    if (this.openShape === null) {
      return 0;
    }
    return this.openShape.getVertexCount();
  }

  /**
   * Returns the number of closed shapes held by the store.
   * @returns {number}
   */
  getClosedShapeCount() {
    return this.closedShapes.length;
  }

  /**
   * Returns the current open shape, or null.
   * @returns {Shape|null}
   */
  getOpenShape() {
    return this.openShape;
  }

  /**
   * Returns the array of closed shapes.
   * @returns {Array<Shape>}
   */
  getClosedShapes() {
    return this.closedShapes;
  }

  /**
   * Serializes the store state to a JSON-compatible object.
   * Format: { shapes: [{ vertices: [[x,y], ...], closed: boolean }, ...] }
   * Closed shapes are listed first (in order), followed by the open shape if present.
   *
   * @returns {object}
   */
  toJSON() {
    var shapes = [];

    for (var i = 0; i < this.closedShapes.length; i++) {
      var s = this.closedShapes[i];
      var verts = [];
      for (var j = 0; j < s.vertices.length; j++) {
        verts.push([s.vertices[j].x, s.vertices[j].y]);
      }
      shapes.push({ vertices: verts, closed: true });
    }

    if (this.openShape !== null) {
      var openVerts = [];
      for (var k = 0; k < this.openShape.vertices.length; k++) {
        openVerts.push([this.openShape.vertices[k].x, this.openShape.vertices[k].y]);
      }
      shapes.push({ vertices: openVerts, closed: false });
    }

    return { shapes: shapes };
  }

  /**
   * Restores store state from a JSON-compatible object.
   * Expected format: { shapes: [{ vertices: [[x,y], ...], closed: boolean }, ...] }
   * Does NOT emit 'change' — caller is responsible for triggering any needed updates.
   *
   * @param {object} data - The data object to restore from
   */
  fromJSON(data) {
    this.closedShapes = [];
    this.openShape = null;

    if (!data || !Array.isArray(data.shapes)) {
      return;
    }

    for (var i = 0; i < data.shapes.length; i++) {
      var shapeData = data.shapes[i];
      var vertices = [];

      if (Array.isArray(shapeData.vertices)) {
        for (var j = 0; j < shapeData.vertices.length; j++) {
          var v = shapeData.vertices[j];
          if (Array.isArray(v) && v.length >= 2) {
            vertices.push({ x: v[0], y: v[1] });
          }
        }
      }

      var shape = new Shape(vertices, !!shapeData.closed);

      if (shape.closed) {
        this.closedShapes.push(shape);
      } else {
        this.openShape = shape;
      }
    }
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShapeStore, VERTEX_LIMIT, SHAPE_LIMIT };
}
