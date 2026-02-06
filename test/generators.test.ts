import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { generateOne, generateValues } from './helpers.js';

describe('generators', () => {
  it('int respects inclusive bounds', () => {
    generateValues(gen.int(-2, 2), 7, 100).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(2);
      expect(Number.isInteger(value)).toBe(true);
    });
  });

  it('float respects bounds', () => {
    generateValues(gen.float(1, 2), 7, 100).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThan(2);
    });
  });

  it('string respects length', () => {
    expect(generateOne(gen.string(12), 7).length).toBe(12);
  });

  it('array respects length', () => {
    expect(generateOne(gen.array(gen.bool(), 3), 7)).toHaveLength(3);
  });

  it('object maps fields', () => {
    const value = generateOne(gen.object({ id: gen.int(1, 1), name: gen.string(4) }), 7);
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
    expect([1, 2]).toContain(generateOne(gen.oneOf(gen.int(1, 1), gen.int(2, 2)), 7));
  });

  it('supports tuple', () => {
    const value = generateOne(gen.tuple(gen.int(1, 1), gen.string(3), gen.bool()), 7);
    expect(value[0]).toBe(1);
    expect(value[1]).toHaveLength(3);
    expect(typeof value[2]).toBe('boolean');
  });

  it('supports optional', () => {
    expect(generateOne(gen.optional(gen.int(5, 5), 0), 7)).toBe(5);
  });

  it('supports constant', () => {
    expect(generateOne(gen.constant('fixed'), 7)).toBe('fixed');
  });

  it('supports constantFrom', () => {
    expect(['a', 'b', 'c']).toContain(generateOne(gen.constantFrom('a', 'b', 'c'), 7));
  });

  it('supports map with unmap', () => {
    const generator = gen.map(
      gen.int(1, 1),
      (value) => `value:${value}`,
      (value) => (value === 'value:1' ? 1 : undefined)
    );
    expect(generateOne(generator, 7)).toBe('value:1');
  });

  it('supports filter', () => {
    const value = generateOne(gen.filter(gen.int(1, 10), (v) => v % 2 === 0, 50), 7);
    expect(value % 2).toBe(0);
  });

  it('supports weightedOneOf', () => {
    const generator = gen.weightedOneOf([
      { weight: 1, arbitrary: gen.constant('a') },
      { weight: 3, arbitrary: gen.constant('b') }
    ]);
    expect(['a', 'b']).toContain(generateOne(generator, 7));
  });

  it('supports frequency alias', () => {
    const generator = gen.frequency([
      { weight: 1, arbitrary: gen.constant('a') },
      { weight: 3, arbitrary: gen.constant('b') }
    ]);
    expect(['a', 'b']).toContain(generateOne(generator, 7));
  });

  it('supports uuid', () => {
    expect(generateOne(gen.uuid(), 7)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('supports email', () => {
    expect(generateOne(gen.email(), 7)).toMatch(/^[a-z0-9]+@[a-z]+\.com$/);
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
    generateValues(gen.array(gen.int(1, 5), { minLength: 2, maxLength: 6 }), 42, 50).forEach((value) => {
      expect(value.length).toBeGreaterThanOrEqual(2);
      expect(value.length).toBeLessThanOrEqual(6);
    });
  });

  it.each([
    { charset: 'hex' as const, length: 16, pattern: /^[0-9a-f]+$/ },
    { charset: 'numeric' as const, length: 6, pattern: /^[0-9]+$/ },
    { charset: 'alpha' as const, length: 8, pattern: /^[a-z]+$/ },
  ])('gen.string with $charset charset', ({ charset, length, pattern }) => {
    const value = generateOne(gen.string({ length, charset }), 7);
    expect(value).toHaveLength(length);
    expect(value).toMatch(pattern);
  });

  it('gen.string with custom chars', () => {
    const value = generateOne(gen.string({ length: 10, chars: 'XY' }), 7);
    expect(value).toHaveLength(10);
    expect(value).toMatch(/^[XY]+$/);
  });

  it('gen.string number argument preserves backward compatibility', () => {
    const value = generateOne(gen.string(5), 7);
    expect(value).toHaveLength(5);
    expect(value).toMatch(/^[a-z0-9]+$/);
  });

  it('gen.string rejects empty chars', () => {
    expect(() => gen.string({ length: 5, chars: '' })).toThrowError(RangeError);
  });

  it('gen.bigint respects bounds', () => {
    generateValues(gen.bigint(10n, 50n), 7, 100).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(10n);
      expect(value).toBeLessThanOrEqual(50n);
    });
  });

  it('gen.bigint defaults to 0n..100n', () => {
    generateValues(gen.bigint(), 7, 50).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0n);
      expect(value).toBeLessThanOrEqual(100n);
    });
  });

  it('gen.bigint rejects invalid range', () => {
    expect(() => gen.bigint(10n, 5n)).toThrowError(RangeError);
  });

  it('gen.bigint shrinks toward 0n', () => {
    const shrunk = Array.from(gen.bigint(0n, 100n).shrink(80n));
    expect(shrunk.length).toBeGreaterThan(0);
    expect(shrunk.every((v) => v >= 0n && v <= 100n)).toBe(true);
    expect(shrunk[shrunk.length - 1]).toBe(0n);
  });

  it('gen.bigint handles ranges beyond Number.MAX_SAFE_INTEGER', () => {
    const big = 2n ** 128n;
    generateValues(gen.bigint(0n, big), 7, 50).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0n);
      expect(value).toBeLessThanOrEqual(big);
    });
  });

  it('gen.bigint shrinks toward min when 0 is out of range', () => {
    const shrunk = Array.from(gen.bigint(10n, 50n).shrink(40n));
    expect(shrunk.length).toBeGreaterThan(0);
    expect(shrunk.every((v) => v >= 10n && v <= 50n)).toBe(true);
    expect(shrunk[shrunk.length - 1]).toBe(10n);
  });
});
