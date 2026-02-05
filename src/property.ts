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

export type PropertyResult<T> =
  | { ok: true }
  | { ok: false; failure: PropertyFailure<T> };

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
  replay: string;
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
 * Format a replay hint for a property failure.
 */
export function formatReplaySnippet(seed: number, runs: number): string {
  return `replay: fuzz.assert(arbitrary, predicate, { seed: ${seed}, runs: ${runs} })`;
}

/**
 * Format a property failure with a replay hint.
 */
export function formatFailureWithReplay<T>(failure: PropertyFailure<T>): string {
  return [formatFailure(failure), formatReplaySnippet(failure.seed, failure.runs)].join('\n');
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
    message: formatFailure(failure),
    replay: formatReplaySnippet(failure.seed, failure.runs)
  };
}

/**
 * Format a serialized failure payload for display.
 */
export function formatSerializedFailure<T>(failure: SerializedFailure<T>): string {
  return [failure.message, failure.replay].join('\n');
}

/**
 * Execute a property with shrinking and return a structured result.
 *
 * @example
 * ```ts
 * const result = runProperty(gen.int(1, 10), (value) => value > 0, { runs: 100 });
 * ```
 */
export function runProperty<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): PropertyResult<T> {
  const { runs, seed, randomSource } = createRunState(config);
  const maxShrinks = normalizeMaxShrinks(config.maxShrinks);
  const arbitrary = normalizeArbitrary(arbitraryInput);
  const iterations = Array.from({ length: runs }, (_, index) => index + 1);
  const failure = iterations.reduce<PropertyFailure<T> | undefined>((state, iteration) => {
    if (state) {
      return state;
    }
    const value = arbitrary.generate(randomSource);
    const result = tryFailure(predicate, value);
    if (!result.failed) {
      return state;
    }
    const shrinkResult = shrinkCounterexample(arbitrary, predicate, value, maxShrinks);
    return {
      seed,
      runs,
      iterations: iteration,
      shrinks: shrinkResult.shrinks,
      counterexample: shrinkResult.counterexample,
      error: shrinkResult.error ?? result.error
    };
  }, undefined);
  return failure ? { ok: false, failure } : { ok: true };
}

/**
 * Replay a property with a specific seed.
 *
 * @example
 * ```ts
 * runReplay(gen.int(1, 10), (value) => value > 0, { seed: 123, runs: 100 });
 * ```
 */
export function runReplay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): PropertyResult<T> {
  return runProperty(arbitraryInput, predicate, { ...config, seed: config.seed });
}

/**
 * Run a property and throw an Error on failure.
 *
 * @example
 * ```ts
 * fuzzAssert(gen.int(1, 10), (value) => value > 0);
 * ```
 */
export function fuzzAssert<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const result = runProperty(arbitraryInput, predicate, config);
  if (result.ok) {
    return;
  }
  throw createFailureError(result.failure);
}

/**
 * Replay a property with a specific seed and throw on failure.
 *
 * @example
 * ```ts
 * fuzzReplay(gen.int(1, 10), (value) => value > 0, { seed: 123, runs: 100 });
 * ```
 */
export function fuzzReplay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): void {
  fuzzAssert(arbitraryInput, predicate, config);
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

function shrinkCounterexample<T>(arbitrary: Arbitrary<T>, predicate: (value: T) => boolean | void, value: T, maxShrinks: number): { counterexample: T; shrinks: number; error?: unknown } {
  const shrinkState = shrinkUntilFixedPoint(arbitrary, predicate, value, maxShrinks);
  return { counterexample: shrinkState.current, shrinks: shrinkState.shrinks, error: shrinkState.lastError };
}

function shrinkUntilFixedPoint<T>(
  arbitrary: Arbitrary<T>,
  predicate: (value: T) => boolean | void,
  initial: T,
  maxShrinks: number
): { current: T; shrinks: number; lastError?: unknown } {
  const initialState = { current: initial, shrinks: 0, lastError: undefined as unknown };
  const iterations = Array.from({ length: maxShrinks }, (_, index) => index);
  return iterations.reduce((state) => {
    if (state.shrinks >= maxShrinks) {
      return state;
    }
    const best = selectBestCandidate(arbitrary, predicate, state.current, maxShrinks - state.shrinks);
    if (!best.next) {
      return state;
    }
    return {
      current: best.next,
      shrinks: state.shrinks + best.shrinks,
      lastError: best.lastError ?? state.lastError
    };
  }, initialState);
}

function selectBestCandidate<T>(
  arbitrary: Arbitrary<T>,
  predicate: (value: T) => boolean | void,
  current: T,
  remainingShrinks: number
): { next?: T; shrinks: number; lastError?: unknown } {
  const candidates = Array.from(arbitrary.shrink(current));
  const evaluated = candidates.reduce(
    (state, candidate) => {
      if (state.shrinks >= remainingShrinks) {
        return state;
      }
      const failure = tryFailure(predicate, candidate);
      if (!failure.failed) {
        return { ...state, shrinks: state.shrinks + 1 };
      }
      const candidateScore = scoreValue(candidate);
      const shouldReplace = state.bestScore === undefined || candidateScore < state.bestScore;
      const nextBest = shouldReplace ? candidate : state.best;
      const nextScore = shouldReplace ? candidateScore : state.bestScore;
      const nextError = failure.error ?? state.lastError;
      return {
        best: nextBest,
        bestScore: nextScore,
        shrinks: state.shrinks + 1,
        lastError: nextError
      };
    },
    { best: undefined as T | undefined, bestScore: undefined as number | undefined, shrinks: 0, lastError: undefined as unknown }
  );
  return { next: evaluated.best, shrinks: evaluated.shrinks, lastError: evaluated.lastError };
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

function createFailureError<T>(failure: PropertyFailure<T>): Error {
  const error = new Error(formatFailureWithReplay(failure));
  const failureCause = failure.error;
  if (failureCause !== undefined) {
    error.cause = failureCause;
  }
  (error as Error & { fuzzFailure?: SerializedFailure<T> }).fuzzFailure = serializeFailure(failure);
  return error;
}
