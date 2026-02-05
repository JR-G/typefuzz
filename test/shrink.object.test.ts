import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';

describe('object shrinking', () => {
  it('shrinks individual fields', () => {
    const arbitrary = gen.object({
      count: gen.int(1, 10),
      label: gen.string(4)
    });

    const result = runProperty(arbitrary, (value) => value.count === 1 && value.label === '', {
      seed: 123,
      runs: 1,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample.count).toBeLessThanOrEqual(5);
    expect(result.failure?.counterexample.label.length).toBeLessThanOrEqual(4);
  });
});
