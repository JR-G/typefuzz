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

/**
 * Zod 4 has two type hierarchies: `$ZodType` (core) and `ZodType` (classic).
 * Inner schemas returned by `.unwrap()`, `.element`, `.keyType`, etc. are
 * `$ZodType` which TypeScript rejects as `ZodType`. Both refer to the same
 * runtime objects, so the cast is safe.
 */
function toZodType(schema: unknown): z.ZodTypeAny {
  return schema as z.ZodTypeAny;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildArbitrary(schema: z.ZodTypeAny): Arbitrary<any> {
  if (schema instanceof z.ZodString) return stringArbitrary(schema);
  if (schema instanceof z.ZodNumber) return numberArbitrary(schema);
  if (schema instanceof z.ZodBoolean) return gen.bool();
  if (schema instanceof z.ZodBigInt) return bigintArbitrary(schema);
  if (schema instanceof z.ZodDate) return gen.date();
  if (schema instanceof z.ZodArray) return arrayArbitrary(schema);
  if (schema instanceof z.ZodObject) return objectArbitrary(schema);
  if (schema instanceof z.ZodRecord) return recordArbitrary(schema);
  if (schema instanceof z.ZodTuple) return tupleArbitrary(schema);
  if (schema instanceof z.ZodMap) return mapArbitrary(schema);
  if (schema instanceof z.ZodSet) return setArbitrary(schema);
  if (schema instanceof z.ZodEnum) return enumArbitrary(schema);
  if (schema instanceof z.ZodUnion) return unionArbitrary(schema);
  if (schema instanceof z.ZodDiscriminatedUnion) return discriminatedUnionArbitrary(schema);
  if (schema instanceof z.ZodLiteral) return literalArbitrary(schema.value);
  if (schema instanceof z.ZodOptional) return gen.optional(buildArbitrary(toZodType(schema.unwrap())));
  if (schema instanceof z.ZodNullable) return gen.oneOf(literalArbitrary(null), buildArbitrary(toZodType(schema.unwrap())));
  if (schema instanceof z.ZodDefault) return buildArbitrary(toZodType(schema.unwrap()));
  if (schema instanceof z.ZodLazy) return lazyArbitrary(schema);
  if (schema instanceof z.ZodPipe) return buildArbitrary(toZodType(schema.in));
  if (schema instanceof z.ZodUndefined || schema instanceof z.ZodVoid) return literalArbitrary(undefined);
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) return anyArbitrary();

  const type = defOf(schema).type ?? 'unknown';
  throw new TypeError(`Unsupported Zod schema type: ${type}`);
}

