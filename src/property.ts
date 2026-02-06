import {
  createRunState,
  forkRandomSource,
  normalizeArbitrary,
  type Arbitrary,
  type Gen,
  type PropertyConfig
} from './core.js';

/**
 * Detailed information about a failing property run.
 */
export interface PropertyFailure<T> {
  seed: number;
  runs: number;
  iterations: number;
  shrinks: number;
  counterexample: T;
  error?: unknown;
}

/**
 * Result of a property run: either a pass or a failure with details.
 */
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
  for (let iteration = 1; iteration <= runs; iteration++) {
    const iterationSource = forkRandomSource(randomSource);
    const value = arbitrary.generate(iterationSource);
    const result = tryFailure(predicate, value);
    if (!result.failed) {
      continue;
    }
    const shrinkResult = shrinkCounterexample(arbitrary, predicate, value, maxShrinks);
    return {
      ok: false as const,
      failure: {
        seed,
        runs,
        iterations: iteration,
        shrinks: shrinkResult.shrinks,
        counterexample: shrinkResult.counterexample,
        error: shrinkResult.error ?? result.error
      }
    };
  }
  return { ok: true };
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

/**
 * Execute an async property with shrinking and return a structured result.
 *
 * @example
 * ```ts
 * const result = await runPropertyAsync(gen.int(1, 10), async (value) => value > 0);
 * ```
 */
export async function runPropertyAsync<T>(
  arbitraryInput: Arbitrary<T> | Gen<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  config: PropertyConfig = {}
): Promise<PropertyResult<T>> {
  const { runs, seed, randomSource } = createRunState(config);
  const maxShrinks = normalizeMaxShrinks(config.maxShrinks);
  const arbitrary = normalizeArbitrary(arbitraryInput);
  for (let iteration = 1; iteration <= runs; iteration++) {
    const iterationSource = forkRandomSource(randomSource);
    const value = arbitrary.generate(iterationSource);
    const result = await tryFailureAsync(predicate, value);
    if (!result.failed) {
      continue;
    }
    const shrinkResult = await shrinkCounterexampleAsync(arbitrary, predicate, value, maxShrinks);
    return {
      ok: false,
      failure: {
        seed,
        runs,
        iterations: iteration,
        shrinks: shrinkResult.shrinks,
        counterexample: shrinkResult.counterexample,
        error: shrinkResult.error ?? result.error
      }
    };
  }
  return { ok: true };
}

/**
 * Replay an async property with a specific seed.
 */
export async function runReplayAsync<T>(
  arbitraryInput: Arbitrary<T> | Gen<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  config: ReplayConfig
): Promise<PropertyResult<T>> {
  return runPropertyAsync(arbitraryInput, predicate, { ...config, seed: config.seed });
}

/**
 * Run an async property and throw an Error on failure.
 */
export async function fuzzAssertAsync<T>(
  arbitraryInput: Arbitrary<T> | Gen<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  config: PropertyConfig = {}
): Promise<void> {
  const result = await runPropertyAsync(arbitraryInput, predicate, config);
  if (result.ok) {
    return;
  }
  throw createFailureError(result.failure);
}

/**
 * Replay an async property with a specific seed and throw on failure.
 */
export async function fuzzReplayAsync<T>(
  arbitraryInput: Arbitrary<T> | Gen<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  config: ReplayConfig
): Promise<void> {
  await fuzzAssertAsync(arbitraryInput, predicate, config);
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
  let current = initial;
  let totalShrinks = 0;
  let lastError: unknown;
  for (let round = 0; round < maxShrinks; round++) {
    if (totalShrinks >= maxShrinks) {
      break;
    }
    const best = selectBestCandidate(arbitrary, predicate, current, maxShrinks - totalShrinks);
    if (!best.next) {
      break;
    }
    current = best.next;
    totalShrinks += best.shrinks;
    lastError = best.lastError ?? lastError;
  }
  return { current, shrinks: totalShrinks, lastError };
}

function selectBestCandidate<T>(
  arbitrary: Arbitrary<T>,
  predicate: (value: T) => boolean | void,
  current: T,
  remainingShrinks: number
): { next?: T; shrinks: number; lastError?: unknown } {
  const candidates = Array.from(arbitrary.shrink(current));
  let best: T | undefined;
  let bestScore: number | undefined;
  let shrinks = 0;
  let lastError: unknown;
  for (const candidate of candidates) {
    if (shrinks >= remainingShrinks) {
      break;
    }
    const failure = tryFailure(predicate, candidate);
    shrinks++;
    if (!failure.failed) {
      continue;
    }
    const candidateScore = scoreValue(candidate);
    if (bestScore === undefined || candidateScore < bestScore) {
      best = candidate;
      bestScore = candidateScore;
      lastError = failure.error ?? lastError;
    }
  }
  return { next: best, shrinks, lastError };
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

async function tryFailureAsync<T>(
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  value: T
): Promise<{ failed: boolean; error?: unknown }> {
  try {
    const result = await predicate(value);
    if (result === false) {
      return { failed: true };
    }
    return { failed: false };
  } catch (error) {
    return { failed: true, error };
  }
}

async function shrinkCounterexampleAsync<T>(
  arbitrary: Arbitrary<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>,
  value: T,
  maxShrinks: number
): Promise<{ counterexample: T; shrinks: number; error?: unknown }> {
  let current = value;
  let totalShrinks = 0;
  let lastError: unknown;
  for (let round = 0; round < maxShrinks; round++) {
    if (totalShrinks >= maxShrinks) {
      break;
    }
    const candidates = Array.from(arbitrary.shrink(current));
    let bestCandidate: T | undefined;
    let bestScore: number | undefined;
    let roundShrinks = 0;
    for (const candidate of candidates) {
      if (totalShrinks + roundShrinks >= maxShrinks) {
        break;
      }
      const failure = await tryFailureAsync(predicate, candidate);
      roundShrinks++;
      if (!failure.failed) {
        continue;
      }
      const candidateScore = scoreValue(candidate);
      if (bestScore === undefined || candidateScore < bestScore) {
        bestCandidate = candidate;
        bestScore = candidateScore;
        lastError = failure.error ?? lastError;
      }
    }
    totalShrinks += roundShrinks;
    if (bestCandidate === undefined) {
      break;
    }
    current = bestCandidate;
  }
  return { counterexample: current, shrinks: totalShrinks, error: lastError };
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
