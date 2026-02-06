import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';
import { keyCount } from './helpers.js';

describe('record generator', () => {
  it('respects key bounds', () => {
    const value = gen.record(gen.int(1, 1), { minKeys: 2, maxKeys: 3 }).generate(() => 0.5);
    const count = keyCount(value);
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('shrinks toward minimal failing size', () => {
    const generator = gen.record(gen.int(1, 10), { minKeys: 2, maxKeys: 4 });
    const result = runProperty(generator, (value) => keyCount(value) <= 1, {
      seed: 99,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    const shrunkKeys = keyCount(result.failure?.counterexample ?? {});
    expect(shrunkKeys).toBeGreaterThanOrEqual(2);
    expect(shrunkKeys).toBeLessThanOrEqual(4);
  });
});
