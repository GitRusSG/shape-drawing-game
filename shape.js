/**
 * Shape data model for the Shape Drawing Game.
 * Represents a polygonal shape as an ordered sequence of vertices.
 */

class Shape {
  /**
   * @param {Array<{x: number, y: number}>} vertices - Ordered array of vertex coordinates (integers)
   * @param {boolean} closed - Whether the shape is closed (last vertex connects back to first)
   */
  constructor(vertices = [], closed = false) {
    this.vertices = vertices;
    this.closed = closed;
  }

  /**
   * Returns the segments of this shape as {from, to} pairs.
   * Consecutive vertices form segments. If the shape is closed and has >= 3 vertices,
   * a closing segment from the last vertex to the first vertex is included.
   * @returns {Array<{from: {x: number, y: number}, to: {x: number, y: number}}>}
   */
  getSegments() {
    const segments = [];

    for (let i = 0; i < this.vertices.length - 1; i++) {
      segments.push({
        from: this.vertices[i],
        to: this.vertices[i + 1]
      });
    }

    // Include closing segment if shape is closed and has at least 3 vertices
    if (this.closed && this.vertices.length >= 3) {
      segments.push({
        from: this.vertices[this.vertices.length - 1],
        to: this.vertices[0]
      });
    }

    return segments;
  }

  /**
   * Returns the number of vertices in this shape.
   * @returns {number}
   */
  getVertexCount() {
    return this.vertices.length;
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Shape };
}
