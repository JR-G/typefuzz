import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { fuzz } from '../src/index.js';
import { fuzzAssert, runProperty } from '../src/property.js';

describe('property runner', () => {
  it('shrinks to minimal counterexample', () => {
    const result = runProperty(gen.int(1, 100), () => false, { seed: 123, runs: 1, maxShrinks: 100 });
    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample).toBe(1);
  });

  it('throws with seed and counterexample details', () => {
    expect(() => {
      fuzzAssert(gen.int(1, 10), () => false, { seed: 77, runs: 1, maxShrinks: 50 });
    }).toThrowError(/seed: 77/);
  });

  it('supports fuzz.property alias', () => {
    const result = fuzz.property(gen.bool(), () => true, { seed: 5, runs: 2 });
    expect(result.ok).toBe(true);
  });
});
