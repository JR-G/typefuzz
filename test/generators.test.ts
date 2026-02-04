import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../src/core.js';
import { gen } from '../src/generators.js';

describe('generators', () => {
  it('int respects inclusive bounds', () => {
    const rng = createSeededRng(7);
    const generator = gen.int(-2, 2);
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const value = generator.generate(rng);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(2);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('float respects bounds', () => {
    const rng = createSeededRng(7);
    const generator = gen.float(1, 2);
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const value = generator.generate(rng);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThan(2);
    }
  });

  it('string respects length', () => {
    const rng = createSeededRng(7);
    const generator = gen.string(12);
    const value = generator.generate(rng);
    expect(value.length).toBe(12);
  });

  it('array respects length', () => {
    const rng = createSeededRng(7);
    const generator = gen.array(gen.bool(), 3);
    expect(generator.generate(rng)).toHaveLength(3);
  });

  it('object maps fields', () => {
    const rng = createSeededRng(7);
    const generator = gen.object({
      id: gen.int(1, 1),
      name: gen.string(4)
    });
    const value = generator.generate(rng);
    expect(value.id).toBe(1);
    expect(value.name).toHaveLength(4);
  });

  it('rejects invalid ranges and lengths', () => {
    expect(() => gen.int(2, 1)).toThrowError(RangeError);
    expect(() => gen.float(2, 1)).toThrowError(RangeError);
    expect(() => gen.string(-1)).toThrowError(RangeError);
    expect(() => gen.array(gen.bool(), -1)).toThrowError(RangeError);
  });
});
