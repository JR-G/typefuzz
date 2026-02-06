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
    return gen.optional(buildArbitrary(schema.unwrap())) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodNullable) {
    return gen.oneOf(literalArbitrary(null) as Arbitrary<unknown>, buildArbitrary(schema.unwrap())) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodLiteral) {
    return literalArbitrary(schema.value) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodEnum) {
    return enumArbitrary(schema) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodNativeEnum) {
    return nativeEnumArbitrary(schema) as Arbitrary<unknown>;
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
    return buildArbitrary(schema._def.innerType);
  }
  if (schema instanceof z.ZodLazy) {
    return createArbitrary(
      (randomSource) => buildArbitrary(schema._def.getter()).generate(randomSource),
      (value) => buildArbitrary(schema._def.getter()).shrink(value)
    ) as Arbitrary<unknown>;
  }
  if (schema instanceof z.ZodEffects) {
    return buildArbitrary(schema._def.schema);
  }

  throw new TypeError(`Unsupported Zod schema type: ${schema._def.typeName} (typefuzz targets Zod 3.x)`);
}

function stringArbitrary(schema: z.ZodString): Arbitrary<string> {
  const { min, max } = stringBounds(schema);
  const lengthMin = min ?? DEFAULT_STRING_LENGTH;
  const lengthMax = max ?? lengthMin;
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
    (randomSource) => {
      const length = randomInt(randomSource, lengthMin, lengthMax);
      return Array.from({ length }, () => itemArbitrary.generate(randomSource));
    },
    (value) => shrinkArray(value, itemArbitrary)
  );
}

function objectArbitrary(schema: z.ZodObject<Record<string, z.ZodTypeAny>>): Arbitrary<Record<string, unknown>> {
  const shape = schema.shape;
  const mappedShape = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, buildArbitrary(value)])
  ) as Record<string, Arbitrary<unknown> | Gen<unknown>>;
  return gen.object(mappedShape) as Arbitrary<Record<string, unknown>>;
}

function enumArbitrary(schema: z.ZodEnum<[string, ...string[]]>): Arbitrary<string> {
  const options = schema.options;
  return createArbitrary(
    (randomSource) => options[Math.floor(randomSource() * options.length)],
    (value) => (value === options[0] ? [] : [options[0]])
  );
}

function nativeEnumArbitrary(schema: z.ZodNativeEnum<z.EnumLike>): Arbitrary<string | number> {
  const values = Object.values(schema.enum).filter((value) => typeof value === 'string' || typeof value === 'number');
  if (values.length === 0) {
    throw new RangeError('native enum must contain string or number values');
  }
  return createArbitrary(
    (randomSource) => values[Math.floor(randomSource() * values.length)],
    (value) => (Object.is(value, values[0]) ? [] : [values[0]])
  );
}

function unionArbitrary(schema: z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>): Arbitrary<unknown> {
  const options = schema._def.options.map((option: z.ZodTypeAny) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function recordArbitrary(schema: z.ZodRecord<z.ZodTypeAny>): Arbitrary<Record<string, unknown>> {
  const valueArbitrary = buildArbitrary(schema.valueSchema);
  return gen.record(valueArbitrary);
}

function tupleArbitrary(schema: z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>): Arbitrary<unknown[]> {
  const items = schema.items.map((item) => buildArbitrary(item));
  return gen.tuple(...items);
}

function discriminatedUnionArbitrary(schema: z.ZodDiscriminatedUnion<string, z.ZodObject<Record<string, z.ZodTypeAny>>[]>): Arbitrary<unknown> {
  const options = Array.from(schema.options.values()).map((option) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function mapArbitrary(schema: z.ZodMap<z.ZodTypeAny, z.ZodTypeAny>): Arbitrary<Map<unknown, unknown>> {
  const keyArbitrary = buildArbitrary(schema.keySchema);
  const valueArbitrary = buildArbitrary(schema.valueSchema);
  const entryArbitrary = gen.tuple(keyArbitrary, valueArbitrary);
  return gen.map(
    gen.array(entryArbitrary, { minLength: 0, maxLength: 3 }),
    (entries) => new Map(entries as Array<[unknown, unknown]>),
    (map) => Array.from(map.entries()) as Array<[unknown, unknown]>
  );
}

function setArbitrary(schema: z.ZodSet<z.ZodTypeAny>): Arbitrary<Set<unknown>> {
  const valueArbitrary = buildArbitrary(schema._def.valueType);
  return gen.set(valueArbitrary);
}

function literalArbitrary<T>(value: T): Arbitrary<T> {
  return createArbitrary(() => value, () => []);
}

function bigintArbitrary(schema: z.ZodBigInt): Arbitrary<bigint> {
  const { min, max } = bigintBounds(schema);
  return gen.bigint(min ?? 0n, max ?? 100n);
}

function bigintBounds(schema: z.ZodBigInt): { min?: bigint; max?: bigint } {
  return schema._def.checks.reduce<{ min?: bigint; max?: bigint }>((state, check) => {
    if (check.kind === 'min') {
      const bound = check.inclusive ? check.value : check.value + 1n;
      return { ...state, min: bound };
    }
    if (check.kind === 'max') {
      const bound = check.inclusive ? check.value : check.value - 1n;
      return { ...state, max: bound };
    }
    return state;
  }, {});
}

function stringBounds(schema: z.ZodString): { min?: number; max?: number } {
  return schema._def.checks.reduce<{ min?: number; max?: number }>((state, check) => {
    if (check.kind === 'min') {
      return { ...state, min: check.value };
    }
    if (check.kind === 'max') {
      return { ...state, max: check.value };
    }
    if (check.kind === 'length') {
      return { min: check.value, max: check.value };
    }
    return state;
  }, {});
}

function numberBounds(schema: z.ZodNumber): { min?: number; max?: number; integer: boolean } {
  const isInt = schema._def.checks.some((check) => check.kind === 'int');
  return schema._def.checks.reduce<{ min?: number; max?: number; integer: boolean }>((state, check) => {
    if (check.kind === 'min') {
      const bound = check.inclusive ? check.value : isInt ? check.value + 1 : check.value + Number.EPSILON;
      return { ...state, min: bound };
    }
    if (check.kind === 'max') {
      const bound = check.inclusive ? check.value : isInt ? check.value - 1 : check.value - Number.EPSILON;
      return { ...state, max: bound };
    }
    if (check.kind === 'int') {
      return { ...state, integer: true };
    }
    return state;
  }, { integer: false });
}

function arrayBounds(schema: z.ZodArray<z.ZodTypeAny>): { min?: number; max?: number } {
  const constraints = [
    schema._def.exactLength ? { kind: 'exact', value: schema._def.exactLength.value } : undefined,
    schema._def.minLength ? { kind: 'min', value: schema._def.minLength.value } : undefined,
    schema._def.maxLength ? { kind: 'max', value: schema._def.maxLength.value } : undefined
  ].filter((entry): entry is { kind: 'exact' | 'min' | 'max'; value: number } => Boolean(entry));

  return constraints.reduce<{ min?: number; max?: number }>((state, constraint) => {
    if (constraint.kind === 'exact') {
      return { min: constraint.value, max: constraint.value };
    }
    if (constraint.kind === 'min') {
      return { ...state, min: constraint.value };
    }
    if (constraint.kind === 'max') {
      return { ...state, max: constraint.value };
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
