import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { includesShorter } from './helpers.js';

describe('tuple and object shrink behaviour', () => {
  it('shrinks tuple entries', () => {
    const generator = gen.tuple(gen.int(1, 10), gen.string(4));
    const value: [number, string] = [10, 'abcd'];
    const shrinks = Array.from(generator.shrink(value));
    const numberValues = shrinks.map((entry) => entry[0]);
    const stringLengths = shrinks.map((entry) => entry[1].length);
    expect(includesShorter(numberValues, value[0])).toBe(true);
    expect(includesShorter(stringLengths, value[1].length)).toBe(true);
  });

  it('shrinks object fields', () => {
    const generator = gen.object({ count: gen.int(1, 10), name: gen.string(4) });
    const value = { count: 10, name: 'abcd' };
    const shrinks = Array.from(generator.shrink(value));
    const countValues = shrinks.map((entry) => entry.count);
    const nameLengths = shrinks.map((entry) => entry.name.length);
    expect(includesShorter(countValues, value.count)).toBe(true);
    expect(includesShorter(nameLengths, value.name.length)).toBe(true);
  });
});
