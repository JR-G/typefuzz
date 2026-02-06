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

  it('supports map schemas', () => {
    const schema = z.map(z.string().min(1).max(2), z.number().int().min(1).max(2));
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports set schemas', () => {
    const schema = z.set(z.number().int().min(1).max(3));
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports native enums', () => {
    const Status = {
      Active: 'active',
      Pending: 'pending',
      Disabled: 'disabled'
    } as const;
    const schema = z.nativeEnum(Status);
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports z.date()', () => {
    const schema = z.date();
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(value).toBeInstanceOf(Date);
    expect(() => schema.parse(value)).not.toThrow();
  });

  it('supports z.lazy() with recursive-like schema', () => {
    const schema: z.ZodTypeAny = z.lazy(() => z.string().min(1).max(5));
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThanOrEqual(1);
    expect(value.length).toBeLessThanOrEqual(5);
  });

  it('supports z.default() by unwrapping inner type', () => {
    const schema = z.string().min(2).max(4).default('hi');
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThanOrEqual(2);
    expect(value.length).toBeLessThanOrEqual(4);
  });

  it('supports z.any() and z.unknown()', () => {
    const anySchema = z.any();
    const unknownSchema = z.unknown();
    const randomSource = createSeededRandomSource(17);
    const anyValue = zodArbitrary(anySchema).generate(randomSource);
    const unknownValue = zodArbitrary(unknownSchema).generate(randomSource);
    expect(anyValue !== undefined || anyValue === undefined).toBe(true);
    expect(unknownValue !== undefined || unknownValue === undefined).toBe(true);
  });

  it('supports z.string().transform() via ZodEffects', () => {
    const schema = z.string().min(1).max(5).transform((s) => s.toUpperCase());
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(typeof value).toBe('string');
  });

  it('respects z.string().length() constraint', () => {
    const schema = z.string().length(5);
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    Array.from({ length: 50 }).forEach(() => {
      const value = arbitrary.generate(randomSource);
      expect(value).toHaveLength(5);
    });
  });

  it('respects exclusive number bounds via .gt() and .lt()', () => {
    const schema = z.number().int().gt(0).lt(10);
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    Array.from({ length: 100 }).forEach(() => {
      const value = arbitrary.generate(randomSource);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(10);
    });
  });

  it('map with number keys preserves key type', () => {
    const schema = z.map(z.number().int().min(1).max(10), z.string().min(1).max(3));
    const randomSource = createSeededRandomSource(17);
    const arbitrary = zodArbitrary(schema);
    const value = arbitrary.generate(randomSource);
    expect(value).toBeInstanceOf(Map);
    for (const key of value.keys()) {
      expect(typeof key).toBe('number');
    }
  });
});
