import { z } from 'zod';
import { createArbitrary, type Arbitrary, type Gen } from './core.js';
import { gen } from './generators.js';

const DEFAULT_STRING_LENGTH = 8;
const DEFAULT_ARRAY_LENGTH = 5;
const DEFAULT_INT_RANGE = { min: 0, max: 100 };
const DEFAULT_FLOAT_RANGE = { min: 0, max: 1 };

/**
 * Build an Arbitrary from a Zod schema.
 */
export function zodArbitrary<T extends z.ZodTypeAny>(schema: T): Arbitrary<z.infer<T>> {
  return buildArbitrary(schema) as Arbitrary<z.infer<T>>;
}

function buildArbitrary(schema: z.ZodTypeAny): Arbitrary<unknown> {
  if (schema instanceof z.ZodString) {
    return stringArbitrary(schema);
  }
  if (schema instanceof z.ZodNumber) {
    return numberArbitrary(schema);
  }
  if (schema instanceof z.ZodBoolean) {
    return gen.bool();
  }
  if (schema instanceof z.ZodArray) {
    return arrayArbitrary(schema);
  }
  if (schema instanceof z.ZodObject) {
    return objectArbitrary(schema);
  }
  if (schema instanceof z.ZodOptional) {
    return gen.optional(buildArbitrary(schema.unwrap()));
  }
  if (schema instanceof z.ZodNullable) {
    return gen.oneOf(literalArbitrary(null), buildArbitrary(schema.unwrap()));
  }
  if (schema instanceof z.ZodLiteral) {
    return literalArbitrary(schema.value);
  }
  if (schema instanceof z.ZodEnum) {
    return enumArbitrary(schema);
  }
  if (schema instanceof z.ZodUnion) {
    return unionArbitrary(schema);
  }

  throw new TypeError(`Unsupported Zod schema type: ${schema._def.typeName}`);
}

function stringArbitrary(schema: z.ZodString): Arbitrary<string> {
  const { min, max } = stringBounds(schema);
  const lengthMin = min ?? DEFAULT_STRING_LENGTH;
  const lengthMax = max ?? lengthMin;
  if (lengthMin === lengthMax) {
    return gen.string(lengthMin);
  }
  return createArbitrary(
    (rng) => {
      const length = randomInt(rng, lengthMin, lengthMax);
      return randomString(rng, length);
    },
    (value) => shrinkString(value)
  );
}

function numberArbitrary(schema: z.ZodNumber): Arbitrary<number> {
  const { min, max, integer } = numberBounds(schema);
  const defaultRange = integer ? DEFAULT_INT_RANGE : DEFAULT_FLOAT_RANGE;
  const rangeMin = min ?? defaultRange.min;
  const rangeMax = max ?? defaultRange.max;
  return integer ? gen.int(rangeMin, rangeMax) : gen.float(rangeMin, rangeMax);
}

function arrayArbitrary(schema: z.ZodArray<z.ZodTypeAny>): Arbitrary<unknown[]> {
  const { min, max } = arrayBounds(schema);
  const lengthMin = min ?? DEFAULT_ARRAY_LENGTH;
  const lengthMax = max ?? lengthMin;
  const itemArbitrary = buildArbitrary(schema.element);

  if (lengthMin === lengthMax) {
    return gen.array(itemArbitrary, lengthMin);
  }

  return createArbitrary(
    (rng) => {
      const length = randomInt(rng, lengthMin, lengthMax);
      const out: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        out.push(itemArbitrary.generate(rng));
      }
      return out;
    },
    (value) => shrinkArray(value, itemArbitrary)
  );
}

function objectArbitrary(schema: z.ZodObject<Record<string, z.ZodTypeAny>>): Arbitrary<Record<string, unknown>> {
  const shape = schema.shape;
  const entries = Object.entries(shape);
  const mappedShape: Record<string, Arbitrary<unknown> | Gen<unknown>> = {};
  for (const [key, value] of entries) {
    mappedShape[key] = buildArbitrary(value);
  }
  return gen.object(mappedShape) as Arbitrary<Record<string, unknown>>;
}

function enumArbitrary(schema: z.ZodEnum<[string, ...string[]]>): Arbitrary<string> {
  const options = schema.options;
  return createArbitrary(
    (rng) => options[Math.floor(rng() * options.length)],
    (value) => (value === options[0] ? [] : [options[0]])
  );
}

function unionArbitrary(schema: z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>): Arbitrary<unknown> {
  const options = schema._def.options.map((option: z.ZodTypeAny) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function literalArbitrary<T>(value: T): Arbitrary<T> {
  return createArbitrary(() => value, () => []);
}

function stringBounds(schema: z.ZodString): { min?: number; max?: number } {
  let min: number | undefined;
  let max: number | undefined;
  for (const check of schema._def.checks) {
    if (check.kind === 'min') {
      min = check.value;
    }
    if (check.kind === 'max') {
      max = check.value;
    }
  }
  return { min, max };
}

function numberBounds(schema: z.ZodNumber): { min?: number; max?: number; integer: boolean } {
  let min: number | undefined;
  let max: number | undefined;
  let integer = false;
  for (const check of schema._def.checks) {
    if (check.kind === 'min') {
      min = check.value;
    }
    if (check.kind === 'max') {
      max = check.value;
    }
    if (check.kind === 'int') {
      integer = true;
    }
  }
  return { min, max, integer };
}

function arrayBounds(schema: z.ZodArray<z.ZodTypeAny>): { min?: number; max?: number } {
  let min: number | undefined;
  let max: number | undefined;
  for (const check of schema._def.exactLength ? [schema._def.exactLength] : []) {
    if (check.value !== undefined) {
      min = check.value;
      max = check.value;
    }
  }
  for (const check of schema._def.minLength ? [schema._def.minLength] : []) {
    if (check.value !== undefined) {
      min = check.value;
    }
  }
  for (const check of schema._def.maxLength ? [schema._def.maxLength] : []) {
    if (check.value !== undefined) {
      max = check.value;
    }
  }
  return { min, max };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomString(rng: () => number, length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += chars[Math.floor(rng() * chars.length)];
  }
  return out;
}

function* shrinkString(value: string): Iterable<string> {
  if (value.length === 0) {
    return;
  }
  yield '';
  let length = Math.floor(value.length / 2);
  while (length > 0) {
    yield value.slice(0, length);
    length = Math.floor(length / 2);
  }
}

function* shrinkArray(value: unknown[], itemArbitrary: Arbitrary<unknown>): Iterable<unknown[]> {
  if (value.length === 0) {
    return;
  }
  let length = Math.floor(value.length / 2);
  while (length >= 0) {
    yield value.slice(0, length);
    if (length === 0) {
      break;
    }
    length = Math.floor(length / 2);
  }
  for (let index = 0; index < value.length; index += 1) {
    for (const shrunk of itemArbitrary.shrink(value[index])) {
      const next = value.slice();
      next[index] = shrunk;
      yield next;
    }
  }
}
