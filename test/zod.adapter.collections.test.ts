import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSeededRandomSource } from '../src/core.js';
import { zodArbitrary } from '../src/zod.js';

describe('zod adapter collection invariants', () => {
  it('produces map values that parse', () => {
    const schema = z.map(z.string().min(1).max(2), z.number().int().min(1).max(3));
    const randomSource = createSeededRandomSource(202);
    const arbitrary = zodArbitrary(schema);
    const values = Array.from({ length: 30 }, () => arbitrary.generate(randomSource));
    const allValid = values.every((value) => schema.safeParse(value).success);
    expect(allValid).toBe(true);
  });

  it('produces set values that parse', () => {
    const schema = z.set(z.number().int().min(1).max(3));
    const randomSource = createSeededRandomSource(202);
    const arbitrary = zodArbitrary(schema);
    const values = Array.from({ length: 30 }, () => arbitrary.generate(randomSource));
    const allValid = values.every((value) => schema.safeParse(value).success);
    expect(allValid).toBe(true);
  });
});
