import {
  createRunState,
  normalizeArbitrary,
  type Arbitrary,
  type Gen,
  type PropertyConfig
} from './core.js';

export interface PropertyFailure<T> {
  seed: number;
  runs: number;
  iterations: number;
  shrinks: number;
  counterexample: T;
  error?: unknown;
}

export interface PropertyResult<T> {
  ok: boolean;
  failure?: PropertyFailure<T>;
}

/**
 * JSON-serializable representation of a property failure.
 */
export interface SerializedFailure<T> {
  seed: number;
  runs: number;
  iterations: number;
  shrinks: number;
  counterexample: T;
  message: string;
}

/**
 * Config used to replay a specific seed.
 */
export interface ReplayConfig extends Omit<PropertyConfig, 'seed'> {
  seed: number;
}

/**
 * Format a property failure into a readable multi-line message.
 */
export function formatFailure<T>(failure: PropertyFailure<T>): string {
  const { seed, iterations, runs, shrinks, counterexample } = failure;
  return [
    `property failed after ${iterations}/${runs} runs`,
    `seed: ${seed}`,
    `shrinks: ${shrinks}`,
    `counterexample: ${formatValue(counterexample)}`
  ].join('\n');
}

/**
 * Convert a failure into a JSON-friendly payload.
 */
export function serializeFailure<T>(failure: PropertyFailure<T>): SerializedFailure<T> {
  return {
    seed: failure.seed,
    runs: failure.runs,
    iterations: failure.iterations,
    shrinks: failure.shrinks,
    counterexample: failure.counterexample,
    message: formatFailure(failure)
  };
}

/**
 * Execute a property with shrinking and return a structured result.
 */
export function runProperty<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): PropertyResult<T> {
  const { runs, seed, rng } = createRunState(config);
  const maxShrinks = normalizeMaxShrinks(config.maxShrinks);
  const arbitrary = normalizeArbitrary(arb);

  for (let iteration = 0; iteration < runs; iteration += 1) {
    const value = arbitrary.generate(rng);
    const failure = tryFailure(predicate, value);
    if (failure.failed) {
      const { counterexample, shrinks, error } = shrinkCounterexample(arbitrary, predicate, value, maxShrinks);
      return {
        ok: false,
        failure: {
          seed,
          runs,
          iterations: iteration + 1,
          shrinks,
          counterexample,
          error: error ?? failure.error
        }
      };
    }
  }

  return { ok: true };
}

/**
 * Replay a property with a specific seed.
 */
export function runReplay<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): PropertyResult<T> {
  return runProperty(arb, predicate, { ...config, seed: config.seed });
}

/**
 * Run a property and throw an Error on failure.
 */
export function fuzzAssert<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const result = runProperty(arb, predicate, config);
  if (!result.ok && result.failure) {
    const error = new Error(formatFailure(result.failure));
    if (result.failure.error) {
      error.cause = result.failure.error;
    }
    throw error;
  }
}

/**
 * Replay a property with a specific seed and throw on failure.
 */
export function fuzzReplay<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): void {
  fuzzAssert(arb, predicate, config);
}

function normalizeMaxShrinks(maxShrinks: number | undefined): number {
  const resolved = maxShrinks ?? 1000;
  if (!Number.isFinite(resolved) || resolved <= 0 || !Number.isInteger(resolved)) {
    throw new RangeError('maxShrinks must be a positive integer');
  }
  return resolved;
}

function tryFailure<T>(predicate: (value: T) => boolean | void, value: T): { failed: boolean; error?: unknown } {
  try {
    const result = predicate(value);
    if (result === false) {
      return { failed: true };
    }
    return { failed: false };
  } catch (error) {
    return { failed: true, error };
  }
}

function shrinkCounterexample<T>(arb: Arbitrary<T>, predicate: (value: T) => boolean | void, value: T, maxShrinks: number): { counterexample: T; shrinks: number; error?: unknown } {
  let current = value;
  let shrinks = 0;
  let lastError: unknown;

  while (shrinks < maxShrinks) {
    let bestCandidate: T | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of arb.shrink(current)) {
      if (shrinks >= maxShrinks) {
        break;
      }
      shrinks += 1;
      const failure = tryFailure(predicate, candidate);
      if (failure.failed) {
        const score = scoreValue(candidate);
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
        if (failure.error) {
          lastError = failure.error;
        }
      }
    }
    if (bestCandidate === undefined) {
      break;
    }
    current = bestCandidate;
  }

  return { counterexample: current, shrinks, error: lastError };
}

function scoreValue(value: unknown): number {
  if (typeof value === 'number') {
    return Math.abs(value);
  }
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object') {
    return jsonLength(value);
  }
  return 0;
}

function jsonLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
