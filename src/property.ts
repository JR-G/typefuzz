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
 * Run a property and throw an Error on failure.
 */
export function fuzzAssert<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const result = runProperty(arb, predicate, config);
  if (!result.ok && result.failure) {
    const { seed, iterations, runs, shrinks, counterexample } = result.failure;
    const message = `property failed after ${iterations}/${runs} runs (seed ${seed}, shrinks ${shrinks})\ncounterexample: ${formatValue(counterexample)}`;
    const error = new Error(message);
    if (result.failure.error) {
      error.cause = result.failure.error;
    }
    throw error;
  }
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
    let improved = false;
  for (const candidate of arb.shrink(current)) {
    if (shrinks >= maxShrinks) {
      break;
    }
    shrinks += 1;
      const failure = tryFailure(predicate, candidate);
      if (failure.failed) {
        current = candidate;
        if (failure.error) {
          lastError = failure.error;
        }
        improved = true;
        break;
      }
    }
    if (!improved) {
      break;
    }
  }

  return { counterexample: current, shrinks, error: lastError };
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
