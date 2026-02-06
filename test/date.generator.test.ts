import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { runProperty } from '../src/property.js';
import { generateOne } from './helpers.js';

describe('date generator', () => {
  it('respects date bounds', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const value = generateOne(gen.date(min, max), 33);
    expect(value.getTime()).toBeGreaterThanOrEqual(min.getTime());
    expect(value.getTime()).toBeLessThanOrEqual(max.getTime());
  });

  it('shrinks toward minimal failing date', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const result = runProperty(gen.date(min, max), (value) => value.getTime() === min.getTime(), {
      seed: 91,
      runs: 10,
      maxShrinks: 200
    });

    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample.getTime()).toBeGreaterThanOrEqual(min.getTime());
  });

  it('rejects invalid date bounds', () => {
    const min = new Date('2020-01-10T00:00:00.000Z');
    const max = new Date('2020-01-01T00:00:00.000Z');
    expect(() => gen.date(min, max)).toThrowError(RangeError);
    expect(() => gen.date(new Date('invalid'), new Date())).toThrowError(RangeError);
  });
});
