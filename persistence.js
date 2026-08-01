/**
 * Persistence module for the Shape Drawing Game.
 * Provides serialization, parsing with validation, and localStorage adapter.
 *
 * serialize(store) — produces a JSON string from ShapeStore contents
 * parse(json) — validates and parses a JSON string back to store data
 * LocalStorageAdapter — saves/loads store state from localStorage
 */

var STORAGE_KEY = 'shape-drawing-game';
var MAX_TEXT_LENGTH = 1048576; // 1MB
var MAX_SHAPES = 100;
var MAX_VERTICES_PER_SHAPE = 100;
var MIN_VERTICES_PER_SHAPE = 1;
var MIN_VERTICES_CLOSED = 3;
var MAX_COORDINATE = 10000;
var MIN_COORDINATE = 0;

/**
 * Serializes the ShapeStore contents to a JSON string.
 * Each vertex coordinate is written as an integer.
 * Produces identical JSON on every invocation for identical contents.
 *
 * @param {ShapeStore} store - The store to serialize
 * @returns {string} JSON string representation
 */
function serialize(store) {
  var data = store.toJSON();

  // Ensure coordinates are integers (Req 7.9)
  for (var i = 0; i < data.shapes.length; i++) {
    var shape = data.shapes[i];
    for (var j = 0; j < shape.vertices.length; j++) {
      shape.vertices[j][0] = Math.round(shape.vertices[j][0]);
      shape.vertices[j][1] = Math.round(shape.vertices[j][1]);
    }
  }

  return JSON.stringify(data);
}

/**
 * Parses a JSON string and validates it against all parser constraints.
 * Returns { ok: true, data } on success or { ok: false, error } on failure.
 *
 * Constraints (Req 7.8):
 * - Text ≤ 1,048,576 characters (1MB)
 * - Parses as valid JSON
 * - At most 100 shapes
 * - At most 1 shape with closed: false (open shape)
 * - Every shape has 1–100 vertices
 * - Every closed shape has ≥ 3 vertices
 * - Every vertex coordinate is a finite number in [0, 10000]
 *
 * @param {string} json - The JSON string to parse
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
function parse(json) {
  // Check text length
  if (typeof json !== 'string') {
    return { ok: false, error: 'Input is not a string' };
  }

  if (json.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: 'Text exceeds maximum length of 1,048,576 characters' };
  }

  // Parse JSON
  var data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: 'Text is not valid JSON' };
  }

  // Validate top-level structure
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'JSON root must be an object' };
  }

  if (!Array.isArray(data.shapes)) {
    return { ok: false, error: 'JSON must contain a "shapes" array' };
  }

  // Check shape count limit
  if (data.shapes.length > MAX_SHAPES) {
    return { ok: false, error: 'Shape count exceeds maximum of ' + MAX_SHAPES };
  }

  // Validate each shape
  var openShapeCount = 0;

  for (var i = 0; i < data.shapes.length; i++) {
    var shape = data.shapes[i];

    if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
      return { ok: false, error: 'Shape at index ' + i + ' must be an object' };
    }

    // Validate closed field
    var isClosed = !!shape.closed;

    if (!isClosed) {
      openShapeCount++;
      if (openShapeCount > 1) {
        return { ok: false, error: 'At most 1 open shape is allowed' };
      }
    }

    // Validate vertices array
    if (!Array.isArray(shape.vertices)) {
      return { ok: false, error: 'Shape at index ' + i + ' must have a "vertices" array' };
    }

    var vertexCount = shape.vertices.length;

    // Check vertex count bounds
    if (vertexCount < MIN_VERTICES_PER_SHAPE || vertexCount > MAX_VERTICES_PER_SHAPE) {
      return { ok: false, error: 'Shape at index ' + i + ' has ' + vertexCount + ' vertices; must be between 1 and 100' };
    }

    // Closed shapes must have at least 3 vertices
    if (isClosed && vertexCount < MIN_VERTICES_CLOSED) {
      return { ok: false, error: 'Closed shape at index ' + i + ' has ' + vertexCount + ' vertices; closed shapes require at least 3' };
    }

    // Validate each vertex coordinate
    for (var j = 0; j < shape.vertices.length; j++) {
      var vertex = shape.vertices[j];

      if (!Array.isArray(vertex) || vertex.length < 2) {
        return { ok: false, error: 'Vertex at shape ' + i + ', index ' + j + ' must be an array of at least 2 elements' };
      }

      var x = vertex[0];
      var y = vertex[1];

      // Check coordinate is a finite number
      if (typeof x !== 'number' || !isFinite(x)) {
        return { ok: false, error: 'Vertex at shape ' + i + ', index ' + j + ' has non-finite x coordinate' };
      }
      if (typeof y !== 'number' || !isFinite(y)) {
        return { ok: false, error: 'Vertex at shape ' + i + ', index ' + j + ' has non-finite y coordinate' };
      }

      // Check coordinate range [0, 10000]
      if (x < MIN_COORDINATE || x > MAX_COORDINATE) {
        return { ok: false, error: 'Vertex at shape ' + i + ', index ' + j + ' has x coordinate ' + x + ' outside [0, 10000]' };
      }
      if (y < MIN_COORDINATE || y > MAX_COORDINATE) {
        return { ok: false, error: 'Vertex at shape ' + i + ', index ' + j + ' has y coordinate ' + y + ' outside [0, 10000]' };
      }
    }
  }

  return { ok: true, data: data };
}

/**
 * LocalStorageAdapter — handles saving and loading ShapeStore state
 * from browser localStorage under the key "shape-drawing-game".
 */
class LocalStorageAdapter {
  /**
   * @param {ShapeStore} store - The store to save/load
   */
  constructor(store) {
    this._store = store;
  }

  /**
   * Serializes the store and writes to localStorage.
   * Silently catches any errors (Req 7.5).
   */
  save() {
    try {
      var json = serialize(this._store);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      // Silently ignore localStorage failures
    }
  }

  /**
   * Reads from localStorage and parses the value.
   * Returns:
   *   { ok: true, data: <parsed data> } if valid data exists
   *   { ok: true, data: null } if key doesn't exist (Req 7.10)
   *   { ok: false, error: <message> } if data exists but is invalid
   *
   * @returns {{ok: true, data: object|null} | {ok: false, error: string}}
   */
  load() {
    try {
      var json = localStorage.getItem(STORAGE_KEY);

      if (json === null) {
        return { ok: true, data: null };
      }

      return parse(json);
    } catch (e) {
      return { ok: false, error: 'Failed to read from localStorage: ' + e.message };
    }
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serialize,
    parse,
    LocalStorageAdapter,
    STORAGE_KEY,
    MAX_TEXT_LENGTH,
    MAX_SHAPES,
    MAX_VERTICES_PER_SHAPE,
    MIN_VERTICES_PER_SHAPE,
    MIN_VERTICES_CLOSED,
    MAX_COORDINATE,
    MIN_COORDINATE
  };
}
