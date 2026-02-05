import { createArbitrary, type Arbitrary, type Gen, type Shrink } from './core.js';
import { randomInt, replaceAt, shrinkLengths, shrinkString } from './shrink-utils.js';

type GenShape = Record<string, Arbitrary<unknown> | Gen<unknown>>;

type InferValue<T> = T extends Arbitrary<infer U>
  ? U
  : T extends Gen<infer V>
    ? V
    : never;

/**
 * Built-in generators.
 */
export const gen = {
  /**
   * Integer generator inclusive of min and max.
   *
   * @example
   * ```ts
   * const integers = gen.int(-5, 5);
   * ```
   */
  int(min = 0, max = 100): Arbitrary<number> {
    assertRange(min, max, 'int');
    return createArbitrary(
      (randomSource) => Math.floor(randomSource() * (max - min + 1)) + min,
      (value) => shrinkInt(value, min, max)
    );
  },
  /**
   * Float generator within [min, max).
   *
   * @example
   * ```ts
   * const floats = gen.float(0, 1);
   * ```
   */
  float(min = 0, max = 1): Arbitrary<number> {
    assertRange(min, max, 'float');
    return createArbitrary(
      (randomSource) => randomSource() * (max - min) + min,
      (value) => shrinkFloat(value, min, max)
    );
  },
  /**
   * Boolean generator.
   *
   * @example
   * ```ts
   * const booleans = gen.bool();
   * ```
   */
  bool(): Arbitrary<boolean> {
    return createArbitrary(
      (randomSource) => randomSource() >= 0.5,
      (value) => (value ? [false] : [])
    );
  },
  /**
   * Constant generator that always yields the same value.
   *
   * @example
   * ```ts
   * const alwaysFive = gen.constant(5);
   * ```
   */
  constant<T>(value: T): Arbitrary<T> {
    return createArbitrary(() => value, () => []);
  },
  /**
   * Choose a value from a fixed list of constants.
   *
   * @example
   * ```ts
   * const status = gen.constantFrom('open', 'closed');
   * ```
   */
  constantFrom<T>(...values: T[]): Arbitrary<T> {
    if (values.length === 0) {
      throw new RangeError('constantFrom requires at least one value');
    }
    return createArbitrary(
      (randomSource) => values[Math.floor(randomSource() * values.length)],
      (value) => (Object.is(value, values[0]) ? [] : [values[0]])
    );
  },
  /**
   * Generate a record with string keys and arbitrary values.
   *
   * @example
   * ```ts
   * const recordGen = gen.record(gen.int(1, 10), { minKeys: 1, maxKeys: 3 });
   * ```
   */
  record<T>(valueArbitrary: Arbitrary<T> | Gen<T>, options: { minKeys?: number; maxKeys?: number } = {}): Arbitrary<Record<string, T>> {
    const minKeys = options.minKeys ?? 0;
    const maxKeys = options.maxKeys ?? Math.max(minKeys, 3);
    if (!Number.isInteger(minKeys) || minKeys < 0) {
      throw new RangeError('minKeys must be a non-negative integer');
    }
    if (!Number.isInteger(maxKeys) || maxKeys < minKeys) {
      throw new RangeError('maxKeys must be an integer >= minKeys');
    }
    const arbitrary = toArbitrary(valueArbitrary);
    return createArbitrary(
      (randomSource) => {
        const keyCount = randomInt(randomSource, minKeys, maxKeys);
        return Array.from({ length: keyCount }, (_, index) => randomKey(randomSource, index))
          .reduce<Record<string, T>>((record, key) => {
            record[key] = arbitrary.generate(randomSource);
            return record;
          }, {});
      },
      (value) => shrinkRecord(value, arbitrary)
    );
  },
  /**
   * Generate a dictionary from a key arbitrary and a value arbitrary.
   *
   * @example
   * ```ts
   * const dictGen = gen.dictionary(gen.string(3), gen.bool(), { minKeys: 2, maxKeys: 5 });
   * ```
   */
  dictionary<V>(
    keyArbitrary: Arbitrary<string> | Gen<string>,
    valueArbitrary: Arbitrary<V> | Gen<V>,
    options: { minKeys?: number; maxKeys?: number } = {}
  ): Arbitrary<Record<string, V>> {
    const minKeys = options.minKeys ?? 0;
    const maxKeys = options.maxKeys ?? Math.max(minKeys, 3);
    if (!Number.isInteger(minKeys) || minKeys < 0) {
      throw new RangeError('minKeys must be a non-negative integer');
    }
    if (!Number.isInteger(maxKeys) || maxKeys < minKeys) {
      throw new RangeError('maxKeys must be an integer >= minKeys');
    }
    const keyGenerator = toArbitrary(keyArbitrary);
    const valueGenerator = toArbitrary(valueArbitrary);
    return createArbitrary(
      (randomSource) => {
        const availableKeys = buildUniqueKeys(keyGenerator, randomSource, maxKeys);
        if (availableKeys.length < minKeys) {
          throw new RangeError('dictionary could not satisfy minKeys with unique keys');
        }
        const desiredKeyCount = randomInt(randomSource, minKeys, Math.min(maxKeys, availableKeys.length));
        const selectedKeys = availableKeys.slice(0, desiredKeyCount);
        const entries = selectedKeys.map((key) => [key, valueGenerator.generate(randomSource)] as const);
        return Object.fromEntries(entries) as Record<string, V>;
      },
      (value) => shrinkDictionary(value, keyGenerator, valueGenerator)
    );
  },
  /**
   * Generate a set (unique values) using an arbitrary.
   *
   * @example
   * ```ts
   * const setGen = gen.set(gen.int(1, 10), { minSize: 2, maxSize: 4 });
   * ```
   */
  set<T>(
    valueArbitrary: Arbitrary<T> | Gen<T>,
    options: { minSize?: number; maxSize?: number } = {}
  ): Arbitrary<Set<T>> {
    const minSize = options.minSize ?? 0;
    const maxSize = options.maxSize ?? Math.max(minSize, 3);
    if (!Number.isInteger(minSize) || minSize < 0) {
      throw new RangeError('minSize must be a non-negative integer');
    }
    if (!Number.isInteger(maxSize) || maxSize < minSize) {
      throw new RangeError('maxSize must be an integer >= minSize');
    }
    const valueGenerator = toArbitrary(valueArbitrary);
    return createArbitrary(
      (randomSource) => {
        const targetSize = randomInt(randomSource, minSize, maxSize);
        const values = buildUniqueValues(valueGenerator, randomSource, targetSize);
        if (values.length < minSize) {
          throw new RangeError('set could not satisfy minSize with unique values');
        }
        return new Set(values.slice(0, targetSize));
      },
      (value) => shrinkSet(value, valueGenerator)
    );
  },
  /**
   * Generate an array with unique values using an arbitrary.
   *
   * @example
   * ```ts
   * const uniqueGen = gen.uniqueArray(gen.int(1, 10), { minLength: 2, maxLength: 4 });
   * ```
   */
  uniqueArray<T>(
    valueArbitrary: Arbitrary<T> | Gen<T>,
    options: { minLength?: number; maxLength?: number } = {}
  ): Arbitrary<T[]> {
    const minLength = options.minLength ?? 0;
    const maxLength = options.maxLength ?? Math.max(minLength, 3);
    if (!Number.isInteger(minLength) || minLength < 0) {
      throw new RangeError('minLength must be a non-negative integer');
    }
    if (!Number.isInteger(maxLength) || maxLength < minLength) {
      throw new RangeError('maxLength must be an integer >= minLength');
    }
    const valueGenerator = toArbitrary(valueArbitrary);
    return createArbitrary(
      (randomSource) => {
        const targetLength = randomInt(randomSource, minLength, maxLength);
        const values = buildUniqueValues(valueGenerator, randomSource, targetLength);
        if (values.length < minLength) {
          throw new RangeError('uniqueArray could not satisfy minLength with unique values');
        }
        return values.slice(0, targetLength);
      },
      (value) => shrinkUniqueArray(value, valueGenerator)
    );
  },
  /**
   * Lowercase alphanumeric string of a fixed length.
   *
   * @example
   * ```ts
   * const ids = gen.string(8);
   * ```
   */
  string(length = 8): Arbitrary<string> {
    assertLength(length, 'string length');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return createArbitrary(
      (randomSource) => Array.from({ length }, () => chars[Math.floor(randomSource() * chars.length)]).join(''),
      (value) => shrinkString(value)
    );
  },
  /**
   * Generate a UUID v4 string.
   *
   * @example
   * ```ts
   * const ids = gen.uuid();
   * ```
   */
  uuid(): Arbitrary<string> {
    const hex = '0123456789abcdef';
    return createArbitrary(
      (randomSource) => {
        const parts = [8, 4, 4, 4, 12].map((segmentLength, index) => {
          if (index === 2) {
            return `4${Array.from({ length: segmentLength - 1 }, () => hex[Math.floor(randomSource() * hex.length)]).join('')}`;
          }
          if (index === 3) {
            const first = (8 + Math.floor(randomSource() * 4)).toString(16);
            return `${first}${Array.from({ length: segmentLength - 1 }, () => hex[Math.floor(randomSource() * hex.length)]).join('')}`;
          }
          return Array.from({ length: segmentLength }, () => hex[Math.floor(randomSource() * hex.length)]).join('');
        });
        return parts.join('-');
      },
      (value) => shrinkUuid(value)
    );
  },
  /**
   * Generate a basic email address.
   *
   * @example
   * ```ts
   * const emails = gen.email();
   * ```
   */
  email(): Arbitrary<string> {
    const localChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const domainChars = 'abcdefghijklmnopqrstuvwxyz';
    return createArbitrary(
      (randomSource) => {
        const local = Array.from({ length: 8 }, () => localChars[Math.floor(randomSource() * localChars.length)]).join('');
        const domain = Array.from({ length: 6 }, () => domainChars[Math.floor(randomSource() * domainChars.length)]).join('');
        return `${local}@${domain}.com`;
      },
      (value) => shrinkEmail(value)
    );
  },
  /**
   * Generate a Date within a range (inclusive).
   *
   * @example
   * ```ts
   * const dates = gen.date(new Date('2020-01-01'), new Date('2020-12-31'));
   * ```
   */
  date(min: Date = new Date(0), max: Date = new Date('2099-12-31T23:59:59.999Z')): Arbitrary<Date> {
    const minTime = min.getTime();
    const maxTime = max.getTime();
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
      throw new RangeError('date bounds must be valid dates');
    }
    if (minTime > maxTime) {
      throw new RangeError('date bounds must have min <= max');
    }
    return createArbitrary(
      (randomSource) => {
        const range = maxTime - minTime;
        const offset = Math.floor(randomSource() * (range + 1));
        return new Date(minTime + offset);
      },
      (value) => shrinkDate(value, min, max)
    );
  },
  /**
   * Fixed-length array generator.
   *
   * @example
   * ```ts
   * const items = gen.array(gen.int(1, 3), 5);
   * ```
   */
  array<T>(item: Arbitrary<T> | Gen<T>, length = 5): Arbitrary<T[]> {
    assertLength(length, 'array length');
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (randomSource) => Array.from({ length }, () => arbitrary.generate(randomSource)),
      (value) => shrinkArray(value, arbitrary.shrink)
    );
  },
  /**
   * Object generator from a generator shape map.
   *
   * @example
   * ```ts
   * const user = gen.object({ id: gen.int(1, 10), name: gen.string(5) });
   * ```
   */
  object<T extends GenShape>(shape: T): Arbitrary<{ [K in keyof T]: InferValue<T[K]> }> {
    return createArbitrary(
      (randomSource) => Object.fromEntries(
        Object.keys(shape).map((key) => [key, toArbitrary(shape[key]).generate(randomSource)])
      ) as { [K in keyof T]: InferValue<T[K]> },
      (value) => shrinkObject(value, shape)
    );
  },
  /**
   * Pick one of the provided arbitraries at random.
   *
   * @example
   * ```ts
   * const value = gen.oneOf(gen.int(1, 1), gen.int(2, 2));
   * ```
   */
  oneOf<T>(...options: Array<Arbitrary<T> | Gen<T>>): Arbitrary<T> {
    if (options.length === 0) {
      throw new RangeError('oneOf requires at least one option');
    }
    const arbitraries = options.map((option) => toArbitrary(option));
    return createArbitrary(
      (randomSource) => {
        const index = Math.floor(randomSource() * arbitraries.length);
        return arbitraries[index].generate(randomSource);
      },
      (value) => shrinkOneOf(value, arbitraries)
    );
  },
  /**
   * Pick one of the provided arbitraries using weights.
   *
   * @example
   * ```ts
   * const value = gen.weightedOneOf([
   *   { weight: 1, arbitrary: gen.constant('a') },
   *   { weight: 3, arbitrary: gen.constant('b') }
   * ]);
   * ```
   */
  weightedOneOf<T>(options: Array<{ weight: number; arbitrary: Arbitrary<T> | Gen<T> }>): Arbitrary<T> {
    if (options.length === 0) {
      throw new RangeError('weightedOneOf requires at least one option');
    }
    const normalized = options.map((option) => ({
      weight: option.weight,
      arbitrary: toArbitrary(option.arbitrary)
    }));
    const totalWeight = normalized.reduce((sum, entry) => sum + entry.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      throw new RangeError('weightedOneOf requires a positive total weight');
    }
    if (normalized.some((entry) => !Number.isFinite(entry.weight) || entry.weight <= 0)) {
      throw new RangeError('weightedOneOf requires positive weights');
    }
    return createArbitrary(
      (randomSource) => {
        const target = randomSource() * totalWeight;
        const selection = normalized.reduce<{ accumulated: number; chosen?: Arbitrary<T> }>((state, entry) => {
          if (state.chosen) {
            return state;
          }
          const accumulated = state.accumulated + entry.weight;
          const chosen = target <= accumulated ? entry.arbitrary : undefined;
          return { accumulated, chosen };
        }, { accumulated: 0, chosen: undefined });
        const selected = selection.chosen ?? normalized[normalized.length - 1].arbitrary;
        return selected.generate(randomSource);
      },
      (value) => shrinkOneOf(value, normalized.map((entry) => entry.arbitrary))
    );
  },
  /**
   * Alias for weightedOneOf to mirror common property-testing APIs.
   *
   * @example
   * ```ts
   * const value = gen.frequency([
   *   { weight: 1, arbitrary: gen.constant('a') },
   *   { weight: 3, arbitrary: gen.constant('b') }
   * ]);
   * ```
   */
  frequency<T>(options: Array<{ weight: number; arbitrary: Arbitrary<T> | Gen<T> }>): Arbitrary<T> {
    return gen.weightedOneOf(options);
  },
  /**
   * Generate a tuple with a fixed length of heterogeneous arbitraries.
   *
   * @example
   * ```ts
   * const tupleGen = gen.tuple(gen.int(1, 1), gen.string(3), gen.bool());
   * ```
   */
  tuple<T extends Array<Arbitrary<unknown> | Gen<unknown>>>(...items: T): Arbitrary<{ [K in keyof T]: InferValue<T[K]> }> {
    const arbitraries = items.map((item) => toArbitrary(item));
    return createArbitrary(
      (randomSource) => arbitraries.map((arbitrary) => arbitrary.generate(randomSource)) as { [K in keyof T]: InferValue<T[K]> },
      (value) => shrinkTuple(value, arbitraries)
    );
  },
  /**
   * Generate an optional value. Undefined is used for absence.
   *
   * @example
   * ```ts
   * const optionalValue = gen.optional(gen.int(1, 2), 0.3);
   * ```
   */
  optional<T>(item: Arbitrary<T> | Gen<T>, undefinedProbability = 0.5): Arbitrary<T | undefined> {
    if (!Number.isFinite(undefinedProbability) || undefinedProbability < 0 || undefinedProbability > 1) {
      throw new RangeError('undefinedProbability must be between 0 and 1');
    }
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (randomSource) => (randomSource() < undefinedProbability ? undefined : arbitrary.generate(randomSource)),
      (value) => (value === undefined ? [] : [undefined, ...arbitrary.shrink(value)])
    );
  },
  /**
   * Transform an arbitrary by mapping its generated values.
   *
   * @example
   * ```ts
   * const mapped = gen.map(gen.int(1, 2), (value) => `id:${value}`);
   * ```
   */
  map<T, U>(item: Arbitrary<T> | Gen<T>, mapper: (value: T) => U, unmap?: (value: U) => T | undefined): Arbitrary<U> {
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (randomSource) => mapper(arbitrary.generate(randomSource)),
      (value) => shrinkMapped(value, arbitrary, mapper, unmap)
    );
  },
  /**
   * Filter an arbitrary by a predicate, with retry protection.
   *
   * @example
   * ```ts
   * const even = gen.filter(gen.int(1, 10), (value) => value % 2 === 0);
   * ```
   */
  filter<T>(item: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean, maxAttempts = 100): Arbitrary<T> {
    if (!Number.isFinite(maxAttempts) || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new RangeError('maxAttempts must be a positive integer');
    }
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (randomSource) => generateFilteredValue(arbitrary, predicate, randomSource, maxAttempts),
      (value) => shrinkFiltered(value, arbitrary, predicate)
    );
  }
};

