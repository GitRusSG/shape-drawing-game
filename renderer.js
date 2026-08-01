/**
 * CanvasRenderer — Handles all drawing to the HTML5 Canvas.
 *
 * Subscribes to the EventBus 'change' event and performs a full redraw
 * from the ShapeStore state on every change. Supports DPR scaling and
 * debounced resize handling.
 *
 * Dependencies (available as globals):
 *   - colorScale(length, referenceLength) → {h, s, l}
 *   - segmentLength(from, to) → number
 *   - meanSegmentLength(shape) → number
 *   - Shape class with getSegments(), getVertexCount(), vertices, closed
 *   - EventBus with on/off/emit
 */

var ANCHOR_RADIUS = 12;
var VERTEX_MARKER_RADIUS = 4;
var SEGMENT_STROKE_WIDTH = 3;
var RESIZE_DEBOUNCE_MS = 150;
var MAX_DPR = 3;

class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   * @param {ShapeStore} store - The shape store to read state from
   * @param {EventBus} eventBus - The event bus to subscribe to
   */
  constructor(canvas, store, eventBus) {
    this._canvas = canvas;
    this._store = store;
    this._eventBus = eventBus;
    this._ctx = canvas.getContext('2d');
    this._referenceLength = 0;
    this._resizeTimer = null;

    // Bind methods for event handling
    this._onChangeBound = this.redraw.bind(this);
    this._onResizeBound = this._handleResizeEvent.bind(this);

    // Subscribe to store changes
    this._eventBus.on('change', this._onChangeBound);

    // Listen for window resize
    window.addEventListener('resize', this._onResizeBound);

    // Initial DPR setup and reference length calculation
    this.setupDPR();
    this._computeReferenceLength();
  }

  /**
   * Configures the canvas backing store for the device pixel ratio.
   * Clamps DPR to range [1, 3] and scales the context accordingly.
   */
  setupDPR() {
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    dpr = Math.max(dpr, 1);
    dpr = Math.round(dpr);

    // Get CSS display size
    var rect = this._canvas.getBoundingClientRect();
    var cssWidth = rect.width;
    var cssHeight = rect.height;

    // Set backing store size
    this._canvas.width = Math.round(cssWidth * dpr);
    this._canvas.height = Math.round(cssHeight * dpr);

    // Reset and apply scale
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._ctx.scale(dpr, dpr);

    this._dpr = dpr;
    this._cssWidth = cssWidth;
    this._cssHeight = cssHeight;
  }

  /**
   * Computes the reference length as the diagonal of the canvas in CSS pixels.
   */
  _computeReferenceLength() {
    var w = this._cssWidth;
    var h = this._cssHeight;
    this._referenceLength = Math.sqrt(w * w + h * h);
  }

  /**
   * Internal resize event handler — debounces at 150ms.
   */
  _handleResizeEvent() {
    if (this._resizeTimer !== null) {
      clearTimeout(this._resizeTimer);
    }
    this._resizeTimer = setTimeout(function () {
      this._resizeTimer = null;
      this.setupDPR();
      this._computeReferenceLength();
      this.redraw();
    }.bind(this), RESIZE_DEBOUNCE_MS);
  }

  /**
   * Performs a full canvas clear and redraw from the store state.
   * Draws all closed shapes first, then the open shape.
   */
  redraw() {
    var ctx = this._ctx;
    var w = this._cssWidth;
    var h = this._cssHeight;

    // Clear entire canvas (in CSS pixel space, since ctx is scaled)
    ctx.clearRect(0, 0, w, h);

    var refLen = this._referenceLength;

    // Draw closed shapes
    var closedShapes = this._store.getClosedShapes();
    for (var i = 0; i < closedShapes.length; i++) {
      this._drawClosedShape(closedShapes[i], refLen);
    }

    // Draw vertex markers on closed shapes (small dots showing connection points)
    for (var ci = 0; ci < closedShapes.length; ci++) {
      var cverts = closedShapes[ci].vertices;
      for (var cv = 0; cv < cverts.length; cv++) {
        ctx.beginPath();
        ctx.arc(cverts[cv].x, cverts[cv].y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
      }
    }

    // Draw open shape
    var openShape = this._store.getOpenShape();
    if (openShape !== null) {
      this._drawOpenShape(openShape, refLen);
    }
  }

  /**
   * Draws a closed shape: segments with color-scale colors,
   * then fills interior with a gradient that blends between each segment's color.
   * @param {Shape} shape - A closed shape
   * @param {number} refLen - The current reference length
   */
  _drawClosedShape(shape, refLen) {
    var ctx = this._ctx;
    var segments = shape.getSegments();

    // Draw each segment with its color
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var len = segmentLength(seg.from, seg.to);
      var color = colorScale(len, refLen);
      this._drawSegment(seg, color);
    }

    // Fill interior with gradient blending between segment colors
    if (segments.length > 0 && shape.vertices.length >= 3) {
      // Compute centroid for radial gradient center
      var cx = 0, cy = 0;
      for (var j = 0; j < shape.vertices.length; j++) {
        cx += shape.vertices[j].x;
        cy += shape.vertices[j].y;
      }
      cx /= shape.vertices.length;
      cy /= shape.vertices.length;

      // Find max distance from centroid to any vertex (for gradient radius)
      var maxDist = 0;
      for (var k = 0; k < shape.vertices.length; k++) {
        var dx = shape.vertices[k].x - cx;
        var dy = shape.vertices[k].y - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) maxDist = d;
      }

      // Create a conic-style gradient by layering multiple linear gradients
      // For each segment, add a gradient stop at the midpoint angle
      // Use a simpler approach: radial gradient with color stops from each segment
      var numSegs = segments.length;
      
      // Clip to shape path first
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
      for (var m = 1; m < shape.vertices.length; m++) {
        ctx.lineTo(shape.vertices[m].x, shape.vertices[m].y);
      }
      ctx.closePath();
      ctx.clip();

      // Draw gradient triangles from centroid to each edge, colored by that edge's color
      for (var s = 0; s < numSegs; s++) {
        var seg = segments[s];
        var len = segmentLength(seg.from, seg.to);
        var color = colorScale(len, refLen);

        // Get adjacent segment colors for blending
        var prevIdx = (s - 1 + numSegs) % numSegs;
        var nextIdx = (s + 1) % numSegs;
        var prevLen = segmentLength(segments[prevIdx].from, segments[prevIdx].to);
        var nextLen = segmentLength(segments[nextIdx].from, segments[nextIdx].to);
        var prevColor = colorScale(prevLen, refLen);
        var nextColor = colorScale(nextLen, refLen);

        // Draw a triangle from centroid to this segment's two endpoints
        // Use a linear gradient from the segment midpoint toward centroid
        var midX = (seg.from.x + seg.to.x) / 2;
        var midY = (seg.from.y + seg.to.y) / 2;

        var grad = ctx.createLinearGradient(midX, midY, cx, cy);
        grad.addColorStop(0, 'hsla(' + color.h + ', ' + color.s + '%, ' + color.l + '%, 0.35)');
        grad.addColorStop(1, 'hsla(' + color.h + ', ' + color.s + '%, ' + color.l + '%, 0.08)');

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(seg.from.x, seg.from.y);
        ctx.lineTo(seg.to.x, seg.to.y);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /**
   * Draws an open shape: segments with color-scale colors,
   * vertex markers as filled circles, and highlight ring if >= 3 vertices.
   * @param {Shape} shape - An open shape
   * @param {number} refLen - The current reference length
   */
  _drawOpenShape(shape, refLen) {
    var ctx = this._ctx;
    var segments = shape.getSegments();

    // Draw segments
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var len = segmentLength(seg.from, seg.to);
      var color = colorScale(len, refLen);
      this._drawSegment(seg, color);
    }

    // Draw vertex markers (4px radius filled circles)
    for (var j = 0; j < shape.vertices.length; j++) {
      var v = shape.vertices[j];
      // Use the color of the segment ending at this vertex (or starting from it for first vertex)
      var markerColor;
      if (j === 0 && segments.length > 0) {
        // First vertex: use color of first segment
        var firstLen = segmentLength(segments[0].from, segments[0].to);
        markerColor = colorScale(firstLen, refLen);
      } else if (j > 0 && j - 1 < segments.length) {
        // Subsequent vertices: use color of the segment leading to this vertex
        var segToVertex = segments[j - 1];
        var segLen = segmentLength(segToVertex.from, segToVertex.to);
        markerColor = colorScale(segLen, refLen);
      } else {
        // Single vertex with no segments: use blue (hue 240)
        markerColor = { h: 240, s: 100, l: 50 };
      }

      ctx.beginPath();
      ctx.arc(v.x, v.y, VERTEX_MARKER_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = 'hsl(' + markerColor.h + ', ' + markerColor.s + '%, ' + markerColor.l + '%)';
      ctx.fill();
    }

    // Draw highlight ring around first vertex if >= 3 vertices
    if (shape.getVertexCount() >= 3) {
      var firstVertex = shape.vertices[0];
      ctx.beginPath();
      ctx.arc(firstVertex.x, firstVertex.y, ANCHOR_RADIUS, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /**
   * Draws a single segment as a 3px stroke with the given HSL color.
   * @param {{from: {x, y}, to: {x, y}}} seg - The segment to draw
   * @param {{h: number, s: number, l: number}} color - The HSL color
   */
  _drawSegment(seg, color) {
    var ctx = this._ctx;
    ctx.beginPath();
    ctx.moveTo(seg.from.x, seg.from.y);
    ctx.lineTo(seg.to.x, seg.to.y);
    ctx.strokeStyle = 'hsl(' + color.h + ', ' + color.s + '%, ' + color.l + '%)';
    ctx.lineWidth = SEGMENT_STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /**
   * Cleans up event listeners. Call when renderer is no longer needed.
   */
  destroy() {
    this._eventBus.off('change', this._onChangeBound);
    window.removeEventListener('resize', this._onResizeBound);
    if (this._resizeTimer !== null) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasRenderer, ANCHOR_RADIUS, VERTEX_MARKER_RADIUS, SEGMENT_STROKE_WIDTH, RESIZE_DEBOUNCE_MS, MAX_DPR };
}
