import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { distances, isNonIncreasing } from './helpers.js';

describe('shrink monotonicity', () => {
  it('shrinks ints toward target without increasing distance', () => {
    const shrinks = Array.from(gen.int(5, 20).shrink(20));
    expect(shrinks.every((v) => v >= 5 && v <= 20)).toBe(true);
    expect(isNonIncreasing(distances(shrinks, 5))).toBe(true);
  });

  it('shrinks floats toward target without increasing distance', () => {
    const shrinks = Array.from(gen.float(0, 10).shrink(10));
    expect(shrinks.every((v) => v >= 0 && v <= 10)).toBe(true);
    expect(isNonIncreasing(distances(shrinks, 0))).toBe(true);
  });

  it('shrinks dates toward target without increasing distance', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const shrinks = Array.from(gen.date(min, max).shrink(new Date('2020-01-10T00:00:00.000Z')));
    expect(shrinks.every((v) => v.getTime() >= min.getTime() && v.getTime() <= max.getTime())).toBe(true);
    expect(isNonIncreasing(distances(shrinks.map((v) => v.getTime()), min.getTime()))).toBe(true);
  });
});
