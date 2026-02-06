import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { generateValues } from './helpers.js';

describe('generator invariants', () => {
  it('uniqueArray produces unique values', () => {
    const allUnique = generateValues(gen.uniqueArray(gen.int(1, 100), { minLength: 3, maxLength: 6 }), 101, 20)
      .every((value) => new Set(value).size === value.length);
    expect(allUnique).toBe(true);
  });

  it('set produces unique values', () => {
    const allUnique = generateValues(gen.set(gen.int(1, 100), { minSize: 3, maxSize: 6 }), 101, 20)
      .every((value) => value.size === new Set(value).size);
    expect(allUnique).toBe(true);
  });

  it('dictionary produces unique keys', () => {
    const allUnique = generateValues(gen.dictionary(gen.string(3), gen.int(1, 10), { minKeys: 2, maxKeys: 4 }), 101, 20)
      .every((value) => Object.keys(value).length === new Set(Object.keys(value)).size);
    expect(allUnique).toBe(true);
  });
});
