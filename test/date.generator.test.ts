import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../src/core.js';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';

describe('date generator', () => {
  it('respects date bounds', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const generator = gen.date(min, max);
    const randomSource = createSeededRandomSource(33);
    const value = generator.generate(randomSource);
    expect(value.getTime()).toBeGreaterThanOrEqual(min.getTime());
    expect(value.getTime()).toBeLessThanOrEqual(max.getTime());
  });

  it('shrinks toward minimal failing date', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const generator = gen.date(min, max);
    const result = runProperty(generator, (value) => value.getTime() === min.getTime(), {
      seed: 91,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample.getTime()).toBeGreaterThanOrEqual(min.getTime());
  });
});
