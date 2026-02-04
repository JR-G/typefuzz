import { createArbitrary, type Arbitrary, type Gen, type Shrink } from './core.js';

type GenShape = Record<string, Arbitrary<unknown> | Gen<unknown>>;

/**
 * Built-in generators.
 */
export const gen = {
  /**
   * Integer generator inclusive of min and max.
   */
  int(min = 0, max = 100): Arbitrary<number> {
    assertRange(min, max, 'int');
    return createArbitrary(
      (rng) => Math.floor(rng() * (max - min + 1)) + min,
      (value) => shrinkInt(value, min, max)
    );
  },
  /**
   * Float generator within [min, max).
   */
  float(min = 0, max = 1): Arbitrary<number> {
    assertRange(min, max, 'float');
    return createArbitrary(
      (rng) => rng() * (max - min) + min,
      (value) => shrinkFloat(value, min, max)
    );
  },
  /**
   * Boolean generator.
   */
  bool(): Arbitrary<boolean> {
    return createArbitrary(
      (rng) => rng() >= 0.5,
      (value) => (value ? [false] : [])
    );
  },
  /**
   * Lowercase alphanumeric string of a fixed length.
   */
  string(length = 8): Arbitrary<string> {
    assertLength(length, 'string length');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return createArbitrary(
      (rng) => {
        let out = '';
        for (let index = 0; index < length; index += 1) {
          out += chars[Math.floor(rng() * chars.length)];
        }
        return out;
      },
      (value) => shrinkString(value)
    );
  },
  /**
   * Fixed-length array generator.
   */
  array<T>(item: Arbitrary<T> | Gen<T>, length = 5): Arbitrary<T[]> {
    assertLength(length, 'array length');
    const arb = toArbitrary(item);
    return createArbitrary(
      (rng) => Array.from({ length }, () => arb.generate(rng)),
      (value) => shrinkArray(value, arb.shrink)
    );
  },
  /**
   * Object generator from a generator shape map.
   */
  object<T extends GenShape>(shape: T): Arbitrary<{ [K in keyof T]: ReturnType<T[K]> }> {
    return createArbitrary(
      (rng) => {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(shape)) {
          out[key] = toArbitrary(shape[key]).generate(rng);
        }
        return out as { [K in keyof T]: ReturnType<T[K]> };
      },
      (value) => shrinkObject(value, shape)
    );
  },
  /**
   * Pick one of the provided arbitraries at random.
   */
  oneOf<T>(...options: Array<Arbitrary<T> | Gen<T>>): Arbitrary<T> {
    if (options.length === 0) {
      throw new RangeError('oneOf requires at least one option');
    }
    const arbitraries = options.map((option) => toArbitrary(option));
    return createArbitrary(
      (rng) => {
        const index = Math.floor(rng() * arbitraries.length);
        return arbitraries[index].generate(rng);
      },
      (value) => shrinkOneOf(value, arbitraries)
    );
  },
  /**
   * Generate a tuple with a fixed length of heterogeneous arbitraries.
   */
  tuple<T extends Array<Arbitrary<unknown> | Gen<unknown>>>(...items: T): Arbitrary<{
    [K in keyof T]: T[K] extends Arbitrary<infer U>
      ? U
      : T[K] extends Gen<infer V>
        ? V
        : never
  }> {
    const arbitraries = items.map((item) => toArbitrary(item));
    return createArbitrary(
      (rng) => arbitraries.map((arb) => arb.generate(rng)) as {
        [K in keyof T]: T[K] extends Arbitrary<infer U>
          ? U
          : T[K] extends Gen<infer V>
            ? V
            : never
      },
      (value) => shrinkTuple(value, arbitraries)
    );
  },
  /**
   * Generate an optional value. Undefined is used for absence.
   */
  optional<T>(item: Arbitrary<T> | Gen<T>, undefinedProbability = 0.5): Arbitrary<T | undefined> {
    if (!Number.isFinite(undefinedProbability) || undefinedProbability < 0 || undefinedProbability > 1) {
      throw new RangeError('undefinedProbability must be between 0 and 1');
    }
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (rng) => (rng() < undefinedProbability ? undefined : arbitrary.generate(rng)),
      (value) => (value === undefined ? [] : [undefined, ...arbitrary.shrink(value)])
    );
  },
  /**
   * Transform an arbitrary by mapping its generated values.
   */
  map<T, U>(item: Arbitrary<T> | Gen<T>, mapper: (value: T) => U, unmap?: (value: U) => T | undefined): Arbitrary<U> {
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (rng) => mapper(arbitrary.generate(rng)),
      (value) => shrinkMapped(value, arbitrary, mapper, unmap)
    );
  },
  /**
   * Filter an arbitrary by a predicate, with retry protection.
   */
  filter<T>(item: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean, maxAttempts = 100): Arbitrary<T> {
    if (!Number.isFinite(maxAttempts) || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new RangeError('maxAttempts must be a positive integer');
    }
    const arbitrary = toArbitrary(item);
    return createArbitrary(
      (rng) => generateFilteredValue(arbitrary, predicate, rng, maxAttempts),
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

function* shrinkArray<T>(value: T[], shrinkItem: Shrink<T>): Iterable<T[]> {
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
    for (const shrunk of shrinkItem(value[index])) {
      const next = value.slice();
      next[index] = shrunk;
      yield next;
    }
  }
}

function* shrinkObject<T extends GenShape>(
  value: { [K in keyof T]: ReturnType<T[K]> },
  shape: T
): Iterable<{ [K in keyof T]: ReturnType<T[K]> }> {
  for (const key of Object.keys(shape)) {
    const typedKey = key as keyof T;
    const arbitrary = toArbitrary(shape[typedKey]);
    for (const shrunk of arbitrary.shrink(value[typedKey])) {
      const next = { ...value };
      next[typedKey] = shrunk as ReturnType<T[keyof T]>;
      yield next;
    }
  }
}

function* shrinkOneOf<T>(value: T, arbitraries: Array<Arbitrary<T>>): Iterable<T> {
  for (const arbitrary of arbitraries) {
    for (const shrunk of arbitrary.shrink(value)) {
      yield shrunk;
    }
  }
}

function* shrinkTuple<T extends unknown[]>(value: T, arbitraries: Array<Arbitrary<unknown>>): Iterable<T> {
  for (let index = 0; index < value.length; index += 1) {
    const arbitrary = arbitraries[index];
    const current = value[index];
    for (const shrunk of arbitrary.shrink(current)) {
      const next = value.slice() as T;
      next[index] = shrunk as T[number];
      yield next;
    }
  }
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

function generateFilteredValue<T>(arbitrary: Arbitrary<T>, predicate: (value: T) => boolean, rng: () => number, maxAttempts: number): T {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const value = arbitrary.generate(rng);
    if (predicate(value)) {
      return value;
    }
  }
  throw new RangeError('filter predicate rejected all generated values');
}

function* shrinkFiltered<T>(value: T, arbitrary: Arbitrary<T>, predicate: (value: T) => boolean): Iterable<T> {
  for (const candidate of arbitrary.shrink(value)) {
    if (predicate(candidate)) {
      yield candidate;
    }
  }
}
