/**
 * Test runner setup for the Shape Drawing Game.
 * Imports pure modules, configures fast-check, and defines custom arbitraries.
 *
 * Usage: require this file from any test file to get access to modules and arbitraries.
 *   const { fc, modules, arbitraries, fcConfig } = require('./setup');
 */

'use strict';

const fc = require('fast-check');

// Import pure modules
const { segmentLength, colorScale, perimeter, meanSegmentLength } = require('../colorscale');
const { Shape } = require('../shape');
const { EventBus } = require('../eventbus');

// ShapeStore and persistence will be loaded when they exist
let ShapeStore = null;
let persistence = null;

try {
  ShapeStore = require('../shapestore').ShapeStore;
} catch (e) {
  // shapestore.js not yet created
}

try {
  persistence = require('../persistence');
} catch (e) {
  // persistence.js not yet created
}

// --- fast-check configuration ---
const fcConfig = { numRuns: 100 };

// --- Custom Arbitraries ---

/**
 * Arbitrary for a valid vertex: {x: integer in [0, 10000], y: integer in [0, 10000]}
 */
const validVertex = fc.record({
  x: fc.integer({ min: 0, max: 10000 }),
  y: fc.integer({ min: 0, max: 10000 })
});

/**
 * Arbitrary for an array of valid vertices with configurable length bounds.
 * @param {number} min - Minimum number of vertices (inclusive)
 * @param {number} max - Maximum number of vertices (inclusive)
 * @returns {fc.Arbitrary<Array<{x: number, y: number}>>}
 */
function validVertices(min, max) {
  return fc.array(validVertex, { minLength: min, maxLength: max });
}

/**
 * Arbitrary for a valid closed shape: Shape with closed=true, 3-100 vertices, all valid.
 */
const validClosedShape = validVertices(3, 100).map(
  (vertices) => new Shape(vertices, true)
);

/**
 * Arbitrary for a valid open shape: Shape with closed=false, 1-100 vertices, all valid.
 */
const validOpenShape = validVertices(1, 100).map(
  (vertices) => new Shape(vertices, false)
);

/**
 * Arbitrary for a valid store state: 0-100 closed shapes + optional 1 open shape.
 * Returns a plain object matching the store's internal structure:
 *   { closedShapes: Shape[], openShape: Shape | null }
 */
const validStoreState = fc.record({
  closedShapes: fc.array(validClosedShape, { minLength: 0, maxLength: 100 }),
  openShape: fc.option(validOpenShape, { nil: null })
});

// --- Exported Arbitraries ---
const arbitraries = {
  validVertex,
  validVertices,
  validClosedShape,
  validOpenShape,
  validStoreState
};

// --- Exported Modules ---
const modules = {
  segmentLength,
  colorScale,
  perimeter,
  meanSegmentLength,
  Shape,
  EventBus,
  get ShapeStore() {
    if (!ShapeStore) {
      try { ShapeStore = require('../shapestore').ShapeStore; } catch (e) {}
    }
    return ShapeStore;
  },
  get persistence() {
    if (!persistence) {
      try { persistence = require('../persistence'); } catch (e) {}
    }
    return persistence;
  }
};

// --- Self-test: verify setup works ---
if (require.main === module) {
  console.log('Shape Drawing Game - Test Setup');
  console.log('================================');
  console.log('fast-check version:', fc.__version || 'loaded');
  console.log('Modules loaded:');
  console.log('  - colorscale.js: segmentLength, colorScale, perimeter, meanSegmentLength');
  console.log('  - shape.js: Shape');
  console.log('  - eventbus.js: EventBus');
  console.log('  - shapestore.js:', ShapeStore ? 'ShapeStore' : '(not yet created)');
  console.log('  - persistence.js:', persistence ? 'serialize, parse' : '(not yet created)');
  console.log('');
  console.log('fast-check config: numRuns =', fcConfig.numRuns);
  console.log('');
  console.log('Custom arbitraries:');
  console.log('  - validVertex');
  console.log('  - validVertices(min, max)');
  console.log('  - validClosedShape');
  console.log('  - validOpenShape');
  console.log('  - validStoreState');
  console.log('');

  // Quick sanity check: generate a sample vertex and shape
  const sampleVertex = fc.sample(validVertex, 1)[0];
  console.log('Sample vertex:', sampleVertex);

  const sampleShape = fc.sample(validClosedShape, 1)[0];
  console.log('Sample closed shape: vertices=%d, closed=%s', sampleShape.getVertexCount(), sampleShape.closed);

  console.log('');
  console.log('Setup OK - ready to run tests.');
}

module.exports = { fc, modules, arbitraries, fcConfig };
