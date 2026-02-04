import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { fuzz } from '../src/index.js';
import { createSeededRandomSource } from '../src/core.js';
import { fuzzAssert, formatSerializedFailure, runProperty, runReplay, serializeFailure } from '../src/property.js';

describe('property runner', () => {
  it('shrinks to minimal counterexample', () => {
    const result = runProperty(gen.int(1, 100), () => false, { seed: 123, runs: 1, maxShrinks: 100 });
    expect(result.ok).toBe(false);
    expect(result.failure?.counterexample).toBe(1);
  });

  it('throws with seed and counterexample details', () => {
    expect(() => {
      fuzzAssert(gen.int(1, 10), () => false, { seed: 77, runs: 1, maxShrinks: 50 });
    }).toThrowError(/seed: 77/);
  });

  it('supports fuzz.property alias', () => {
    const result = fuzz.property(gen.bool(), () => true, { seed: 5, runs: 2 });
    expect(result.ok).toBe(true);
  });

  it('replays with a specific seed', () => {
    const expected = valueForSeed(11);
    let otherSeed = 12;
    while (otherSeed < 50 && valueForSeed(otherSeed) === expected) {
      otherSeed += 1;
    }
    const arbitrary = {
      generate: (localRng: () => number) => Math.floor(localRng() * 1000),
      shrink: () => []
    };
    const replayResult = runReplay(arbitrary, (value) => value === expected, { seed: 11, runs: 1 });
    expect(replayResult.ok).toBe(true);

    if (otherSeed < 50) {
      const nonReplayResult = runProperty(arbitrary, (value) => value === expected, { seed: otherSeed, runs: 1 });
      expect(nonReplayResult.ok).toBe(false);
    }
  });

  it('serializes failures', () => {
    const result = runProperty(gen.int(1, 10), () => false, { seed: 42, runs: 1, maxShrinks: 10 });
    expect(result.ok).toBe(false);
    const serialized = serializeFailure(result.failure!);
    expect(serialized.seed).toBe(42);
    expect(serialized.counterexample).toBe(1);
    expect(serialized.message).toContain('seed: 42');
    expect(serialized.replay).toContain('seed: 42');
  });

  it('formats serialized failures', () => {
    const result = runProperty(gen.int(1, 10), () => false, { seed: 42, runs: 1, maxShrinks: 10 });
    const serialized = serializeFailure(result.failure!);
    const formatted = formatSerializedFailure(serialized);
    expect(formatted).toContain('seed: 42');
    expect(formatted).toContain('replay:');
  });

  it('attaches failure metadata to thrown errors', () => {
    const error = catchError(() => fuzzAssert(gen.int(1, 10), () => false, { seed: 31, runs: 1, maxShrinks: 10 }));
    const typedError = error as Error & { fuzzFailure?: { seed: number } };
    expect(typedError.fuzzFailure?.seed).toBe(31);
  });

  it('includes replay hint in error message', () => {
    const error = catchError(() => fuzzAssert(gen.int(1, 10), () => false, { seed: 55, runs: 2, maxShrinks: 10 }));
    const typedError = error as Error;
    expect(typedError.message).toContain('replay:');
    expect(typedError.message).toContain('seed: 55');
  });
});

function catchError(action: () => void): unknown {
  try {
    action();
    throw new Error('Expected error to be thrown');
  } catch (error) {
    return error;
  }
}

function valueForSeed(seed: number): number {
  const randomSource = createSeededRandomSource(seed);
  return Math.floor(randomSource() * 1000);
}
