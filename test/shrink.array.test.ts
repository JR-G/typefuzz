import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';

describe('array shrinking', () => {
  it('shrinks toward minimal failing length', () => {
    const arbitrary = gen.array(gen.int(0, 10), 5);
    const result = runProperty(arbitrary, (value) => value.length === 0, {
      seed: 101,
      runs: 20,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample.length).toBe(1);
  });
});
