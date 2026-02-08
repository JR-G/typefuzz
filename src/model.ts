import {
  createRunState,
  forkRandomSource,
  normalizeArbitrary,
  type Arbitrary,
  type Gen,
  type RandomSource,
  type RunConfig
} from './core.js';
import { randomInt } from './shrink-utils.js';

/**
 * A command in a model-based test.
 */
export interface Command<Model, System, Param = void> {
  name: string;
  arbitrary?: Arbitrary<Param> | Gen<Param>;
  precondition?: (model: Model) => boolean;
  run: (system: System, model: Model, param: Param) => void;
  check: (system: System, model: Model, param: Param) => boolean | void;
}

/**
 * An async command in a model-based test.
 */
export interface AsyncCommand<Model, System, Param = void> {
  name: string;
  arbitrary?: Arbitrary<Param> | Gen<Param>;
  precondition?: (model: Model) => boolean;
  run: (system: System, model: Model, param: Param) => void | Promise<void>;
  check: (system: System, model: Model, param: Param) => boolean | void | Promise<boolean | void>;
}

/**
 * Type-erased command for heterogeneous arrays.
 */
export type AnyCommand<Model, System> = Command<Model, System, any>;

/**
 * Type-erased async command.
 */
export type AnyAsyncCommand<Model, System> = AsyncCommand<Model, System, any>;

/**
 * Specification for a model-based test.
 */
export interface ModelSpec<Model, System> {
  state: () => Model;
  setup: () => System;
  teardown?: (system: System) => void;
  commands: ReadonlyArray<AnyCommand<Model, System>>;
}

/**
 * Specification for an async model-based test.
 */
export interface AsyncModelSpec<Model, System> {
  state: () => Model;
  setup: () => System | Promise<System>;
  teardown?: (system: System) => void | Promise<void>;
  commands: ReadonlyArray<AnyAsyncCommand<Model, System>>;
}

/**
 * Configuration for model-based test runs.
 */
export interface ModelConfig extends RunConfig {
  maxCommands?: number;
  maxShrinks?: number;
}

/**
 * Detailed information about a model-based test failure.
 */
export interface ModelFailure {
  seed: number;
  runs: number;
  iterations: number;
  shrinks: number;
  sequence: ReadonlyArray<{ name: string; param: unknown }>;
  failedStep: number;
  error?: unknown;
}

/**
 * Result of a model-based test run.
 */
export type ModelResult = { ok: true } | { ok: false; failure: ModelFailure };

/**
 * JSON-serializable representation of a model failure.
 */
export interface SerializedModelFailure {
  seed: number;
  runs: number;
  iterations: number;
  shrinks: number;
  sequence: ReadonlyArray<{ name: string; param: unknown }>;
  failedStep: number;
  message: string;
  replay: string;
}

interface ExecutedStep {
  commandIndex: number;
  param: unknown;
}

interface ExecutionResult {
  failed: boolean;
  failedStep: number;
  error?: unknown;
}

/**
 * Format a model failure into a readable multi-line message.
 */
export function formatModelFailure(failure: ModelFailure): string {
  const lines = [
    `model-based test failed after ${failure.iterations}/${failure.runs} runs`,
    `seed: ${failure.seed}`,
    `shrinks: ${failure.shrinks}`,
    'command sequence:'
  ];
  for (let i = 0; i < failure.sequence.length; i++) {
    const step = failure.sequence[i];
    const paramStr = step.param === undefined ? '' : `(${truncatedJson(step.param)})`;
    const marker = i === failure.failedStep ? '  <-- check failed' : '';
    lines.push(`  ${i + 1}. ${step.name}${paramStr}${marker}`);
  }
  lines.push(`replay: fuzz.model(spec, { seed: ${failure.seed}, runs: ${failure.runs} })`);
  return lines.join('\n');
}

/**
 * Convert a model failure into a JSON-friendly payload.
 */
export function serializeModelFailure(failure: ModelFailure): SerializedModelFailure {
  return {
    seed: failure.seed,
    runs: failure.runs,
    iterations: failure.iterations,
    shrinks: failure.shrinks,
    sequence: failure.sequence,
    failedStep: failure.failedStep,
    message: formatModelFailure(failure),
    replay: `fuzz.model(spec, { seed: ${failure.seed}, runs: ${failure.runs} })`
  };
}