function assertRange(min: number, max: number, label: string): void {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError(`${label} range must be finite numbers`);
  }
  if (min > max) {
    throw new RangeError(`${label} range must have min <= max`);
  }
}

function assertLength(length: number, label: string): void {
  if (!Number.isFinite(length) || !Number.isInteger(length) || length < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

function toArbitrary<T>(input: Arbitrary<T> | Gen<T>): Arbitrary<T> {
  if (typeof input === 'function') {
    return createArbitrary(input, () => []);
  }
  return input;
}

function* shrinkInt(value: number, min: number, max: number): Iterable<number> {
  if (value < min || value > max) {
    return;
  }
  const target = 0 >= min && 0 <= max ? 0 : min;
  let current = value;
  while (current !== target) {
    current = current > target
      ? Math.floor((current + target) / 2)
      : Math.ceil((current + target) / 2);
    if (current < min || current > max) {
      break;
    }
    yield current;
  }
}

function* shrinkFloat(value: number, min: number, max: number): Iterable<number> {
  if (value < min || value > max) {
    return;
  }
  const target = 0 >= min && 0 <= max ? 0 : min;
  let current = value;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const next = (current + target) / 2;
    if (next === current) {
      break;
    }
    current = next;
    if (current < min || current > max) {
      break;
    }
    yield current;
  }
}

function* shrinkUuid(value: string): Iterable<string> {
  const segments = value.split('-');
  if (segments.length !== 5) {
    return;
  }
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const zeroed = i === 2
      ? '4' + '0'.repeat(segment.length - 1)
      : i === 3
        ? '8' + '0'.repeat(segment.length - 1)
        : '0'.repeat(segment.length);
    if (segment !== zeroed) {
      const shrunk = segments.slice();
      shrunk[i] = zeroed;
      yield shrunk.join('-');
    }
  }
}

