import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../src/core.js';
import { gen } from '../src/generators.js';

describe('generators', () => {
  it('int respects inclusive bounds', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.int(-2, 2);
    Array.from({ length: 100 }).forEach(() => {
      const value = generator.generate(randomSource);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(2);
      expect(Number.isInteger(value)).toBe(true);
    });
  });

  it('float respects bounds', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.float(1, 2);
    Array.from({ length: 100 }).forEach(() => {
      const value = generator.generate(randomSource);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThan(2);
    });
  });

  it('string respects length', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.string(12);
    const value = generator.generate(randomSource);
    expect(value.length).toBe(12);
  });

  it('array respects length', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.array(gen.bool(), 3);
    expect(generator.generate(randomSource)).toHaveLength(3);
  });

  it('object maps fields', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.object({
      id: gen.int(1, 1),
      name: gen.string(4)
    });
    const value = generator.generate(randomSource);
    expect(value.id).toBe(1);
    expect(value.name).toHaveLength(4);
  });

  it('rejects invalid ranges and lengths', () => {
    expect(() => gen.int(2, 1)).toThrowError(RangeError);
    expect(() => gen.float(2, 1)).toThrowError(RangeError);
    expect(() => gen.string(-1)).toThrowError(RangeError);
    expect(() => gen.array(gen.bool(), -1)).toThrowError(RangeError);
  });

  it('supports oneOf', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.oneOf(gen.int(1, 1), gen.int(2, 2));
    const value = generator.generate(randomSource);
    expect([1, 2]).toContain(value);
  });

  it('supports tuple', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.tuple(gen.int(1, 1), gen.string(3), gen.bool());
    const value = generator.generate(randomSource);
    expect(value[0]).toBe(1);
    expect(value[1]).toHaveLength(3);
    expect(typeof value[2]).toBe('boolean');
  });

  it('supports optional', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.optional(gen.int(5, 5), 0);
    const value = generator.generate(randomSource);
    expect(value).toBe(5);
  });

  it('supports constant', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.constant('fixed');
    const value = generator.generate(randomSource);
    expect(value).toBe('fixed');
  });

  it('supports constantFrom', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.constantFrom('a', 'b', 'c');
    const value = generator.generate(randomSource);
    expect(['a', 'b', 'c']).toContain(value);
  });

  it('supports map with unmap', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.map(
      gen.int(1, 1),
      (value) => `value:${value}`,
      (value) => (value === 'value:1' ? 1 : undefined)
    );
    const value = generator.generate(randomSource);
    expect(value).toBe('value:1');
  });

  it('supports filter', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.filter(gen.int(1, 10), (value) => value % 2 === 0, 50);
    const value = generator.generate(randomSource);
    expect(value % 2).toBe(0);
  });

  it('supports weightedOneOf', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.weightedOneOf([
      { weight: 1, arbitrary: gen.constant('a') },
      { weight: 3, arbitrary: gen.constant('b') }
    ]);
    const value = generator.generate(randomSource);
    expect(['a', 'b']).toContain(value);
  });

  it('supports frequency alias', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.frequency([
      { weight: 1, arbitrary: gen.constant('a') },
      { weight: 3, arbitrary: gen.constant('b') }
    ]);
    const value = generator.generate(randomSource);
    expect(['a', 'b']).toContain(value);
  });
});
