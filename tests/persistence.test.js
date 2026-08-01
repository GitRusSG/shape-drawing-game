/**
 * Property-based tests for Serializer/Parser (persistence.js).
 *
 * Property 4: Serialization Round-Trip
 * Property 7: Parser Rejects Invalid Input
 *
 * **Validates: Requirements 7.2, 7.3, 7.4, 7.8**
 */

'use strict';

const { fc, modules, arbitraries, fcConfig } = require('./setup');
const { ShapeStore, EventBus, persistence } = modules;
const { serialize, parse } = persistence;

/**
 * Helper: creates a fresh ShapeStore with an EventBus.
 */
function createStore() {
  const bus = new EventBus();
  return new ShapeStore(bus);
}

// ============================================================================
// Property 4: Serialization Round-Trip
// **Validates: Requirements 7.2, 7.3**
//
// For any valid ShapeStore state (containing 0–100 closed shapes each with
// 3–100 vertices, and optionally one open shape with 1–100 vertices, all
// coordinates integers in [0, 10000]), serializing then parsing shall produce
// the same number of shapes in the same order with identical closed states and
// identical vertex coordinates, and serializing that result shall produce
// character-identical JSON to the first serialization.
// ============================================================================

console.log('Property 4: Serialization Round-Trip');
console.log('====================================');

const prop4Result = fc.check(
  fc.property(
    arbitraries.validStoreState,
    (storeState) => {
      // 1. Create a ShapeStore and populate with generated state
      const store1 = createStore();
      const data1 = { shapes: [] };

      // Add closed shapes
      for (let i = 0; i < storeState.closedShapes.length; i++) {
        const shape = storeState.closedShapes[i];
        const verts = shape.vertices.map(v => [v.x, v.y]);
        data1.shapes.push({ vertices: verts, closed: true });
      }

      // Add open shape if present
      if (storeState.openShape !== null) {
        const openVerts = storeState.openShape.vertices.map(v => [v.x, v.y]);
        data1.shapes.push({ vertices: openVerts, closed: false });
      }

      store1.fromJSON(data1);

      // 2. Serialize the store
      const json1 = serialize(store1);

      // 3. Parse the serialized JSON
      const parseResult = parse(json1);
      if (!parseResult.ok) {
        // A valid store state should always serialize to valid JSON
        return false;
      }

      // 4. Restore data into a new store
      const store2 = createStore();
      store2.fromJSON(parseResult.data);

      // 5. Serialize the new store
      const json2 = serialize(store2);

      // 6. Assert json1 === json2 (character-identical)
      return json1 === json2;
    }
  ),
  fcConfig
);