function defOf(schema: z.ZodTypeAny): Record<string, unknown> {
  return (schema as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
}

function checksOf(schema: z.ZodTypeAny): Array<Record<string, unknown>> {
  const def = defOf(schema);
  return ((def.checks ?? []) as Array<{ _zod: { def: Record<string, unknown> } }>).map((c) => c._zod.def);
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
  const integer = schema.isInt;
  const { min, max } = numericBounds(schema, integer);
  const defaultRange = integer ? DEFAULT_INT_RANGE : DEFAULT_FLOAT_RANGE;
  const rangeMin = (min as number | undefined) ?? Math.min(defaultRange.min, (max as number | undefined) ?? defaultRange.min);
  const rangeMax = (max as number | undefined) ?? Math.max(defaultRange.max, rangeMin);
  return integer ? gen.int(rangeMin, rangeMax) : gen.float(rangeMin, rangeMax);
}

function bigintArbitrary(schema: z.ZodBigInt): Arbitrary<bigint> {
  const { min, max } = numericBounds(schema, true);
  const lo = min as bigint | undefined;
  const hi = max as bigint | undefined;
  const rangeMin = lo ?? (hi !== undefined && hi < 0n ? hi : 0n);
  const rangeMax = hi ?? (lo !== undefined && lo > 100n ? lo + 100n : 100n);
  return gen.bigint(rangeMin, rangeMax);
}

function numericBounds(schema: z.ZodTypeAny, integer: boolean): { min?: number | bigint; max?: number | bigint } {
  let min: number | bigint | undefined;
  let max: number | bigint | undefined;
  for (const check of checksOf(schema)) {
    if (check.check === 'greater_than') {
      const value = check.value as number | bigint;
      const inclusive = check.inclusive as boolean;
      min = inclusive ? value : adjust(value, integer, 1);
    }
    if (check.check === 'less_than') {
      const value = check.value as number | bigint;
      const inclusive = check.inclusive as boolean;
      max = inclusive ? value : adjust(value, integer, -1);
    }
  }
  return { min, max };
}

function adjust(value: number | bigint, integer: boolean, direction: 1 | -1): number | bigint {
  if (typeof value === 'bigint') return value + BigInt(direction);
  if (integer) return value + direction;
  const step = Math.max(Math.abs(value as number) * Number.EPSILON, Number.MIN_VALUE);
  return (value as number) + direction * step;
}

function arrayArbitrary(schema: z.ZodArray): Arbitrary<unknown[]> {
  const { min, max } = arrayBounds(schema);
  const lengthMin = min ?? Math.min(DEFAULT_ARRAY_LENGTH, max ?? DEFAULT_ARRAY_LENGTH);
  const lengthMax = max ?? Math.max(lengthMin, DEFAULT_ARRAY_LENGTH);
  const itemArbitrary = buildArbitrary(toZodType(schema.element));

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

function arrayBounds(schema: z.ZodArray): { min?: number; max?: number } {
  let min: number | undefined;
  let max: number | undefined;
  for (const check of checksOf(schema)) {
    if (check.check === 'min_length') min = check.minimum as number;
    if (check.check === 'max_length') max = check.maximum as number;
    if (check.check === 'length_equals') { min = check.expected as number; max = min; }
  }
  return { min, max };
}

function objectArbitrary(schema: z.ZodObject): Arbitrary<Record<string, unknown>> {
  const shape = schema.shape;
  const mappedShape = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, buildArbitrary(toZodType(value))])
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

function discriminatedUnionArbitrary(schema: z.ZodDiscriminatedUnion): Arbitrary<unknown> {
  const options = (schema.options as z.ZodTypeAny[]).map((option) => buildArbitrary(option));
  return gen.oneOf(...options);
}

function recordArbitrary(schema: z.ZodRecord): Arbitrary<Record<string, unknown>> {
  return gen.record(buildArbitrary(toZodType(defOf(schema).valueType)));
}

function tupleArbitrary(schema: z.ZodTuple): Arbitrary<unknown[]> {
  const items = (defOf(schema).items as z.ZodTypeAny[]).map((item) => buildArbitrary(toZodType(item)));
  return gen.tuple(...items);
}

function mapArbitrary(schema: z.ZodMap): Arbitrary<Map<unknown, unknown>> {
  const keyArbitrary = buildArbitrary(toZodType(defOf(schema).keyType));
  const valueArbitrary = buildArbitrary(toZodType(defOf(schema).valueType));
  const entryArbitrary = gen.tuple(keyArbitrary, valueArbitrary);
  return gen.map(
    gen.array(entryArbitrary, { minLength: 0, maxLength: 3 }),
    (entries) => new Map(entries as Array<[unknown, unknown]>),
    (map) => Array.from(map.entries()) as Array<[unknown, unknown]>
  );
}

function setArbitrary(schema: z.ZodSet): Arbitrary<Set<unknown>> {
  return gen.set(buildArbitrary(toZodType(defOf(schema).valueType)));
}

function lazyArbitrary(schema: z.ZodLazy): Arbitrary<unknown> {
  return createArbitrary(
    (randomSource) => buildArbitrary(toZodType(schema.unwrap())).generate(randomSource),
    (value) => buildArbitrary(toZodType(schema.unwrap())).shrink(value)
  );
}

function anyArbitrary(): Arbitrary<unknown> {
  return gen.oneOf(
    gen.int() as Arbitrary<unknown>,
    gen.string() as Arbitrary<unknown>,
    gen.bool() as Arbitrary<unknown>,
    literalArbitrary(null) as Arbitrary<unknown>
  );
}

function literalArbitrary<T>(value: T): Arbitrary<T> {
  return createArbitrary(() => value, () => []);
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
