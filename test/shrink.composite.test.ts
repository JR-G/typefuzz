import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';

function lengths(values: Array<{ length: number }>): number[] {
  return values.map((value) => value.length);
}

function includesShorter(values: number[], original: number): boolean {
  return values.some((value) => value < original);
}

describe('composite shrink monotonicity', () => {
  it('shrinks arrays toward shorter lengths', () => {
    const generator = gen.array(gen.int(1, 10), 8);
    const value = Array.from({ length: 8 }, (_, index) => index + 1);
    const shrinks = Array.from(generator.shrink(value));
    const lengthValues = lengths(shrinks);
    expect(includesShorter(lengthValues, value.length)).toBe(true);
    expect(lengthValues.every((lengthValue) => lengthValue >= 0 && lengthValue <= value.length)).toBe(true);
  });

  it('shrinks records toward fewer keys', () => {
    const generator = gen.record(gen.int(1, 10), { minKeys: 1, maxKeys: 4 });
    const value = { a: 1, b: 2, c: 3, d: 4 } as Record<string, number>;
    const shrinks = Array.from(generator.shrink(value));
    const lengthValues = lengths(shrinks.map((entry) => ({ length: Object.keys(entry).length })));
    expect(includesShorter(lengthValues, Object.keys(value).length)).toBe(true);
    expect(lengthValues.every((lengthValue) => lengthValue >= 0 && lengthValue <= Object.keys(value).length)).toBe(true);
  });

  it('shrinks unique arrays toward shorter lengths', () => {
    const generator = gen.uniqueArray(gen.int(1, 10), { minLength: 1, maxLength: 4 });
    const value = [1, 2, 3, 4];
    const shrinks = Array.from(generator.shrink(value));
    const lengthValues = lengths(shrinks);
    expect(includesShorter(lengthValues, value.length)).toBe(true);
    expect(lengthValues.every((lengthValue) => lengthValue >= 0 && lengthValue <= value.length)).toBe(true);
  });

  it('shrinks sets toward smaller sizes', () => {
    const generator = gen.set(gen.int(1, 10), { minSize: 1, maxSize: 4 });
    const value = new Set([1, 2, 3, 4]);
    const shrinks = Array.from(generator.shrink(value));
    const sizeValues = shrinks.map((entry) => entry.size);
    expect(includesShorter(sizeValues, value.size)).toBe(true);
    expect(sizeValues.every((sizeValue) => sizeValue >= 0 && sizeValue <= value.size)).toBe(true);
  });
});
