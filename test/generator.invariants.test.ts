import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../src/core.js';
import { gen } from '../src/generators.js';

describe('generator invariants', () => {
  it('uniqueArray produces unique values', () => {
    const randomSource = createSeededRandomSource(101);
    const generator = gen.uniqueArray(gen.int(1, 100), { minLength: 3, maxLength: 6 });
    const values = Array.from({ length: 20 }, () => generator.generate(randomSource));
    const allUnique = values.every((value) => new Set(value).size === value.length);
    expect(allUnique).toBe(true);
  });

  it('set produces unique values', () => {
    const randomSource = createSeededRandomSource(101);
    const generator = gen.set(gen.int(1, 100), { minSize: 3, maxSize: 6 });
    const values = Array.from({ length: 20 }, () => generator.generate(randomSource));
    const allUnique = values.every((value) => value.size === new Set(value).size);
    expect(allUnique).toBe(true);
  });

  it('dictionary produces unique keys', () => {
    const randomSource = createSeededRandomSource(101);
    const generator = gen.dictionary(gen.string(3), gen.int(1, 10), { minKeys: 2, maxKeys: 4 });
    const values = Array.from({ length: 20 }, () => generator.generate(randomSource));
    const allUnique = values.every((value) => Object.keys(value).length === new Set(Object.keys(value)).size);
    expect(allUnique).toBe(true);
  });
});
