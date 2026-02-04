import { describe, expect, it } from 'vitest';
import { createRunState, createSeededRng } from '../src/core.js';

describe('core', () => {
  it('produces deterministic RNG values for the same seed', () => {
    const rngA = createSeededRng(1234);
    const rngB = createSeededRng(1234);
    const sequenceA = [rngA(), rngA(), rngA(), rngA(), rngA()];
    const sequenceB = [rngB(), rngB(), rngB(), rngB(), rngB()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it('normalizes runs and seed', () => {
    const state = createRunState({ seed: 99, runs: 5 });
    expect(state.seed).toBe(99);
    expect(state.runs).toBe(5);
  });

  it('rejects invalid run counts', () => {
    expect(() => createRunState({ runs: 0 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: -1 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: 1.5 })).toThrowError(RangeError);
    expect(() => createRunState({ runs: Number.NaN })).toThrowError(RangeError);
  });
});
