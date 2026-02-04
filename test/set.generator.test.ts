import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../src/core.js';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';

function setSize(value: Set<unknown>): number {
  return value.size;
}

describe('set generator', () => {
  it('respects size bounds', () => {
    const generator = gen.set(gen.int(1, 5), { minSize: 2, maxSize: 3 });
    const randomSource = createSeededRandomSource(33);
    const value = generator.generate(randomSource);
    const size = setSize(value);
    expect(size).toBeGreaterThanOrEqual(2);
    expect(size).toBeLessThanOrEqual(3);
  });

  it('shrinks toward minimal failing size', () => {
    const generator = gen.set(gen.int(1, 5), { minSize: 2, maxSize: 4 });
    const result = runProperty(generator, (value) => setSize(value) <= 1, {
      seed: 88,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(setSize(result.failure?.counterexample ?? new Set())).toBe(2);
  });
});
