import { z } from 'zod';
import { createArbitrary, type Arbitrary, type Gen } from './core.js';
import { gen } from './generators.js';
import { randomInt, randomString, replaceAt, shrinkLengths, shrinkString } from './shrink-utils.js';

const DEFAULT_STRING_LENGTH = 8;
const DEFAULT_ARRAY_LENGTH = 5;
const DEFAULT_INT_RANGE = { min: 0, max: 100 };
const DEFAULT_FLOAT_RANGE = { min: 0, max: 1 };

/**
 * Build an Arbitrary from a Zod schema.
 *
 * @example
 * ```ts
 * const schema = z.object({ name: z.string().min(2).max(5) });
 * const arb = zodArbitrary(schema);
 * ```
 */
export function zodArbitrary<T extends z.ZodTypeAny>(schema: T): Arbitrary<z.infer<T>> {
  return buildArbitrary(schema) as Arbitrary<z.infer<T>>;
}

function asAny(schema: unknown): z.ZodTypeAny {
  return schema as z.ZodTypeAny;
}

function buildArbitrary(schema: z.ZodTypeAny): Arbitrary<unknown> {
  if (schema instanceof z.ZodString) {
    return stringArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodNumber) {
    return numberArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodBoolean) {
    return gen.bool() as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodArray) {
    return arrayArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodObject) {
    return objectArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodRecord) {
    return recordArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodTuple) {
    return tupleArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodMap) {
    return mapArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodSet) {
    return setArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return discriminatedUnionArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodOptional) {
    return gen.optional(buildArbitrary(asAny(schema.unwrap()))) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodNullable) {
    return gen.oneOf(literalArbitrary(null) as Arbitrary<unknown>, buildArbitrary(asAny(schema.unwrap()))) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodLiteral) {
    return literalArbitrary(schema.value) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodEnum) {
    return enumArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodUnion) {
    return unionArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodBigInt) {
    return bigintArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodDate) {
    return gen.date() as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodUndefined) {
    return literalArbitrary(undefined) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodVoid) {
    return literalArbitrary(undefined) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return gen.oneOf(
      gen.int() as Arbitrary<unknown>,
      gen.string() as Arbitrary<unknown>,
      gen.bool() as Arbitrary<unknown>,
      literalArbitrary(null) as Arbitrary<unknown>
    );
  }
  if (schema instanceof z.ZodDefault) {
    return buildArbitrary(asAny(schema.unwrap()));
  }
  if (schema instanceof z.ZodLazy) {
    return createArbitrary(
      (randomSource) => buildArbitrary(asAny(schema.unwrap())).generate(randomSource),
      (value) => buildArbitrary(asAny(schema.unwrap())).shrink(value)
    ) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodPipe) {
    return buildArbitrary(asAny(schema.in));
  }

  const schemaType = (schema as { _zod?: { def?: { type?: string } } })._zod?.def?.type ?? 'unknown';
  throw new TypeError(`Unsupported Zod schema type: ${schemaType}`);
}

function stringArbitrary(schema: z.ZodString): Arbitrary<string> {
  const min = schema.minLength;
  const max = schema.maxLength;
  const lengthMin = min ?? Math.min(DEFAULT_STRING_LENGTH, max ?? DEFAULT_STRING_LENGTH);
  const lengthMax = max ?? Math.max(lengthMin, DEFAULT_STRING_LENGTH);
  if (lengthMin === lengthMax) {
    return gen.string(lengthMin);
  }
  return createArbitrary(
    (randomSource) => {
      const length = randomInt(randomSource, lengthMin, lengthMax);
      return randomString(randomSource, length);
    },
    (value) => shrinkString(value)
  );
}

function numberArbitrary(schema: z.ZodNumber): Arbitrary<number> {
  const { min, max, integer } = numberBounds(schema);
  const defaultRange = integer ? DEFAULT_INT_RANGE : DEFAULT_FLOAT_RANGE;
  const rangeMin = min ?? Math.min(defaultRange.min, max ?? defaultRange.min);
  const rangeMax = max ?? Math.max(defaultRange.max, rangeMin);
  return integer ? gen.int(rangeMin, rangeMax) : gen.float(rangeMin, rangeMax);
}

function arrayArbitrary(schema: z.ZodArray): Arbitrary<unknown[]> {
  const { min, max } = arrayBounds(schema);
  const lengthMin = min ?? Math.min(DEFAULT_ARRAY_LENGTH, max ?? DEFAULT_ARRAY_LENGTH);
  const lengthMax = max ?? Math.max(lengthMin, DEFAULT_ARRAY_LENGTH);
  const itemArbitrary = buildArbitrary(asAny(schema.element));

  if (lengthMin === lengthMax) {
    return gen.array(itemArbitrary, lengthMin);
  }

  return createArbitrary(
    (randomSource) => {
      const length = randomInt(randomSource, lengthMin, lengthMax);
      return Array.from({ length }, () => itemArbitrary.generate(randomSource));
    },
    (value) => shrinkArray(value, itemArbitrary)
  );
}

function objectArbitrary(schema: z.ZodObject): Arbitrary<Record<string, unknown>> {
  const shape = schema.shape;
  const mappedShape = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, buildArbitrary(value as z.ZodTypeAny)])
  ) as Record<string, Arbitrary<unknown> | Gen<unknown>>;
  return gen.object(mappedShape) as Arbitrary<Record<string, unknown>>;
}

