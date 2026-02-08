/**
 * Deterministic RNG seed. Only the lower 32 bits are used.
 */
export type Seed = number;

/**
 * Random source that returns a float in [0, 1).
 */
export type RandomSource = () => number;

/**
 * Generator function that produces a value using the supplied random source.
 */
export type Gen<T> = (randomSource: RandomSource) => T;

/**
 * Shrinker function that yields smaller versions of a value.
 */
export type Shrink<T> = (value: T) => Iterable<T>;

/**
 * Arbitrary value with generator and shrinker.
 */
export interface Arbitrary<T> {
  generate: Gen<T>;
  shrink: Shrink<T>;
}

/**
 * Configuration for fuzz/property runs.
 */
export interface RunConfig {
  /**
   * RNG seed. If omitted or invalid, a time-based seed is used.
   */
  seed?: Seed;
  /**
   * Number of test runs to execute. Must be a positive integer.
   */
  runs?: number;
}

/**
 * Shared config for property runs.
 */
export interface PropertyConfig extends RunConfig {
  /**
   * Maximum number of shrink attempts per failing case.
   */
  maxShrinks?: number;
}

/**
 * Normalized run config plus a seeded RNG.
 */
export interface RunState {
  runs: number;
  seed: Seed;
  randomSource: RandomSource;
}

/**
 * Create a deterministic RNG from a seed.
 *
 * Implementation uses xorshift32.
 */
export function createSeededRandomSource(seed: Seed): RandomSource {
  let state = seed | 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * Derive an independent RNG from the current source. Uses the next value
 * as a seed so the fork is deterministic but isolated.
 */
export function forkRandomSource(parent: RandomSource): RandomSource {
  const childSeed = Math.floor(parent() * 0x100000000);
  return createSeededRandomSource(childSeed);
}

/**
 * Normalize user config into a run state with a seeded RNG.
 */
export function createRunState(config: RunConfig = {}): RunState {
  const seed = normalizeSeed(config.seed);
  const runs = normalizeRuns(config.runs);
  return { seed, runs, randomSource: createSeededRandomSource(seed) };
}

/**
 * Create an Arbitrary from a generator and shrinker.
 */
export function createArbitrary<T>(generate: Gen<T>, shrink: Shrink<T>): Arbitrary<T> {
  return { generate, shrink };
}

/**
 * Normalize an arbitrary; if a generator function is provided, use an empty shrinker.
 */
export function normalizeArbitrary<T>(arbitraryInput: Arbitrary<T> | Gen<T>): Arbitrary<T> {
  if (typeof arbitraryInput === 'function') {
    return { generate: arbitraryInput, shrink: () => [] };
  }
  return arbitraryInput;
}

export function normalizeSeed(seed: Seed | undefined): Seed {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return Date.now() >>> 0;
  }
  return seed >>> 0;
}

function normalizeRuns(runs: number | undefined): number {
  const resolved = runs ?? 100;
  if (!Number.isFinite(resolved) || resolved <= 0 || !Number.isInteger(resolved)) {
    throw new RangeError('runs must be a positive integer');
  }
  return resolved;
}
