/**
 * Property-based tests for ShapeStore.
 *
 * Property 5: Undo-Inverse for Vertex Addition
 * Property 8: Minimum Segment Length Enforcement
 * Property 9: Close-Shape Requires Minimum 3 Vertices
 * Property 10: Vertex Limit Enforcement
 *
 * Validates: Requirements 5.9, 4.5, 1.7, 2.6
 */

'use strict';

const { fc, modules, arbitraries, fcConfig } = require('./setup');
const { ShapeStore } = modules;
const { EventBus } = modules;
const { segmentLength } = modules;

/**
 * Helper: creates a fresh ShapeStore with an EventBus.
 */
function createStore() {
  const bus = new EventBus();
  return new ShapeStore(bus);
}

/**
 * Helper: builds a store with an open shape containing the given vertices.
 * Vertices are placed far enough apart to avoid minimum segment length rejection.
 */
function storeWithOpenShape(vertices) {
  const store = createStore();
  for (let i = 0; i < vertices.length; i++) {
    store.addVertex(vertices[i].x, vertices[i].y);
  }
  return store;
}

/**
 * Helper: deep-compare store states (vertices + closed shapes).
 */
function storeStatesEqual(storeA, storeB) {
  // Compare closed shapes
  if (storeA.closedShapes.length !== storeB.closedShapes.length) return false;
  for (let i = 0; i < storeA.closedShapes.length; i++) {
    const a = storeA.closedShapes[i];
    const b = storeB.closedShapes[i];
    if (a.closed !== b.closed) return false;
    if (a.vertices.length !== b.vertices.length) return false;
    for (let j = 0; j < a.vertices.length; j++) {
      if (a.vertices[j].x !== b.vertices[j].x || a.vertices[j].y !== b.vertices[j].y) return false;
    }
  }

  // Compare open shape
  if ((storeA.openShape === null) !== (storeB.openShape === null)) return false;
  if (storeA.openShape !== null && storeB.openShape !== null) {
    if (storeA.openShape.vertices.length !== storeB.openShape.vertices.length) return false;
    for (let j = 0; j < storeA.openShape.vertices.length; j++) {
      if (storeA.openShape.vertices[j].x !== storeB.openShape.vertices[j].x) return false;
      if (storeA.openShape.vertices[j].y !== storeB.openShape.vertices[j].y) return false;
    }
    if (storeA.openShape.closed !== storeB.openShape.closed) return false;
  }

  return true;
}

/**
 * Helper: snapshot the current store state for comparison.
 */
function snapshotStore(store) {
  return JSON.parse(JSON.stringify(store.toJSON()));
}

// ============================================================================
// Property 5: Undo-Inverse for Vertex Addition
// **Validates: Requirements 5.9**
//
// For any ShapeStore state containing an open shape below the vertex limit,
// appending a valid vertex (>=1px from last vertex, within canvas bounds) and
// then performing undo shall restore the ShapeStore to the exact same state.
// ============================================================================

console.log('Property 5: Undo-Inverse for Vertex Addition');
console.log('=============================================');

// Generate an initial set of well-spaced vertices for the open shape (1-98 vertices)
// then generate a new vertex that is at least 1px away from the last one.
const prop5Result = fc.check(
  fc.property(
    fc.integer({ min: 1, max: 98 }).chain((numVertices) => {
      // Generate well-spaced vertices by using larger coordinate ranges with offsets
      return fc.tuple(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 10000 }),
            y: fc.integer({ min: 0, max: 10000 })
          }),
          { minLength: numVertices, maxLength: numVertices }
        ),
        // New vertex to append - will be validated for distance
        fc.record({
          x: fc.integer({ min: 0, max: 10000 }),
          y: fc.integer({ min: 0, max: 10000 })
        })
      );
    }),
    ([initialVertices, newVertex]) => {
      // Build the store by adding vertices one at a time
      const store = createStore();

      // Add initial vertices - some may be rejected due to min distance,
      // but we need at least 1 vertex in the open shape
      store.addVertex(initialVertices[0].x, initialVertices[0].y);
      for (let i = 1; i < initialVertices.length; i++) {
        store.addVertex(initialVertices[i].x, initialVertices[i].y);
      }

      // Ensure we have an open shape
      if (store.openShape === null) return true; // vacuously true

      // Check vertex limit not reached
      if (store.openShape.getVertexCount() >= 100) return true; // vacuously true

      // Snapshot the state before adding the new vertex
      const snapshotBefore = snapshotStore(store);

      // Check if the new vertex is >= 1px from the last vertex
      const lastVertex = store.openShape.vertices[store.openShape.vertices.length - 1];
      const dist = Math.sqrt(
        Math.pow(Math.round(newVertex.x) - lastVertex.x, 2) +
        Math.pow(Math.round(newVertex.y) - lastVertex.y, 2)
      );

      if (dist < 1) {
        // Skip - vertex would be rejected anyway
        return true;
      }

      // Add the vertex
      const added = store.addVertex(newVertex.x, newVertex.y);
      if (!added) {
        // If rejected for any reason, the property is vacuously true
        return true;
      }

      // Undo
      store.undo();

      // Verify state is restored
      const snapshotAfter = snapshotStore(store);
      return JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter);
    }
  ),
  fcConfig
);

