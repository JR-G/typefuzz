import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSeededRandomSource } from '../src/core.js';
import { zodArbitrary } from '../src/zod.js';

describe('zod adapter extra types', () => {
  it('supports record schemas', () => {
    const schema = z.record(z.number().int().min(1).max(3));
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports tuple schemas', () => {
    const schema = z.tuple([z.string().min(1).max(2), z.number().int().min(1).max(2)]);
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports discriminated unions', () => {
    const schema = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('one'), value: z.string().min(1).max(3) }),
      z.object({ kind: z.literal('two'), value: z.number().int().min(1).max(3) })
    ]);
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });
});
