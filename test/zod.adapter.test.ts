import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodArbitrary } from '../src/zod.js';
import { generateOne, generateValues } from './helpers.js';

describe('zod adapter', () => {
  describe('basic types', () => {
    it('generates values that satisfy schemas', () => {
      const schema = z.object({
        name: z.string().min(2).max(5),
        count: z.number().int().min(1).max(3),
        active: z.boolean(),
        tags: z.array(z.string().min(1).max(2)).min(1).max(3),
        status: z.enum(['open', 'closed'])
      });

      generateValues(zodArbitrary(schema), 42, 20).forEach((value) => {
        expect(() => schema.parse(value)).not.toThrow();
      });
    });

    it('supports optional and nullable', () => {
      const schema = z.object({
        note: z.string().optional(),
        alias: z.string().nullable(),
        choice: z.union([z.literal('a'), z.literal('b')])
      });

      const value = generateOne(zodArbitrary(schema), 7);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports z.date()', () => {
      const schema = z.date();
      const value = generateOne(zodArbitrary(schema), 17);
      expect(value).toBeInstanceOf(Date);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports z.any() and z.unknown()', () => {
      const anyValue = generateOne(zodArbitrary(z.any()), 17);
      const unknownValue = generateOne(zodArbitrary(z.unknown()), 18);
      expect(anyValue !== undefined || anyValue === undefined).toBe(true);
      expect(unknownValue !== undefined || unknownValue === undefined).toBe(true);
    });

    it('supports native enums', () => {
      const Status = { Active: 'active', Pending: 'pending', Disabled: 'disabled' } as const;
      const schema = z.nativeEnum(Status);
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });
  });

  describe('composite types', () => {
    it('supports record schemas', () => {
      const schema = z.record(z.number().int().min(1).max(3));
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports tuple schemas', () => {
      const schema = z.tuple([z.string().min(1).max(2), z.number().int().min(1).max(2)]);
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports discriminated unions', () => {
      const schema = z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('one'), value: z.string().min(1).max(3) }),
        z.object({ kind: z.literal('two'), value: z.number().int().min(1).max(3) })
      ]);
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports map schemas', () => {
      const schema = z.map(z.string().min(1).max(2), z.number().int().min(1).max(2));
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('supports set schemas', () => {
      const schema = z.set(z.number().int().min(1).max(3));
      const value = generateOne(zodArbitrary(schema), 17);
      expect(() => schema.parse(value)).not.toThrow();
    });

    it('map with number keys preserves key type', () => {
      const schema = z.map(z.number().int().min(1).max(10), z.string().min(1).max(3));
      const value = generateOne(zodArbitrary(schema), 17);
      expect(value).toBeInstanceOf(Map);
      for (const key of value.keys()) {
        expect(typeof key).toBe('number');
      }
    });
  });

  describe('wrappers and effects', () => {
    it('supports z.lazy() with recursive-like schema', () => {
      const schema: z.ZodTypeAny = z.lazy(() => z.string().min(1).max(5));
      const value = generateOne(zodArbitrary(schema), 17);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThanOrEqual(1);
      expect(value.length).toBeLessThanOrEqual(5);
    });

    it('supports z.default() by unwrapping inner type', () => {
      const schema = z.string().min(2).max(4).default('hi');
      const value = generateOne(zodArbitrary(schema), 17);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThanOrEqual(2);
      expect(value.length).toBeLessThanOrEqual(4);
    });

    it('supports z.string().transform() via ZodEffects', () => {
      const schema = z.string().min(1).max(5).transform((s) => s.toUpperCase());
      const value = generateOne(zodArbitrary(schema), 17);
      expect(typeof value).toBe('string');
    });
  });

  describe('constraint handling', () => {
    it('respects z.string().length() constraint', () => {
      const schema = z.string().length(5);
      generateValues(zodArbitrary(schema), 17, 50).forEach((value) => {
        expect(value).toHaveLength(5);
      });
    });

    it('respects exclusive number bounds via .gt() and .lt()', () => {
      const schema = z.number().int().gt(0).lt(10);
      generateValues(zodArbitrary(schema), 17, 100).forEach((value) => {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(10);
      });
    });

    it('respects z.bigint() bounds', () => {
      const schema = z.bigint().min(10n).max(50n);
      generateValues(zodArbitrary(schema), 17, 100).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(10n);
        expect(value).toBeLessThanOrEqual(50n);
      });
    });

    it('respects exclusive z.bigint() bounds via .gt() and .lt()', () => {
      const schema = z.bigint().gt(0n).lt(10n);
      generateValues(zodArbitrary(schema), 17, 100).forEach((value) => {
        expect(value).toBeGreaterThan(0n);
        expect(value).toBeLessThan(10n);
      });
    });
  });

  describe('single-sided bounds', () => {
    it.each([
      {
        label: 'z.number().int().min()',
        schema: z.number().int().min(200),
        check: (v: number) => expect(v).toBeGreaterThanOrEqual(200)
      },
      {
        label: 'z.number().int().max()',
        schema: z.number().int().max(-5),
        check: (v: number) => expect(v).toBeLessThanOrEqual(-5)
      },
      {
        label: 'z.string().max()',
        schema: z.string().max(3),
        check: (v: string) => expect(v.length).toBeLessThanOrEqual(3)
      },
      {
        label: 'z.bigint().min()',
        schema: z.bigint().min(200n),
        check: (v: bigint) => expect(v).toBeGreaterThanOrEqual(200n)
      }
    ])('handles $label with only one bound', ({ schema, check }) => {
      generateValues(zodArbitrary(schema as z.ZodTypeAny), 17, 50).forEach(check);
    });

    it('handles z.array().max() with only an upper bound', () => {
      const schema = z.array(z.number().int().min(1).max(5)).max(2);
      generateValues(zodArbitrary(schema), 17, 50).forEach((value) => {
        expect(value.length).toBeLessThanOrEqual(2);
      });
    });

    it('handles z.array().min() with only a lower bound', () => {
      const schema = z.array(z.number().int().min(1).max(5)).min(10);
      generateValues(zodArbitrary(schema), 17, 50).forEach((value) => {
        expect(value.length).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('invariants', () => {
    it('produces values that always parse for mixed schema', () => {
      const schema = z.object({
        id: z.string().min(2).max(6),
        count: z.number().int().min(1).max(10),
        flags: z.array(z.boolean()).min(0).max(3),
        meta: z.record(z.string().min(1).max(3)).optional(),
        state: z.nativeEnum({ Active: 'active', Pending: 'pending' } as const)
      });

      const allValid = generateValues(zodArbitrary(schema), 123, 50)
        .every((value) => schema.safeParse(value).success);
      expect(allValid).toBe(true);
    });

    it('produces values for union schemas', () => {
      const schema = z.union([
        z.object({ kind: z.literal('a'), value: z.string().min(1).max(2) }),
        z.object({ kind: z.literal('b'), value: z.number().int().min(1).max(3) })
      ]);

      const allValid = generateValues(zodArbitrary(schema), 321, 50)
        .every((value) => schema.safeParse(value).success);
      expect(allValid).toBe(true);
    });

    it('produces map values that parse', () => {
      const schema = z.map(z.string().min(1).max(2), z.number().int().min(1).max(3));
      const allValid = generateValues(zodArbitrary(schema), 202, 30)
        .every((value) => schema.safeParse(value).success);
      expect(allValid).toBe(true);
    });

    it('produces set values that parse', () => {
      const schema = z.set(z.number().int().min(1).max(3));
      const allValid = generateValues(zodArbitrary(schema), 202, 30)
        .every((value) => schema.safeParse(value).success);
      expect(allValid).toBe(true);
    });
  });
});
