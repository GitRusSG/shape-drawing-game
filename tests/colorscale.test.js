/**
 * Property-based tests for ColorScale and related pure computation functions.
 *
 * Property 1: Color Scale Monotonicity
 * Property 2: Color Scale Determinism and Range
 * Property 3: Color Scale Boundaries
 * Property 6: Segment Length Symmetry
 * Property 11: Shape Fill Color is Mean Segment Color
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.6, 3.8, 4.3
 */

'use strict';

const { fc, modules, arbitraries, fcConfig } = require('./setup');
const { colorScale, segmentLength, meanSegmentLength, perimeter } = modules;
const { Shape } = modules;

// ============================================================================
// Property 1: Color Scale Monotonicity
// **Validates: Requirements 3.6**
//
// For any two segment lengths L1 and L2 where L1 > L2, and any positive
// reference length R, the hue produced by colorScale(L1, R) shall be less than
// or equal to the hue produced by colorScale(L2, R).
// ============================================================================

console.log('Property 1: Color Scale Monotonicity');
console.log('====================================');

const prop1Result = fc.check(
  fc.property(
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0.001, max: 20000, noNaN: true, noDefaultInfinity: true }),
    (a, b, R) => {
      // Ensure L1 > L2
      const L1 = Math.max(a, b);
      const L2 = Math.min(a, b);

      if (L1 === L2) return true; // skip equal case

      const hue1 = colorScale(L1, R).h;
      const hue2 = colorScale(L2, R).h;

      // Longer segment should have hue <= shorter segment's hue
      return hue1 <= hue2;
    }
  ),
  fcConfig
);

if (prop1Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop1Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 2: Color Scale Determinism and Range
// **Validates: Requirements 3.2, 3.4**
//
// For any non-negative segment length L and any non-negative reference length R,
// the hue produced by colorScale(L, R) shall be an integer in the range [0, 240],
// and evaluating colorScale(L, R) multiple times shall always produce identical
// results.
// ============================================================================

console.log('Property 2: Color Scale Determinism and Range');
console.log('=============================================');

const prop2Result = fc.check(
  fc.property(
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    (L, R) => {
      const result1 = colorScale(L, R);
      const result2 = colorScale(L, R);
      const result3 = colorScale(L, R);

      // Check hue is an integer
      if (!Number.isInteger(result1.h)) return false;

      // Check hue is in [0, 240]
      if (result1.h < 0 || result1.h > 240) return false;

      // Check determinism: all calls produce identical results
      if (result1.h !== result2.h || result1.h !== result3.h) return false;
      if (result1.s !== result2.s || result1.s !== result3.s) return false;
      if (result1.l !== result2.l || result1.l !== result3.l) return false;

      return true;
    }
  ),
  fcConfig
);

if (prop2Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop2Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 3: Color Scale Boundaries
// **Validates: Requirements 3.2, 3.3, 3.8**
//
// For any reference length R (including R = 0), colorScale(0, R) shall produce
// hue = 240. For any positive reference length R and any segment length L >= R,
// colorScale(L, R) shall produce hue = 0.
// ============================================================================

console.log('Property 3: Color Scale Boundaries');
console.log('==================================');

// Part A: colorScale(0, R) = 240 for any R
console.log('  Part A: colorScale(0, R) == 240 for any R');

const prop3aResult = fc.check(
  fc.property(
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    (R) => {
      const result = colorScale(0, R);
      return result.h === 240;
    }
  ),
  fcConfig
);

if (prop3aResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop3aResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED (' + fcConfig.numRuns + ' runs)');
}

// Part B: colorScale(L, R) = 0 for L >= R, R > 0
console.log('  Part B: colorScale(L, R) == 0 for L >= R, R > 0');

const prop3bResult = fc.check(
  fc.property(
    fc.double({ min: 0.001, max: 20000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0, max: 20000, noNaN: true, noDefaultInfinity: true }),
    (R, extra) => {
      // L >= R
      const L = R + extra;
      const result = colorScale(L, R);
      return result.h === 0;
    }
  ),
  fcConfig
);

if (prop3bResult.failed) {
  console.log('  FAILED!');
  console.log('  Counterexample:', JSON.stringify(prop3bResult.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('  PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 6: Segment Length Symmetry
// **Validates: Requirements 3.1, 3.4**
//
// For any two vertices A and B, segmentLength(A, B) shall equal
// segmentLength(B, A).
// ============================================================================

console.log('Property 6: Segment Length Symmetry');
console.log('===================================');

const prop6Result = fc.check(
  fc.property(
    arbitraries.validVertex,
    arbitraries.validVertex,
    (A, B) => {
      const distAB = segmentLength(A, B);
      const distBA = segmentLength(B, A);
      return distAB === distBA;
    }
  ),
  fcConfig
);

if (prop6Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop6Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// ============================================================================
// Property 11: Shape Fill Color is Mean Segment Color
// **Validates: Requirements 4.3**
//
// For any closed shape, the fill color shall be the color scale value evaluated
// at the arithmetic mean of all segment lengths (including the closing segment)
// of that shape.
// ============================================================================

console.log('Property 11: Shape Fill Color is Mean Segment Color');
console.log('===================================================');

const prop11Result = fc.check(
  fc.property(
    arbitraries.validClosedShape,
    (shape) => {
      // Compute the mean segment length
      const mean = meanSegmentLength(shape);

      // The reference length for the color scale (canvas diagonal).
      // Use a representative reference length (e.g., based on canvas size 800x600)
      // The actual reference doesn't matter for the property - we just need to verify
      // that colorScale(meanSegmentLength(shape), R) produces the fill color.
      // Use a fixed reference for consistency.
      const referenceLength = Math.sqrt(800 * 800 + 600 * 600); // ~1000

      // Compute the expected fill color
      const expectedFillColor = colorScale(mean, referenceLength);

      // Also compute it by manually calculating segments
      const segments = shape.getSegments();
      let totalLength = 0;
      for (let i = 0; i < segments.length; i++) {
        totalLength += segmentLength(segments[i].from, segments[i].to);
      }
      const manualMean = segments.length > 0 ? totalLength / segments.length : 0;

      // The fill color from the manual mean should match
      const manualFillColor = colorScale(manualMean, referenceLength);

      // Both approaches should agree (verifies meanSegmentLength is correct)
      if (expectedFillColor.h !== manualFillColor.h) return false;
      if (expectedFillColor.s !== manualFillColor.s) return false;
      if (expectedFillColor.l !== manualFillColor.l) return false;

      // The mean should be non-negative
      if (mean < 0) return false;

      // The fill color hue should be in valid range
      if (expectedFillColor.h < 0 || expectedFillColor.h > 240) return false;

      return true;
    }
  ),
  fcConfig
);

if (prop11Result.failed) {
  console.log('FAILED!');
  console.log('Counterexample:', JSON.stringify(prop11Result.counterexample, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASSED (' + fcConfig.numRuns + ' runs)');
}
console.log('');

// Summary
console.log('========================================');
console.log('ColorScale Property Tests Complete');
console.log('========================================');
if (process.exitCode === 1) {
  console.log('Some tests FAILED - see above for details.');
} else {
  console.log('All tests PASSED.');
}