if (prop4Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop4Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 7: Parser Rejects Invalid Input
// **Validates: Requirements 7.4, 7.8**
//
// For any JSON string that violates at least one parser constraint (text > 1MB,
// > 100 shapes, > 1 open shape, vertex count outside [1, 100] per shape, closed
// shape with < 3 vertices, coordinates outside [0, 10000] or non-finite), the
// parser shall return an error and shall not produce valid store contents.
// ============================================================================

console.log('Property 7: Parser Rejects Invalid Input');
console.log('========================================');

// --- 7a: Text > 1MB ---
console.log('  7a: Text exceeding 1MB...');

const prop7aResult = fc.check(
  fc.property(
    fc.integer({ min: 1048577, max: 1048700 }),
    (length) => {
      // Generate a string that exceeds 1MB
      const json = 'x'.repeat(length);
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7aResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7aResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7b: > 100 shapes ---
console.log('  7b: More than 100 shapes...');

const prop7bResult = fc.check(
  fc.property(
    fc.integer({ min: 101, max: 120 }),
    (numShapes) => {
      const shapes = [];
      for (let i = 0; i < numShapes; i++) {
        shapes.push({ vertices: [[0, 0], [100, 0], [100, 100]], closed: true });
      }
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7bResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7bResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7c: > 1 open shape ---
console.log('  7c: More than 1 open shape...');

const prop7cResult = fc.check(
  fc.property(
    fc.integer({ min: 2, max: 10 }),
    (numOpenShapes) => {
      const shapes = [];
      for (let i = 0; i < numOpenShapes; i++) {
        shapes.push({ vertices: [[i * 10, i * 10]], closed: false });
      }
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7cResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7cResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7d: Shape with 0 vertices ---
console.log('  7d: Shape with 0 vertices...');

const prop7dResult = fc.check(
  fc.property(
    fc.boolean(),
    (isClosed) => {
      const shapes = [{ vertices: [], closed: isClosed }];
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7dResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7dResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7e: Shape with > 100 vertices ---
console.log('  7e: Shape with > 100 vertices...');

const prop7eResult = fc.check(
  fc.property(
    fc.integer({ min: 101, max: 150 }),
    (numVertices) => {
      const vertices = [];
      for (let i = 0; i < numVertices; i++) {
        vertices.push([i % 10000, Math.floor(i / 10000)]);
      }
      const shapes = [{ vertices, closed: false }];
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7eResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7eResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7f: Closed shape with < 3 vertices ---
console.log('  7f: Closed shape with fewer than 3 vertices...');

const prop7fResult = fc.check(
  fc.property(
    fc.integer({ min: 1, max: 2 }),
    (numVertices) => {
      const vertices = [];
      for (let i = 0; i < numVertices; i++) {
        vertices.push([i * 100, i * 100]);
      }
      const shapes = [{ vertices, closed: true }];
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7fResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7fResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7g: Coordinates outside [0, 10000] ---
console.log('  7g: Coordinates outside [0, 10000]...');

const prop7gResult = fc.check(
  fc.property(
    fc.oneof(
      // Negative x
      fc.record({
        x: fc.integer({ min: -10000, max: -1 }),
        y: fc.integer({ min: 0, max: 10000 })
      }),
      // x > 10000
      fc.record({
        x: fc.integer({ min: 10001, max: 20000 }),
        y: fc.integer({ min: 0, max: 10000 })
      }),
      // Negative y
      fc.record({
        x: fc.integer({ min: 0, max: 10000 }),
        y: fc.integer({ min: -10000, max: -1 })
      }),
      // y > 10000
      fc.record({
        x: fc.integer({ min: 0, max: 10000 }),
        y: fc.integer({ min: 10001, max: 20000 })
      })
    ),
    (badCoord) => {
      const shapes = [{
        vertices: [[0, 0], [100, 0], [badCoord.x, badCoord.y]],
        closed: true
      }];
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7gResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7gResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7h: Non-finite coordinates (Infinity, NaN) ---
console.log('  7h: Non-finite coordinates...');

const prop7hResult = fc.check(
  fc.property(
    fc.oneof(
      fc.constant(Infinity),
      fc.constant(-Infinity),
      fc.constant(NaN)
    ),
    fc.boolean(), // whether to put the non-finite value in x or y
    (badValue, inX) => {
      const vertex = inX ? [badValue, 50] : [50, badValue];
      const shapes = [{
        vertices: [[0, 0], [100, 0], vertex],
        closed: true
      }];
      const json = JSON.stringify({ shapes });
      const result = parse(json);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7hResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7hResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

// --- 7i: Non-JSON text ---
console.log('  7i: Non-JSON text...');

const prop7iResult = fc.check(
  fc.property(
    fc.oneof(
      fc.string({ minLength: 1, maxLength: 200 }).filter(s => {
        // Filter to strings that are NOT valid JSON
        try { JSON.parse(s); return false; } catch (e) { return true; }
      }),
      fc.constant('{not valid json at all!!!'),
      fc.constant('undefined'),
      fc.constant('<html>'),
      fc.constant('function(){}')
    ),
    (invalidText) => {
      const result = parse(invalidText);
      return result.ok === false;
    }
  ),
  fcConfig
);

if (prop7iResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop7iResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED');
}

console.log('');

// Summary
console.log('========================================');
console.log('Persistence Property Tests Complete');
console.log('========================================');
if (process.exitCode === 1) {
  console.log('Some tests FAILED - see above for details.');
} else {
  console.log('All tests PASSED.');
}
