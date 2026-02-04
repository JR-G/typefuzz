/**
 * Deterministic RNG seed. Only the lower 32 bits are used.
 */
export type Seed = number;

/**
 * RNG function that returns a float in [0, 1).
 */
export type Rng = () => number;

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
 * Normalized run config plus a seeded RNG.
 */
export interface RunState {
  runs: number;
  seed: Seed;
  rng: Rng;
}

/**
 * Create a deterministic RNG from a seed.
 *
 * Implementation uses xorshift32.
 */
export function createSeededRng(seed: Seed): Rng {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

/**
 * Normalize user config into a run state with a seeded RNG.
 */
export function createRunState(config: RunConfig = {}): RunState {
  const seed = normalizeSeed(config.seed);
  const runs = normalizeRuns(config.runs);
  return { seed, runs, rng: createSeededRng(seed) };
}

function normalizeSeed(seed: Seed | undefined): Seed {
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
