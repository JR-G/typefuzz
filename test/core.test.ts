import { describe, expect, it } from 'vitest';
import { createRunState, createSeededRandomSource } from '../src/core.js';

describe('core', () => {
  it('produces deterministic RNG values for the same seed', () => {
    const randomSourceA = createSeededRandomSource(1234);
    const randomSourceB = createSeededRandomSource(1234);
    const sequenceA = [randomSourceA(), randomSourceA(), randomSourceA(), randomSourceA(), randomSourceA()];
    const sequenceB = [randomSourceB(), randomSourceB(), randomSourceB(), randomSourceB(), randomSourceB()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it('normalizes runs and seed', () => {
    const state = createRunState({ seed: 99, runs: 5 });
    expect(state.seed).toBe(99);
    expect(state.runs).toBe(5);
  });

  it('handles seed=0 without degenerating', () => {
    const randomSource = createSeededRandomSource(0);
    const values = [randomSource(), randomSource(), randomSource()];
    const allZero = values.every((v) => v === 0);
    expect(allZero).toBe(false);
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('rejects invalid run counts', () => {
    expect(() => createRunState({ runs: 0 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: -1 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: 1.5 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: Number.NaN })).toThrowError(RangeError);
  });
});
