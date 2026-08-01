/**
 * Pure computation module for the Shape Drawing Game.
 * Provides segment length calculation, color scale mapping,
 * perimeter, and mean segment length functions.
 *
 * All functions are stateless and deterministic.
 */

/**
 * Computes the Euclidean distance between two points.
 * @param {{x: number, y: number}} from - Start point
 * @param {{x: number, y: number}} to - End point
 * @returns {number} Non-negative distance in pixels
 */
function segmentLength(from, to) {
  var dx = to.x - from.x;
  var dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Maps a segment length to an HSL color.
 *
 * Mapping:
 *   - segmentLength = 0         -> hue 240 (blue)
 *   - segmentLength >= refLen   -> hue 0 (red)
 *   - between                   -> hue = round(240 * (1 - length / refLen))
 *   - referenceLength = 0       -> hue 240 for all lengths
 *
 * Saturation is always 100, lightness is always 50.
 *
 * @param {number} length - The segment length (non-negative)
 * @param {number} referenceLength - The reference length (non-negative)
 * @returns {{h: number, s: number, l: number}} HSL color with h in [0, 240]
 */
function colorScale(length, referenceLength) {
  var h;

  if (referenceLength <= 0) {
    h = 240;
  } else if (length >= referenceLength) {
    h = 0;
  } else if (length <= 0) {
    h = 240;
  } else {
    h = Math.round(240 * (1 - length / referenceLength));
  }

  return { h: h, s: 100, l: 50 };
}

/**
 * Computes the perimeter of a shape as the sum of all segment lengths,
 * including the closing segment if the shape is closed.
 *
 * @param {object} shape - A Shape object with a getSegments() method
 * @returns {number} Sum of all segment lengths in pixels
 */
function perimeter(shape) {
  var segments = shape.getSegments();
  var total = 0;
  for (var i = 0; i < segments.length; i++) {
    total += segmentLength(segments[i].from, segments[i].to);
  }
  return total;
}

/**
 * Computes the arithmetic mean of all segment lengths in a shape.
 *
 * @param {object} shape - A Shape object with a getSegments() method
 * @returns {number} Mean segment length in pixels, or 0 if no segments
 */
function meanSegmentLength(shape) {
  var segments = shape.getSegments();
  if (segments.length === 0) {
    return 0;
  }
  var total = 0;
  for (var i = 0; i < segments.length; i++) {
    total += segmentLength(segments[i].from, segments[i].to);
  }
  return total / segments.length;
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { segmentLength, colorScale, perimeter, meanSegmentLength };
}