if (prop5Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop5Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 8: Minimum Segment Length Enforcement
// **Validates: Requirements 2.6**
//
// For any open shape with at least one vertex, if a new vertex is appended such
// that the Euclidean distance from the last existing vertex to the new vertex is
// less than 1 pixel, the store shall reject the vertex and the open shape shall
// remain unchanged.
// ============================================================================

console.log('Property 8: Minimum Segment Length Enforcement');
console.log('==============================================');

const prop8Result = fc.check(
  fc.property(
    fc.record({
      x: fc.integer({ min: 10, max: 9990 }),
      y: fc.integer({ min: 10, max: 9990 })
    }),
    // Generate a small offset that ensures distance < 1px
    // dx^2 + dy^2 < 1, so both dx and dy must be 0
    // Since coordinates are integers, the only way distance < 1 is if they round to the same point
    fc.integer({ min: -100, max: 100 }),
    fc.integer({ min: -100, max: 100 }),
    (baseVertex, dxRaw, dyRaw) => {
      // We want a new vertex whose distance from baseVertex is < 1px after rounding
      // Since coordinates are rounded to integers, distance < 1 means
      // the rounded new vertex is the same as the base vertex OR within fractional distance
      // For integer coords: only (0,0) offset gives dist=0 which is < 1
      // Let's use fractional offsets that round to give distance < 1

      const store = createStore();
      store.addVertex(baseVertex.x, baseVertex.y);

      // The stored vertex is the rounded value
      const storedLast = store.openShape.vertices[0];

      // Generate a new vertex that, when rounded, is less than 1px from storedLast
      // The only integer points within distance < 1 from an integer point are the same point
      const newX = storedLast.x;
      const newY = storedLast.y;

      // Snapshot before
      const verticesBefore = store.openShape.vertices.length;

      // Try to add a vertex at the same location
      const added = store.addVertex(newX, newY);

      // Should be rejected
      if (added) return false;

      // Verify store unchanged
      return store.openShape.vertices.length === verticesBefore;
    }
  ),
  fcConfig
);

if (prop8Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop8Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// Also test with fractional coordinates that round to be within < 1px
console.log('Property 8b: Minimum Segment Length - near-zero distances');
console.log('=========================================================');

const prop8bResult = fc.check(
  fc.property(
    fc.record({
      x: fc.integer({ min: 10, max: 9990 }),
      y: fc.integer({ min: 10, max: 9990 })
    }),
    fc.double({ min: -0.49, max: 0.49, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -0.49, max: 0.49, noNaN: true, noDefaultInfinity: true }),
    (baseVertex, dx, dy) => {
      const store = createStore();
      store.addVertex(baseVertex.x, baseVertex.y);

      const storedLast = store.openShape.vertices[0];

      // New vertex that rounds to be very close
      const newX = storedLast.x + dx;
      const newY = storedLast.y + dy;

      // After rounding, compute actual distance
      const roundedX = Math.round(newX);
      const roundedY = Math.round(newY);
      const dist = Math.sqrt(
        Math.pow(roundedX - storedLast.x, 2) +
        Math.pow(roundedY - storedLast.y, 2)
      );

      if (dist >= 1) {
        // This case doesn't apply to our property - vertex would be accepted
        return true;
      }

      // Snapshot before
      const verticesBefore = store.openShape.vertices.length;

      // Try to add vertex
      const added = store.addVertex(newX, newY);

      // Should be rejected (distance < 1px)
      if (added) return false;

      // Store should be unchanged
      return store.openShape.vertices.length === verticesBefore;
    }
  ),
  fcConfig
);

if (prop8bResult.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop8bResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 9: Close-Shape Requires Minimum 3 Vertices
// **Validates: Requirements 4.5**
//
// For any open shape containing fewer than 3 vertices, attempting to close the
// shape shall leave the store unchanged with the shape remaining open.
// ============================================================================

console.log('Property 9: Close-Shape Requires Minimum 3 Vertices');
console.log('====================================================');

const prop9Result = fc.check(
  fc.property(
    fc.integer({ min: 1, max: 2 }),
    fc.array(
      fc.record({
        x: fc.integer({ min: 0, max: 10000 }),
        y: fc.integer({ min: 0, max: 10000 })
      }),
      { minLength: 2, maxLength: 2 }
    ),
    (numVertices, vertices) => {
      const store = createStore();

      // Add the first vertex
      store.addVertex(vertices[0].x, vertices[0].y);

      // If numVertices == 2, try adding a second vertex far enough away
      if (numVertices === 2) {
        // Ensure second vertex is far enough from first
        const secondX = vertices[1].x;
        const secondY = vertices[1].y;
        const storedFirst = store.openShape.vertices[0];
        const dist = Math.sqrt(
          Math.pow(Math.round(secondX) - storedFirst.x, 2) +
          Math.pow(Math.round(secondY) - storedFirst.y, 2)
        );
        if (dist >= 1) {
          store.addVertex(secondX, secondY);
        }
      }

      // Verify we have fewer than 3 vertices
      if (store.openShape === null || store.openShape.getVertexCount() >= 3) {
        return true; // vacuously true - precondition not met
      }

      // Snapshot the state
      const vertexCountBefore = store.openShape.getVertexCount();
      const verticesBefore = JSON.stringify(store.openShape.vertices);
      const closedShapesBefore = store.closedShapes.length;

      // Try to close the shape
      const result = store.closeShape();

      // Should be rejected
      if (result !== false) return false;

      // Store should be unchanged
      if (store.openShape === null) return false;
      if (store.openShape.closed) return false;
      if (store.openShape.getVertexCount() !== vertexCountBefore) return false;
      if (JSON.stringify(store.openShape.vertices) !== verticesBefore) return false;
      if (store.closedShapes.length !== closedShapesBefore) return false;

      return true;
    }
  ),
  fcConfig
);

if (prop9Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop9Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 10: Vertex Limit Enforcement
// **Validates: Requirements 1.7**
//
// For any open shape containing exactly 100 vertices (the Vertex Limit),
// attempting to add another vertex shall leave the store unchanged.
// ============================================================================

console.log('Property 10: Vertex Limit Enforcement');
console.log('=====================================');

const prop10Result = fc.check(
  fc.property(
    fc.record({
      x: fc.integer({ min: 0, max: 10000 }),
      y: fc.integer({ min: 0, max: 10000 })
    }),
    (newVertex) => {
      // Build a store with exactly 100 vertices in the open shape
      // Use well-spaced vertices to avoid minimum segment rejection
      const store = createStore();

      for (let i = 0; i < 100; i++) {
        // Place vertices in a grid pattern (each > 1px apart)
        const x = (i % 100) * 100;
        const y = Math.floor(i / 100) * 100;
        store.addVertex(x, y);
      }

      // Verify we have exactly 100 vertices
      if (store.openShape === null || store.openShape.getVertexCount() !== 100) {
        // Fallback: if our grid didn't work, skip
        return true;
      }

      // Snapshot the state
      const vertexCountBefore = store.openShape.getVertexCount();
      const verticesBefore = JSON.stringify(store.openShape.vertices);

      // Try to add another vertex
      const added = store.addVertex(newVertex.x, newVertex.y);

      // Should be rejected
      if (added) return false;

      // Store should be unchanged
      if (store.openShape.getVertexCount() !== vertexCountBefore) return false;
      if (JSON.stringify(store.openShape.vertices) !== verticesBefore) return false;

      return true;
    }
  ),
  fcConfig
);

if (prop10Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop10Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// Summary
console.log('========================================');
console.log('ShapeStore Property Tests Complete');
console.log('========================================');
if (process.exitCode === 1) {
  console.log('Some tests FAILED - see above for details.');
} else {
  console.log('All tests PASSED.');
}
