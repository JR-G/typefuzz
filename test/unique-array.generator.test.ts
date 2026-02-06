import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';
import { generateOne } from './helpers.js';

describe('uniqueArray generator', () => {
  it('respects length bounds', () => {
    const value = generateOne(gen.uniqueArray(gen.int(1, 5), { minLength: 2, maxLength: 3 }), 33);
    expect(value.length).toBeGreaterThanOrEqual(2);
    expect(value.length).toBeLessThanOrEqual(3);
    expect(new Set(value).size).toBe(value.length);
  });

  it('shrinks toward minimal failing length', () => {
    const generator = gen.uniqueArray(gen.int(1, 10), { minLength: 2, maxLength: 4 });
    const result = runProperty(generator, (value) => value.length <= 1, {
      seed: 88,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    const shrunkLength = result.failure?.counterexample.length ?? 0;
    expect(shrunkLength).toBeGreaterThanOrEqual(2);
    expect(shrunkLength).toBeLessThanOrEqual(4);
  });
});
