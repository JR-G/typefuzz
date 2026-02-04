import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';

function distances(values: number[], target: number): number[] {
  return values.map((value) => Math.abs(value - target));
}

function isNonIncreasing(values: number[]): boolean {
  const initial = { ok: true, previous: Number.POSITIVE_INFINITY };
  return values.reduce((state, current) => ({
    ok: state.ok && current <= state.previous,
    previous: current
  }), initial).ok;
}

describe('shrink monotonicity', () => {
  it('shrinks ints toward target without increasing distance', () => {
    const generator = gen.int(5, 20);
    const value = 20;
    const target = 5;
    const shrinks = Array.from(generator.shrink(value));
    const distanceValues = distances(shrinks, target);
    expect(shrinks.every((item) => item >= 5 && item <= 20)).toBe(true);
    expect(isNonIncreasing(distanceValues)).toBe(true);
  });

  it('shrinks floats toward target without increasing distance', () => {
    const generator = gen.float(0, 10);
    const value = 10;
    const target = 0;
    const shrinks = Array.from(generator.shrink(value));
    const distanceValues = distances(shrinks, target);
    expect(shrinks.every((item) => item >= 0 && item <= 10)).toBe(true);
    expect(isNonIncreasing(distanceValues)).toBe(true);
  });

  it('shrinks dates toward target without increasing distance', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-10T00:00:00.000Z');
    const generator = gen.date(min, max);
    const value = new Date('2020-01-10T00:00:00.000Z');
    const target = min.getTime();
    const shrinks = Array.from(generator.shrink(value));
    const distanceValues = distances(shrinks.map((item) => item.getTime()), target);
    expect(shrinks.every((item) => item.getTime() >= min.getTime() && item.getTime() <= max.getTime())).toBe(true);
    expect(isNonIncreasing(distanceValues)).toBe(true);
  });
});
