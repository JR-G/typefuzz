import type { Rng } from './core.js';

/**
 * Generator function that produces a value using the supplied RNG.
 */
export type Gen<T> = (rng: Rng) => T;

type GenShape = Record<string, Gen<unknown>>;

/**
 * Built-in generators.
 */
export const gen = {
  /**
   * Integer generator inclusive of min and max.
   */
  int(min = 0, max = 100): Gen<number> {
    assertRange(min, max, 'int');
    return (rng) => Math.floor(rng() * (max - min + 1)) + min;
  },
  /**
   * Float generator within [min, max).
   */
  float(min = 0, max = 1): Gen<number> {
    assertRange(min, max, 'float');
    return (rng) => rng() * (max - min) + min;
  },
  /**
   * Boolean generator.
   */
  bool(): Gen<boolean> {
    return (rng) => rng() >= 0.5;
  },
  /**
   * Lowercase alphanumeric string of a fixed length.
   */
  string(length = 8): Gen<string> {
    assertLength(length, 'string length');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return (rng) => {
      let out = '';
      for (let i = 0; i < length; i += 1) {
        out += chars[Math.floor(rng() * chars.length)];
      }
      return out;
    };
  },
  /**
   * Fixed-length array generator.
   */
  array<T>(item: Gen<T>, length = 5): Gen<T[]> {
    assertLength(length, 'array length');
    return (rng) => Array.from({ length }, () => item(rng));
  },
  /**
   * Object generator from a generator shape map.
   */
  object<T extends GenShape>(shape: T): Gen<{ [K in keyof T]: ReturnType<T[K]> }> {
    return (rng) => {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        out[key] = shape[key](rng);
      }
      return out as { [K in keyof T]: ReturnType<T[K]> };
    };
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