/**
 * Run a model-based test with shrinking.
 */
export function runModel<Model, System>(spec: ModelSpec<Model, System>, config: ModelConfig = {}): ModelResult {
  validateSpec(spec);
  const { runs, seed, randomSource } = createRunState(config);
  const maxCommands = normalizeMaxCommands(config.maxCommands);
  const maxShrinks = normalizePositiveInt(config.maxShrinks, 1000, 'maxShrinks');

  for (let iteration = 1; iteration <= runs; iteration++) {
    const iterationSource = forkRandomSource(randomSource);
    const { steps, result } = executeIteration(spec, iterationSource, maxCommands);
    if (!result.failed) {
      continue;
    }
    const replay = (candidate: ExecutedStep[]) => replaySequence(spec, candidate);
    const shrunk = shrinkSequence(spec.commands, steps, result, maxShrinks, replay);
    return {
      ok: false,
      failure: buildFailure(spec.commands, shrunk, seed, runs, iteration)
    };
  }
  return { ok: true };
}

/**
 * Run an async model-based test with shrinking.
 */
export async function runModelAsync<Model, System>(spec: AsyncModelSpec<Model, System>, config: ModelConfig = {}): Promise<ModelResult> {
  validateSpec(spec);
  const { runs, seed, randomSource } = createRunState(config);
  const maxCommands = normalizeMaxCommands(config.maxCommands);
  const maxShrinks = normalizePositiveInt(config.maxShrinks, 1000, 'maxShrinks');

  for (let iteration = 1; iteration <= runs; iteration++) {
    const iterationSource = forkRandomSource(randomSource);
    const { steps, result } = await executeIterationAsync(spec, iterationSource, maxCommands);
    if (!result.failed) {
      continue;
    }
    const replay = (candidate: ExecutedStep[]) => replaySequenceAsync(spec, candidate);
    const shrunk = await shrinkSequenceAsync(spec.commands, steps, result, maxShrinks, replay);
    return {
      ok: false,
      failure: buildFailure(spec.commands, shrunk, seed, runs, iteration)
    };
  }
  return { ok: true };
}

/**
 * Run a model-based test and throw on failure.
 */
export function assertModel<Model, System>(spec: ModelSpec<Model, System>, config: ModelConfig = {}): void {
  const result = runModel(spec, config);
  if (!result.ok) {
    throw createModelError(result.failure);
  }
}

/**
 * Run an async model-based test and throw on failure.
 */
