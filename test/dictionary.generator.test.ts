import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';
import { generateOne, keyCount } from './helpers.js';

describe('dictionary generator', () => {
  it('respects key bounds', () => {
    const value = generateOne(gen.dictionary(gen.string(1), gen.int(1, 1), { minKeys: 2, maxKeys: 3 }), 42);
    const count = keyCount(value);
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('shrinks toward minimal failing size', () => {
    const generator = gen.dictionary(gen.constantFrom('a', 'b', 'c', 'd'), gen.int(1, 10), { minKeys: 2, maxKeys: 4 });
    const result = runProperty(generator, (value) => keyCount(value) <= 1, {
      seed: 123,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(keyCount(result.failure?.counterexample ?? {})).toBe(2);
  });
});