function* shrinkEmail(value: string): Iterable<string> {
  const atIndex = value.indexOf('@');
  if (atIndex === -1) {
    return;
  }
  const local = value.slice(0, atIndex);
  const domainPart = value.slice(atIndex + 1);
  const dotIndex = domainPart.lastIndexOf('.');
  if (dotIndex === -1) {
    return;
  }
  const domain = domainPart.slice(0, dotIndex);
  const tld = domainPart.slice(dotIndex + 1);
  if (local.length > 1) {
    yield `${local.slice(0, Math.ceil(local.length / 2))}@${domain}.${tld}`;
  }
  if (domain.length > 1) {
    yield `${local}@${domain.slice(0, Math.ceil(domain.length / 2))}.${tld}`;
  }
  if (local !== 'a') {
    yield `a@${domain}.${tld}`;
  }
  if (domain !== 'a') {
    yield `${local}@a.${tld}`;
  }
}

function* shrinkArray<T>(value: T[], shrinkItem: Shrink<T>): Iterable<T[]> {
  if (value.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(value.length);
  for (const prefixLength of prefixLengths) {
    yield value.slice(0, prefixLength);
  }
  const shrinkCandidates = value.flatMap((item, index) =>
    Array.from(shrinkItem(item)).map((shrunk) => replaceAt(value, index, shrunk))
  );
  yield* shrinkCandidates;
}

function* shrinkObject<T extends GenShape>(
  value: { [K in keyof T]: InferValue<T[K]> },
  shape: T
): Iterable<{ [K in keyof T]: InferValue<T[K]> }> {
  const shrinkCandidates = Object.keys(shape).flatMap((key) => {
    const typedKey = key as keyof T;
    const arbitrary = toArbitrary(shape[typedKey]);
    return Array.from(arbitrary.shrink(value[typedKey]))
      .map((shrunk) => ({ ...value, [typedKey]: shrunk as InferValue<T[keyof T]> }));
  });
  yield* shrinkCandidates;
}

function* shrinkOneOf<T>(value: T, arbitraries: Array<Arbitrary<T>>): Iterable<T> {
  const shrinkCandidates = arbitraries.flatMap((arbitrary) => Array.from(arbitrary.shrink(value)));
  yield* shrinkCandidates;
}

function* shrinkTuple<T extends unknown[]>(value: T, arbitraries: Array<Arbitrary<unknown>>): Iterable<T> {
  const shrinkCandidates = value.flatMap((current, index) =>
    Array.from(arbitraries[index].shrink(current))
      .map((shrunk) => replaceAt(value, index, shrunk) as T)
  );
  yield* shrinkCandidates;
}

function* shrinkRecord<T>(value: Record<string, T>, arbitrary: Arbitrary<T>): Iterable<Record<string, T>> {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(entries.length);
  const prefixCandidates = prefixLengths.map((prefixLength) => Object.fromEntries(entries.slice(0, prefixLength)));
  const valueCandidates = entries.flatMap(([key, entryValue]) =>
    Array.from(arbitrary.shrink(entryValue)).map((shrunk) => ({ ...value, [key]: shrunk }))
  );
  yield* prefixCandidates;
  yield* valueCandidates;
}

function* shrinkDictionary<V>(
  value: Record<string, V>,
  keyGenerator: Arbitrary<string>,
  valueGenerator: Arbitrary<V>
): Iterable<Record<string, V>> {
  const entries = Object.entries(value) as Array<[string, V]>;
  if (entries.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(entries.length);
  const prefixCandidates = prefixLengths.map((prefixLength) =>
    Object.fromEntries(entries.slice(0, prefixLength)) as Record<string, V>
  );
  const valueCandidates = entries.flatMap(([key, entryValue]) =>
    Array.from(valueGenerator.shrink(entryValue)).map((shrunk) => ({ ...value, [key]: shrunk }))
  );
  const keyCandidates = entries.flatMap(([key, entryValue]) =>
    Array.from(keyGenerator.shrink(key)).map((shrunkKey) => {
      const record = { ...value } as Record<string, V>;
      delete record[key];
      record[shrunkKey] = entryValue;
      return record;
    })
  );
  yield* prefixCandidates;
  yield* valueCandidates;
  yield* keyCandidates;
}

function* shrinkSet<T>(value: Set<T>, valueGenerator: Arbitrary<T>): Iterable<Set<T>> {
  const entries = Array.from(value.values());
  if (entries.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(entries.length);
  const prefixCandidates = prefixLengths.map((prefixLength) => new Set(entries.slice(0, prefixLength)));
  const valueCandidates = entries.flatMap((entryValue, index) =>
    Array.from(valueGenerator.shrink(entryValue)).map((shrunk) => {
      const next = entries.slice();
      next[index] = shrunk;
      return new Set(next);
    })
  );
  yield* prefixCandidates;
  yield* valueCandidates;
}

function* shrinkUniqueArray<T>(value: T[], valueGenerator: Arbitrary<T>): Iterable<T[]> {
  if (value.length === 0) {
    return;
  }
  const prefixLengths = shrinkLengths(value.length);
  const prefixCandidates = prefixLengths.map((prefixLength) => value.slice(0, prefixLength));
  const valueCandidates = value.flatMap((entryValue, index) =>
    Array.from(valueGenerator.shrink(entryValue))
      .filter((shrunk) => !value.includes(shrunk))
      .map((shrunk) => replaceAt(value, index, shrunk))
  );
  yield* prefixCandidates;
  yield* valueCandidates;
}

function* shrinkDate(value: Date, min: Date, max: Date): Iterable<Date> {
  const valueTime = value.getTime();
  const minTime = min.getTime();
  const maxTime = max.getTime();
  if (!Number.isFinite(valueTime) || !Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
    return;
  }
  const target = 0 >= minTime && 0 <= maxTime ? 0 : minTime;
  let current = valueTime;
  const steps = Array.from({ length: 32 }, (_, index) => index);
  for (const _ of steps) {
    const next = Math.floor((current + target) / 2);
    if (next === current) {
      return;
    }
    current = next;
    if (current < minTime || current > maxTime) {
      return;
    }
    yield new Date(current);
  }
}

function randomKey(randomSource: () => number, index: number): string {
  return `key_${index}_${Math.floor(randomSource() * 1_000_000)}`;
}

function buildUniqueKeys(
  keyGenerator: Arbitrary<string>,
  randomSource: () => number,
  desiredCount: number
): string[] {
  const attemptsPerKey = 20;
  const totalAttempts = desiredCount * attemptsPerKey;
  const result: string[] = [];
  for (let i = 0; i < totalAttempts && result.length < desiredCount; i++) {
    const key = keyGenerator.generate(randomSource);
    if (!result.includes(key)) {
      result.push(key);
    }
  }
  return result;
}

function buildUniqueValues<T>(
  valueGenerator: Arbitrary<T>,
  randomSource: () => number,
  desiredCount: number
): T[] {
  const attemptsPerValue = 20;
  const totalAttempts = desiredCount * attemptsPerValue;
  const result: T[] = [];
  for (let i = 0; i < totalAttempts && result.length < desiredCount; i++) {
    const value = valueGenerator.generate(randomSource);
    if (!result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

function* shrinkMapped<T, U>(
  value: U,
  arbitrary: Arbitrary<T>,
  mapper: (value: T) => U,
  unmap?: (value: U) => T | undefined
): Iterable<U> {
  if (!unmap) {
    return;
  }
  const original = unmap(value);
  if (original === undefined) {
    return;
  }
  for (const shrunk of arbitrary.shrink(original)) {
    yield mapper(shrunk);
  }
}

function generateFilteredValue<T>(arbitrary: Arbitrary<T>, predicate: (value: T) => boolean, randomSource: () => number, maxAttempts: number): T {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = arbitrary.generate(randomSource);
    if (predicate(candidate)) {
      return candidate;
    }
  }
  throw new RangeError('filter predicate rejected all generated values');
}

function* shrinkFiltered<T>(value: T, arbitrary: Arbitrary<T>, predicate: (value: T) => boolean): Iterable<T> {
  const shrinkCandidates = Array.from(arbitrary.shrink(value))
    .filter(predicate);
  yield* shrinkCandidates;
}

