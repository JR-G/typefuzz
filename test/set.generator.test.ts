import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';
import { generateOne } from './helpers.js';

describe('set generator', () => {
  it('respects size bounds', () => {
    const value = generateOne(gen.set(gen.int(1, 5), { minSize: 2, maxSize: 3 }), 33);
    expect(value.size).toBeGreaterThanOrEqual(2);
    expect(value.size).toBeLessThanOrEqual(3);
  });

  it('shrinks toward minimal failing size', () => {
    const generator = gen.set(gen.int(1, 5), { minSize: 2, maxSize: 4 });
    const result = runProperty(generator, (value) => value.size <= 1, {
      seed: 88,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect((result.failure?.counterexample ?? new Set()).size).toBe(2);
  });
});
