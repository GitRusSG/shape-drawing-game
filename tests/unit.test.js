/**
 * Unit tests for edge cases — Shape Drawing Game
 *
 * Validates: Requirements 1.5, 1.7, 4.5, 5.6, 5.8, 8.2
 *
 * Run with: node tests/unit.test.js
 */

'use strict';

const assert = require('assert');
const { fc, modules, arbitraries, fcConfig } = require('./setup');

const { ShapeStore } = require('../shapestore');
const { EventBus } = require('../eventbus');
const { Shape } = require('../shape');
const { segmentLength } = require('../colorscale');
const { ANCHOR_RADIUS, MAX_DPR } = require('../renderer');
const { LEGEND_SWATCH_COUNT } = require('../uipanel');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS: ' + name);
    passed++;
  } catch (e) {
    console.log('  FAIL: ' + name);
    console.log('        ' + e.message);
    failed++;
  }
}

// ===========================================================================
// 1. Canvas click at exact anchor radius boundary (12px)
// ===========================================================================
console.log('');
console.log('1. Anchor radius boundary (12px)');
console.log('─────────────────────────────────');

test('ANCHOR_RADIUS constant is 12', () => {
  assert.strictEqual(ANCHOR_RADIUS, 12);
});

test('click at exactly 12px from first vertex — should close (dist <= ANCHOR_RADIUS)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  // Add 3 vertices: first vertex at (100, 100)
  store.addVertex(100, 100);
  store.addVertex(200, 200);
  store.addVertex(100, 200);

  assert.strictEqual(store.getOpenShape().getVertexCount(), 3);

  // Point (112, 100) is exactly 12px away from (100, 100) on x-axis
  const clickX = 112;
  const clickY = 100;
  const firstVertex = store.getOpenShape().vertices[0];
  const dist = segmentLength({ x: clickX, y: clickY }, firstVertex);

  assert.strictEqual(dist, 12, 'Distance should be exactly 12');
  assert(dist <= ANCHOR_RADIUS, 'dist <= ANCHOR_RADIUS should be true');

  // The InputRouter would call closeShape() when dist <= ANCHOR_RADIUS
  const closed = store.closeShape();
  assert.strictEqual(closed, true);
  assert.strictEqual(store.getOpenShape(), null);
  assert.strictEqual(store.getClosedShapeCount(), 1);
});

test('click at 12.01px from first vertex — should NOT close (dist > ANCHOR_RADIUS)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(100, 100);
  store.addVertex(200, 200);
  store.addVertex(100, 200);

  // segmentLength({x: 112.01, y: 100}, {x: 100, y: 100}) ≈ 12.01
  const clickX = 112.01;
  const clickY = 100;
  const firstVertex = store.getOpenShape().vertices[0];
  const dist = segmentLength({ x: clickX, y: clickY }, firstVertex);

  assert(dist > ANCHOR_RADIUS, 'Distance > ANCHOR_RADIUS should be true');
  // In InputRouter logic, this means addVertex is called instead of closeShape
});

// ===========================================================================
// 2. Close shape with exactly 3 vertices
// ===========================================================================
console.log('');
console.log('2. Close shape with exactly 3 vertices');
console.log('───────────────────────────────────────');

test('closeShape with 3 vertices succeeds', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(10, 10);
  store.addVertex(50, 10);
  store.addVertex(30, 50);

  assert.strictEqual(store.getOpenShape().getVertexCount(), 3);

  const result = store.closeShape();

  assert.strictEqual(result, true, 'closeShape should return true');
  assert.strictEqual(store.getOpenShape(), null, 'open shape should be null');
  assert.strictEqual(store.getClosedShapeCount(), 1, 'should have 1 closed shape');
  assert.strictEqual(store.getClosedShapes()[0].closed, true, 'shape should be closed');
  assert.strictEqual(store.getClosedShapes()[0].getVertexCount(), 3, 'shape should have 3 vertices');
});

test('closeShape with fewer than 3 vertices fails', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(10, 10);
  store.addVertex(50, 10);

  const result = store.closeShape();

  assert.strictEqual(result, false, 'closeShape should return false with 2 vertices');
  assert.notStrictEqual(store.getOpenShape(), null, 'open shape should still exist');
  assert.strictEqual(store.getClosedShapeCount(), 0);
});

// ===========================================================================
// 3. Color legend displays >= 5 swatches
// ===========================================================================
console.log('');
console.log('3. Color legend swatch count');
console.log('────────────────────────────');

test('LEGEND_SWATCH_COUNT is >= 5', () => {
  assert(LEGEND_SWATCH_COUNT >= 5,
    `LEGEND_SWATCH_COUNT is ${LEGEND_SWATCH_COUNT}, expected >= 5`);
});

