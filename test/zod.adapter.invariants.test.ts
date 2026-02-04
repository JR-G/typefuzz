import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSeededRandomSource } from '../src/core.js';
import { zodArbitrary } from '../src/zod.js';

describe('zod adapter invariants', () => {
  it('produces values that always parse for mixed schema', () => {
    const schema = z.object({
      id: z.string().min(2).max(6),
      count: z.number().int().min(1).max(10),
      flags: z.array(z.boolean()).min(0).max(3),
      meta: z.record(z.string().min(1).max(3)).optional(),
      state: z.nativeEnum({ Active: 'active', Pending: 'pending' } as const)
    });
    const randomSource = createSeededRandomSource(123);
    const arbitrary = zodArbitrary(schema);
    const values = Array.from({ length: 50 }, () => arbitrary.generate(randomSource));
    const results = values.map((value) => schema.safeParse(value));
    const allValid = results.every((result) => result.success);
    expect(allValid).toBe(true);
  });

  it('produces values for union schemas', () => {
    const schema = z.union([
      z.object({ kind: z.literal('a'), value: z.string().min(1).max(2) }),
      z.object({ kind: z.literal('b'), value: z.number().int().min(1).max(3) })
    ]);
    const randomSource = createSeededRandomSource(321);
    const arbitrary = zodArbitrary(schema);
    const values = Array.from({ length: 50 }, () => arbitrary.generate(randomSource));
    const results = values.map((value) => schema.safeParse(value));
    const allValid = results.every((result) => result.success);
    expect(allValid).toBe(true);
  });
});
