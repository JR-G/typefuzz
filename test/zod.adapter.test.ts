import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSeededRng } from '../src/core.js';
import { zodArbitrary } from '../src/zod.js';

describe('zod adapter', () => {
  it('generates values that satisfy schemas', () => {
    const schema = z.object({
      name: z.string().min(2).max(5),
      count: z.number().int().min(1).max(3),
      active: z.boolean(),
      tags: z.array(z.string().min(1).max(2)).min(1).max(3),
      status: z.enum(['open', 'closed'])
    });

    const rng = createSeededRng(42);
    const arbitrary = zodArbitrary(schema);
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const value = arbitrary.generate(rng);
      expect(() => schema.parse(value)).not.toThrow();
    }
  });

  it('supports optional and nullable', () => {
    const schema = z.object({
      note: z.string().optional(),
      alias: z.string().nullable(),
      choice: z.union([z.literal('a'), z.literal('b')])
    });

    const rng = createSeededRng(7);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(rng);
    expect(() => schema.parse(value)).not.toThrow();
  });
});