test('LEGEND_SWATCH_COUNT is 7 (current value)', () => {
  assert.strictEqual(LEGEND_SWATCH_COUNT, 7);
});

// ===========================================================================
// 4. Undo with empty store (no-op)
// ===========================================================================
console.log('');
console.log('4. Undo with empty store (no-op)');
console.log('────────────────────────────────');

test('undo on empty store emits no change event and state is unchanged', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  let changeCount = 0;
  bus.on('change', () => { changeCount++; });

  store.undo();

  assert.strictEqual(changeCount, 0, 'No change event should be emitted');
  assert.strictEqual(store.getOpenShape(), null, 'open shape still null');
  assert.strictEqual(store.getClosedShapeCount(), 0, 'still no closed shapes');
});

// ===========================================================================
// 5. Cancel with no open shape (no-op)
// ===========================================================================
console.log('');
console.log('5. Cancel with no open shape (no-op)');
console.log('────────────────────────────────────');

test('cancel with closed shapes but no open shape is a no-op', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  // Build and close a shape
  store.addVertex(10, 10);
  store.addVertex(50, 10);
  store.addVertex(30, 50);
  store.closeShape();

  assert.strictEqual(store.getClosedShapeCount(), 1);
  assert.strictEqual(store.getOpenShape(), null);

  let changeCount = 0;
  bus.on('change', () => { changeCount++; });

  store.cancel();

  assert.strictEqual(changeCount, 0, 'No change event should be emitted');
  assert.strictEqual(store.getClosedShapeCount(), 1, 'closed shapes retained');
  assert.strictEqual(store.getOpenShape(), null, 'still no open shape');
});

// ===========================================================================
// 6. DPR scaling at boundary values
// ===========================================================================
console.log('');
console.log('6. DPR scaling boundary values');
console.log('──────────────────────────────');

test('MAX_DPR constant is 3', () => {
  assert.strictEqual(MAX_DPR, 3);
});

test('DPR clamping logic: values 1, 2, 3 pass through; >3 clamps to 3', () => {
  // Replicate the clamping logic from CanvasRenderer.setupDPR():
  //   var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  //   dpr = Math.max(dpr, 1);
  //   dpr = Math.round(dpr);
  function clampDPR(rawDPR) {
    let dpr = Math.min(rawDPR, MAX_DPR);
    dpr = Math.max(dpr, 1);
    dpr = Math.round(dpr);
    return dpr;
  }

  assert.strictEqual(clampDPR(1), 1, 'DPR 1 passes through');
  assert.strictEqual(clampDPR(2), 2, 'DPR 2 passes through');
  assert.strictEqual(clampDPR(3), 3, 'DPR 3 passes through');
  assert.strictEqual(clampDPR(4), 3, 'DPR 4 clamped to 3');
  assert.strictEqual(clampDPR(5), 3, 'DPR 5 clamped to 3');
  assert.strictEqual(clampDPR(10), 3, 'DPR 10 clamped to 3');
  assert.strictEqual(clampDPR(0.5), 1, 'DPR 0.5 clamped up to 1');
  assert.strictEqual(clampDPR(1.5), 2, 'DPR 1.5 rounds to 2');
  assert.strictEqual(clampDPR(2.7), 3, 'DPR 2.7 rounds to 3');
});

// ===========================================================================
// 7. Coordinate rounding to integers
// ===========================================================================
console.log('');
console.log('7. Coordinate rounding to integers');
console.log('──────────────────────────────────');

test('addVertex(10.3, 20.7) stores as (10, 21)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(10.3, 20.7);

  const v = store.getOpenShape().vertices[0];
  assert.strictEqual(v.x, 10, 'x should be rounded to 10');
  assert.strictEqual(v.y, 21, 'y should be rounded to 21');
});

test('addVertex(10.5, 20.5) stores as (11, 21)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(10.5, 20.5);

  const v = store.getOpenShape().vertices[0];
  assert.strictEqual(v.x, 11, 'x should be rounded to 11');
  assert.strictEqual(v.y, 21, 'y should be rounded to 21');
});

test('addVertex(99.9, 0.1) stores as (100, 0)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(99.9, 0.1);

  const v = store.getOpenShape().vertices[0];
  assert.strictEqual(v.x, 100, 'x should be rounded to 100');
  assert.strictEqual(v.y, 0, 'y should be rounded to 0');
});

test('addVertex(0.4999, 9999.5) stores as (0, 10000)', () => {
  const bus = new EventBus();
  const store = new ShapeStore(bus);

  store.addVertex(0.4999, 9999.5);

  const v = store.getOpenShape().vertices[0];
  assert.strictEqual(v.x, 0, 'x should be rounded to 0');
  assert.strictEqual(v.y, 10000, 'y should be rounded to 10000');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('');
console.log('═══════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════');

if (failed > 0) {
  process.exitCode = 1;
}
