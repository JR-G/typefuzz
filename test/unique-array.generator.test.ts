import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../src/core.js';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';

function uniqueCount(values: unknown[]): number {
  return new Set(values).size;
}

describe('uniqueArray generator', () => {
  it('respects length bounds', () => {
    const generator = gen.uniqueArray(gen.int(1, 5), { minLength: 2, maxLength: 3 });
    const randomSource = createSeededRandomSource(33);
    const value = generator.generate(randomSource);
    expect(value.length).toBeGreaterThanOrEqual(2);
    expect(value.length).toBeLessThanOrEqual(3);
    expect(uniqueCount(value)).toBe(value.length);
  });

  it('shrinks toward minimal failing length', () => {
    const generator = gen.uniqueArray(gen.int(1, 10), { minLength: 2, maxLength: 4 });
    const result = runProperty(generator, (value) => value.length <= 1, {
      seed: 88,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample.length).toBe(2);
  });
});