export async function assertModelAsync<Model, System>(spec: AsyncModelSpec<Model, System>, config: ModelConfig = {}): Promise<void> {
  const result = await runModelAsync(spec, config);
  if (!result.ok) {
    throw createModelError(result.failure);
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function executeIteration<Model, System>(
  spec: ModelSpec<Model, System>,
  randomSource: RandomSource,
  maxCommands: number
): { steps: ExecutedStep[]; result: ExecutionResult } {
  const model = spec.state();
  const system = spec.setup();
  const steps: ExecutedStep[] = [];
  try {
    const stepCount = randomInt(randomSource, 1, maxCommands);
    for (let s = 0; s < stepCount; s++) {
      const eligible = spec.commands
        .map((cmd, idx) => ({ cmd, idx }))
        .filter(({ cmd }) => !cmd.precondition || cmd.precondition(model));
      if (eligible.length === 0) {
        break;
      }
      const chosen = eligible[randomInt(randomSource, 0, eligible.length - 1)];
      const arb = chosen.cmd.arbitrary ? normalizeArbitrary(chosen.cmd.arbitrary) : undefined;
      const param = arb ? arb.generate(forkRandomSource(randomSource)) : undefined;
      steps.push({ commandIndex: chosen.idx, param });
      const stepResult = runStep(chosen.cmd, system, model, param);
      if (stepResult.failed) {
        return { steps, result: { ...stepResult, failedStep: steps.length - 1 } };
      }
    }
    return { steps, result: { failed: false, failedStep: -1 } };
  } finally {
    safeTeardown(spec.teardown, system);
  }
}

async function executeIterationAsync<Model, System>(
  spec: AsyncModelSpec<Model, System>,
  randomSource: RandomSource,
  maxCommands: number
): Promise<{ steps: ExecutedStep[]; result: ExecutionResult }> {
  const model = spec.state();
  const system = await spec.setup();
  const steps: ExecutedStep[] = [];
  try {
    const stepCount = randomInt(randomSource, 1, maxCommands);
    for (let s = 0; s < stepCount; s++) {
      const eligible = spec.commands
        .map((cmd, idx) => ({ cmd, idx }))
        .filter(({ cmd }) => !cmd.precondition || cmd.precondition(model));
      if (eligible.length === 0) {
        break;
      }
      const chosen = eligible[randomInt(randomSource, 0, eligible.length - 1)];
      const arb = chosen.cmd.arbitrary ? normalizeArbitrary(chosen.cmd.arbitrary) : undefined;
      const param = arb ? arb.generate(forkRandomSource(randomSource)) : undefined;
      steps.push({ commandIndex: chosen.idx, param });
      const stepResult = await runStepAsync(chosen.cmd, system, model, param);
      if (stepResult.failed) {
        return { steps, result: { ...stepResult, failedStep: steps.length - 1 } };
      }
    }
    return { steps, result: { failed: false, failedStep: -1 } };
  } finally {
    await safeTeardownAsync(spec.teardown, system);
  }
}

function runStep<Model, System>(
  cmd: AnyCommand<Model, System>,
  system: System,
  model: Model,
  param: unknown
): { failed: boolean; error?: unknown } {
  try {
    cmd.run(system, model, param);
  } catch (error) {
    return { failed: true, error };
  }
  try {
    const result = cmd.check(system, model, param);
    if (result === false) {
      return { failed: true };
    }
  } catch (error) {
    return { failed: true, error };
  }
  return { failed: false };
}

async function runStepAsync<Model, System>(
  cmd: AnyAsyncCommand<Model, System>,
  system: System,
  model: Model,
  param: unknown
): Promise<{ failed: boolean; error?: unknown }> {
  try {
    await cmd.run(system, model, param);
  } catch (error) {
    return { failed: true, error };
  }
  try {
    const result = await cmd.check(system, model, param);
    if (result === false) {
      return { failed: true };
    }
  } catch (error) {
    return { failed: true, error };
  }
  return { failed: false };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

function replaySequence<Model, System>(
  spec: ModelSpec<Model, System>,
  steps: ExecutedStep[]
): ExecutionResult {
  const model = spec.state();
  const system = spec.setup();
  try {
    for (let i = 0; i < steps.length; i++) {
      const cmd = spec.commands[steps[i].commandIndex];
      if (cmd.precondition && !cmd.precondition(model)) {
        return { failed: false, failedStep: -1 };
      }
      const stepResult = runStep(cmd, system, model, steps[i].param);
      if (stepResult.failed) {
        return { failed: true, failedStep: i, error: stepResult.error };
      }
    }
    return { failed: false, failedStep: -1 };
  } finally {
    safeTeardown(spec.teardown, system);
  }
}

async function replaySequenceAsync<Model, System>(
  spec: AsyncModelSpec<Model, System>,
  steps: ExecutedStep[]
): Promise<ExecutionResult> {
  const model = spec.state();
  const system = await spec.setup();
  try {
    for (let i = 0; i < steps.length; i++) {
      const cmd = spec.commands[steps[i].commandIndex];
      if (cmd.precondition && !cmd.precondition(model)) {
        return { failed: false, failedStep: -1 };
      }
      const stepResult = await runStepAsync(cmd, system, model, steps[i].param);
      if (stepResult.failed) {
        return { failed: true, failedStep: i, error: stepResult.error };
      }
    }
    return { failed: false, failedStep: -1 };
  } finally {
    await safeTeardownAsync(spec.teardown, system);
  }
}

// ---------------------------------------------------------------------------
// Shrinking — delta-debugging chunk removal + element-wise parameter shrinking,
// wrapped in a fixed-point loop that runs until convergence or budget exhaustion.
// ---------------------------------------------------------------------------

interface ShrinkState {
  steps: ExecutedStep[];
  failedStep: number;
  shrinks: number;
  error?: unknown;
}

type ReplayFn = (steps: ExecutedStep[]) => ExecutionResult;
type AsyncReplayFn = (steps: ExecutedStep[]) => Promise<ExecutionResult>;

function shrinkSequence(
  commands: ReadonlyArray<AnyCommand<any, any>>,
  originalSteps: ExecutedStep[],
  originalResult: ExecutionResult,
  maxShrinks: number,
  replay: ReplayFn
): ShrinkState {
  const state: ShrinkState = {
    steps: originalSteps,
    failedStep: originalResult.failedStep,
    shrinks: 0,
    error: originalResult.error
  };

  let globalImproved = true;
  while (globalImproved && state.shrinks < maxShrinks) {
    globalImproved = false;
    if (shrinkChunks(state, maxShrinks, replay)) {
      globalImproved = true;
    }
    if (shrinkParams(state, commands, maxShrinks, replay)) {
      globalImproved = true;
    }
  }

  return state;
}

async function shrinkSequenceAsync(
  commands: ReadonlyArray<AnyAsyncCommand<any, any>>,
  originalSteps: ExecutedStep[],
  originalResult: ExecutionResult,
  maxShrinks: number,
  replay: AsyncReplayFn
): Promise<ShrinkState> {
  const state: ShrinkState = {
    steps: originalSteps,
    failedStep: originalResult.failedStep,
    shrinks: 0,
    error: originalResult.error
  };

  let globalImproved = true;
  while (globalImproved && state.shrinks < maxShrinks) {
    globalImproved = false;
    if (await shrinkChunksAsync(state, maxShrinks, replay)) {
      globalImproved = true;
    }
    if (await shrinkParamsAsync(state, commands, maxShrinks, replay)) {
      globalImproved = true;
    }
  }

  return state;
}

/**
 * Delta-debugging inspired chunk removal.
 *
 * Tries removing contiguous chunks of decreasing size. When a removal
 * succeeds, restarts with larger chunks (the shorter sequence might allow
 * removing even bigger portions). When no removal at a given chunk size
 * helps, halves the chunk size and tries again, down to single-step removal.
 */
function shrinkChunks(state: ShrinkState, maxShrinks: number, replay: ReplayFn): boolean {
  let anyImproved = false;
  let chunkSize = Math.floor(state.steps.length / 2);

  while (chunkSize >= 1 && state.shrinks < maxShrinks) {
    let removedInPass = false;
    let i = 0;
    while (i + chunkSize <= state.steps.length && state.shrinks < maxShrinks) {
      const candidate = [...state.steps.slice(0, i), ...state.steps.slice(i + chunkSize)];
      if (candidate.length === 0) {
        i++;
        continue;
      }
      const result = replay(candidate);
      state.shrinks++;
      if (result.failed) {
        state.steps = candidate;
        state.failedStep = result.failedStep;
        state.error = result.error;
        anyImproved = true;
        removedInPass = true;
      } else {
        i++;
      }
    }
    if (removedInPass) {
      chunkSize = Math.floor(state.steps.length / 2);
    } else {
      chunkSize = Math.floor(chunkSize / 2);
    }
  }

  return anyImproved;
}

async function shrinkChunksAsync(state: ShrinkState, maxShrinks: number, replay: AsyncReplayFn): Promise<boolean> {
  let anyImproved = false;
  let chunkSize = Math.floor(state.steps.length / 2);

  while (chunkSize >= 1 && state.shrinks < maxShrinks) {
    let removedInPass = false;
    let i = 0;
    while (i + chunkSize <= state.steps.length && state.shrinks < maxShrinks) {
      const candidate = [...state.steps.slice(0, i), ...state.steps.slice(i + chunkSize)];
      if (candidate.length === 0) {
        i++;
        continue;
      }
      const result = await replay(candidate);
      state.shrinks++;
      if (result.failed) {
        state.steps = candidate;
        state.failedStep = result.failedStep;
        state.error = result.error;
        anyImproved = true;
        removedInPass = true;
      } else {
        i++;
      }
    }
    if (removedInPass) {
      chunkSize = Math.floor(state.steps.length / 2);
    } else {
      chunkSize = Math.floor(chunkSize / 2);
    }
  }

  return anyImproved;
}

/**
 * Shrink parameter values for each step that has an arbitrary.
 * Loops until a full pass yields no improvement.
 */
function shrinkParams(
  state: ShrinkState,
  commands: ReadonlyArray<AnyCommand<any, any>>,
  maxShrinks: number,
  replay: ReplayFn
): boolean {
  let anyImproved = false;
  let passImproved = true;

  while (passImproved && state.shrinks < maxShrinks) {
    passImproved = false;
    for (let i = 0; i < state.steps.length && state.shrinks < maxShrinks; i++) {
      const step = state.steps[i];
      const cmd = commands[step.commandIndex];
      if (!cmd.arbitrary) continue;
      const arb = normalizeArbitrary(cmd.arbitrary);
      for (const shrunkParam of arb.shrink(step.param)) {
        if (state.shrinks >= maxShrinks) break;
        const candidate = state.steps.map((s, idx) =>
          idx === i ? { ...s, param: shrunkParam } : s
        );
        const result = replay(candidate);
        state.shrinks++;
        if (result.failed) {
          state.steps = candidate;
          state.failedStep = result.failedStep;
          state.error = result.error;
          anyImproved = true;
          passImproved = true;
          break;
        }
      }
      if (passImproved) break;
    }
  }

  return anyImproved;
}

async function shrinkParamsAsync(
  state: ShrinkState,
  commands: ReadonlyArray<AnyAsyncCommand<any, any>>,
  maxShrinks: number,
  replay: AsyncReplayFn
): Promise<boolean> {
  let anyImproved = false;
  let passImproved = true;

  while (passImproved && state.shrinks < maxShrinks) {
    passImproved = false;
    for (let i = 0; i < state.steps.length && state.shrinks < maxShrinks; i++) {
      const step = state.steps[i];
      const cmd = commands[step.commandIndex];
      if (!cmd.arbitrary) continue;
      const arb = normalizeArbitrary(cmd.arbitrary);
      for (const shrunkParam of arb.shrink(step.param)) {
        if (state.shrinks >= maxShrinks) break;
        const candidate = state.steps.map((s, idx) =>
          idx === i ? { ...s, param: shrunkParam } : s
        );
        const result = await replay(candidate);
        state.shrinks++;
        if (result.failed) {
          state.steps = candidate;
          state.failedStep = result.failedStep;
          state.error = result.error;
          anyImproved = true;
          passImproved = true;
          break;
        }
      }
      if (passImproved) break;
    }
  }

  return anyImproved;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFailure(
  commands: ReadonlyArray<{ name: string }>,
  shrunk: ShrinkState,
  seed: number,
  runs: number,
  iteration: number
): ModelFailure {
  return {
    seed,
    runs,
    iterations: iteration,
    shrinks: shrunk.shrinks,
    sequence: shrunk.steps.map((s) => ({ name: commands[s.commandIndex].name, param: s.param })),
    failedStep: shrunk.failedStep,
    error: shrunk.error
  };
}

function createModelError(failure: ModelFailure): Error {
  const error = new Error(formatModelFailure(failure));
  if (failure.error !== undefined) {
    error.cause = failure.error;
  }
  (error as Error & { modelFailure?: ModelFailure }).modelFailure = failure;
  return error;
}

function normalizeMaxCommands(maxCommands: number | undefined): number {
  const resolved = maxCommands ?? 20;
  if (!Number.isFinite(resolved) || resolved <= 0 || !Number.isInteger(resolved)) {
    throw new RangeError('maxCommands must be a positive integer');
  }
  return resolved;
}

function normalizePositiveInt(value: number | undefined, defaultValue: number, name: string): number {
  const resolved = value ?? defaultValue;
  if (!Number.isFinite(resolved) || resolved <= 0 || !Number.isInteger(resolved)) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return resolved;
}

function validateSpec(spec: ModelSpec<any, any> | AsyncModelSpec<any, any>): void {
  if (!spec.commands || spec.commands.length === 0) {
    throw new RangeError('model spec requires at least one command');
  }
}

function safeTeardown<System>(teardown: ((system: System) => void) | undefined, system: System): void {
  if (!teardown) return;
  try {
    teardown(system);
  } catch {
    // Swallow teardown errors to avoid masking the real failure.
  }
}

async function safeTeardownAsync<System>(teardown: ((system: System) => void | Promise<void>) | undefined, system: System): Promise<void> {
  if (!teardown) return;
  try {
    await teardown(system);
  } catch {
    // Swallow teardown errors to avoid masking the real failure.
  }
}

function truncatedJson(value: unknown, maxLength = 80): string {
  const json = compactJson(value);
  if (json.length <= maxLength) return json;
  return json.slice(0, maxLength - 3) + '...';
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
