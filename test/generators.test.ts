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

  it('supports uuid', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.uuid();
    const value = generator.generate(randomSource);
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('supports email', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.email();
    const value = generator.generate(randomSource);
    expect(value).toMatch(/^[a-z0-9]+@[a-z]+\.com$/);
  });

  it('rejects invalid weightedOneOf weights', () => {
    expect(() => gen.weightedOneOf([])).toThrowError(RangeError);
    expect(() => gen.weightedOneOf([{ weight: 0, arbitrary: gen.constant('a') }])).toThrowError(RangeError);
    expect(() => gen.weightedOneOf([{ weight: -1, arbitrary: gen.constant('a') }])).toThrowError(RangeError);
  });

  it('rejects invalid filter attempts', () => {
    expect(() => gen.filter(gen.int(1, 10), () => true, 0)).toThrowError(RangeError);
    expect(() => gen.filter(gen.int(1, 10), () => true, -1)).toThrowError(RangeError);
  });

  it('variable-length array respects minLength and maxLength', () => {
    const randomSource = createSeededRandomSource(42);
    const generator = gen.array(gen.int(1, 5), { minLength: 2, maxLength: 6 });
    Array.from({ length: 50 }).forEach(() => {
      const value = generator.generate(randomSource);
      expect(value.length).toBeGreaterThanOrEqual(2);
      expect(value.length).toBeLessThanOrEqual(6);
    });
  });

  it('gen.string with charset option', () => {
    const randomSource = createSeededRandomSource(7);
    const hexGen = gen.string({ length: 16, charset: 'hex' });
    const value = hexGen.generate(randomSource);
    expect(value).toHaveLength(16);
    expect(value).toMatch(/^[0-9a-f]+$/);
  });

  it('gen.string with custom chars', () => {
    const randomSource = createSeededRandomSource(7);
    const customGen = gen.string({ length: 10, chars: 'XY' });
    const value = customGen.generate(randomSource);
    expect(value).toHaveLength(10);
    expect(value).toMatch(/^[XY]+$/);
  });

  it('gen.string with numeric charset', () => {
    const randomSource = createSeededRandomSource(7);
    const numericGen = gen.string({ length: 6, charset: 'numeric' });
    const value = numericGen.generate(randomSource);
    expect(value).toHaveLength(6);
    expect(value).toMatch(/^[0-9]+$/);
  });

  it('gen.string number argument preserves backward compatibility', () => {
    const randomSource = createSeededRandomSource(7);
    const value = gen.string(5).generate(randomSource);
    expect(value).toHaveLength(5);
    expect(value).toMatch(/^[a-z0-9]+$/);
  });

  it('gen.string rejects empty chars', () => {
    expect(() => gen.string({ length: 5, chars: '' })).toThrowError(RangeError);
  });

  it('gen.bigint respects bounds', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.bigint(10n, 50n);
    Array.from({ length: 100 }).forEach(() => {
      const value = generator.generate(randomSource);
      expect(value).toBeGreaterThanOrEqual(10n);
      expect(value).toBeLessThanOrEqual(50n);
    });
  });

  it('gen.bigint defaults to 0n..100n', () => {
    const randomSource = createSeededRandomSource(7);
    const generator = gen.bigint();
    Array.from({ length: 50 }).forEach(() => {
      const value = generator.generate(randomSource);
      expect(value).toBeGreaterThanOrEqual(0n);
      expect(value).toBeLessThanOrEqual(100n);
    });
  });

  it('gen.bigint rejects invalid range', () => {
    expect(() => gen.bigint(10n, 5n)).toThrowError(RangeError);
  });

  it('gen.bigint shrinks toward 0n', () => {
    const generator = gen.bigint(0n, 100n);
    const shrunk = Array.from(generator.shrink(80n));
    expect(shrunk.length).toBeGreaterThan(0);
    expect(shrunk.every((v) => v >= 0n && v <= 100n)).toBe(true);
    expect(shrunk[shrunk.length - 1]).toBe(0n);
  });

  it('gen.bigint shrinks toward min when 0 is out of range', () => {
    const generator = gen.bigint(10n, 50n);
    const shrunk = Array.from(generator.shrink(40n));
    expect(shrunk.length).toBeGreaterThan(0);
    expect(shrunk.every((v) => v >= 10n && v <= 50n)).toBe(true);
    expect(shrunk[shrunk.length - 1]).toBe(10n);
  });
});