function enumArbitrary(schema: z.ZodEnum): Arbitrary<unknown> {
  const options = schema.options as unknown[];
  return createArbitrary(
    (randomSource) => options[Math.floor(randomSource() * options.length)],
    (value) => (Object.is(value, options[0]) ? [] : [options[0]])
  );
}

function unionArbitrary(schema: z.ZodUnion): Arbitrary<unknown> {
  const options = (schema.options as z.ZodTypeAny[]).map((option) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function recordArbitrary(schema: z.ZodRecord): Arbitrary<Record<string, unknown>> {
  const valueSchema = schema.valueType ?? schema._zod.def.valueType;
  if (!valueSchema) {
    throw new TypeError('ZodRecord must have a value type — use z.record(z.string(), valueType)');
  }
  const valueArbitrary = buildArbitrary(asAny(valueSchema));
  return gen.record(valueArbitrary);
}

function tupleArbitrary(schema: z.ZodTuple): Arbitrary<unknown[]> {
  const items = (schema._zod.def.items as z.ZodTypeAny[]).map((item) => buildArbitrary(item));
  return gen.tuple(...items);
}

function discriminatedUnionArbitrary(schema: z.ZodDiscriminatedUnion): Arbitrary<unknown> {
  const options = (schema.options as z.ZodTypeAny[]).map((option) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function mapArbitrary(schema: z.ZodMap): Arbitrary<Map<unknown, unknown>> {
  const keyArbitrary = buildArbitrary(asAny(schema.keyType));
  const valueArbitrary = buildArbitrary(asAny(schema.valueType));
  const entryArbitrary = gen.tuple(keyArbitrary, valueArbitrary);
  return gen.map(
    gen.array(entryArbitrary, { minLength: 0, maxLength: 3 }),
    (entries) => new Map(entries as Array<[unknown, unknown]>),
    (map) => Array.from(map.entries()) as Array<[unknown, unknown]>
  );
}

function setArbitrary(schema: z.ZodSet): Arbitrary<Set<unknown>> {
  const valueArbitrary = buildArbitrary(asAny(schema._zod.def.valueType));
  return gen.set(valueArbitrary);
}

function literalArbitrary<T>(value: T): Arbitrary<T> {
  return createArbitrary(() => value, () => []);
}

function bigintArbitrary(schema: z.ZodBigInt): Arbitrary<bigint> {
  const { min, max } = bigintBounds(schema);
  const rangeMin = min ?? (max !== undefined && max < 0n ? max : 0n);
  const rangeMax = max ?? (min !== undefined && min > 100n ? min + 100n : 100n);
  return gen.bigint(rangeMin, rangeMax);
}

interface NumericCheck {
  _zod: {
    def: {
      check: string;
      value?: number | bigint;
      inclusive?: boolean;
    };
  };
}

interface ArrayCheck {
  _zod: {
    def: {
      check: string;
      minimum?: number;
      maximum?: number;
      expected?: number;
    };
  };
}

function numberBounds(schema: z.ZodNumber): { min?: number; max?: number; integer: boolean } {
  const integer = schema.isInt;
  const checks = (schema._zod.def.checks ?? []) as NumericCheck[];
  return checks.reduce<{ min?: number; max?: number; integer: boolean }>((state, check) => {
    const def = check._zod.def;
    if (def.check === 'greater_than' && typeof def.value === 'number') {
      const bound = def.inclusive ? def.value : integer ? def.value + 1 : def.value + Number.EPSILON;
      return { ...state, min: bound };
    }
    if (def.check === 'less_than' && typeof def.value === 'number') {
      const bound = def.inclusive ? def.value : integer ? def.value - 1 : def.value - Number.EPSILON;
      return { ...state, max: bound };
    }
    return state;
  }, { integer });
}

function bigintBounds(schema: z.ZodBigInt): { min?: bigint; max?: bigint } {
  const checks = (schema._zod.def.checks ?? []) as NumericCheck[];
  return checks.reduce<{ min?: bigint; max?: bigint }>((state, check) => {
    const def = check._zod.def;
    if (def.check === 'greater_than' && typeof def.value === 'bigint') {
      const bound = def.inclusive ? def.value : def.value + 1n;
      return { ...state, min: bound };
    }
    if (def.check === 'less_than' && typeof def.value === 'bigint') {
      const bound = def.inclusive ? def.value : def.value - 1n;
      return { ...state, max: bound };
    }
    return state;
  }, {});
}

function arrayBounds(schema: z.ZodArray): { min?: number; max?: number } {
  const checks = (schema._zod.def.checks ?? []) as ArrayCheck[];
  return checks.reduce<{ min?: number; max?: number }>((state, check) => {
    const def = check._zod.def;
    if (def.check === 'min_length' && def.minimum !== undefined) {
      return { ...state, min: def.minimum };
    }
    if (def.check === 'max_length' && def.maximum !== undefined) {
      return { ...state, max: def.maximum };
    }
    if (def.check === 'length_equals' && def.expected !== undefined) {
      return { min: def.expected, max: def.expected };
    }
    return state;
  }, {});
}

function* shrinkArray(value: unknown[], itemArbitrary: Arbitrary<unknown>): Iterable<unknown[]> {
  if (value.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(value.length);
  for (const prefixLength of prefixLengths) {
    yield value.slice(0, prefixLength);
  }
  const shrinkCandidates = value.flatMap((item, index) =>
    Array.from(itemArbitrary.shrink(item)).map((shrunk) => replaceAt(value, index, shrunk))
  );
  yield* shrinkCandidates;
}
