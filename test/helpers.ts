import { createSeededRandomSource, type Arbitrary } from '../src/core.js';

export function generateValues<T>(arbitrary: Arbitrary<T>, seed: number, count: number): T[] {
  const randomSource = createSeededRandomSource(seed);
  return Array.from({ length: count }, () => arbitrary.generate(randomSource));
}

export function generateOne<T>(arbitrary: Arbitrary<T>, seed: number): T {
  return generateValues(arbitrary, seed, 1)[0];
}

export function keyCount(value: Record<string, unknown>): number {
  return Object.keys(value).length;
}

export function includesShorter(values: number[], original: number): boolean {
  return values.some((value) => value < original);
}

export function distances(values: number[], target: number): number[] {
  return values.map((value) => Math.abs(value - target));
}

export function isNonIncreasing(values: number[]): boolean {
  const initial = { ok: true, previous: Number.POSITIVE_INFINITY };
  return values.reduce((state, current) => ({
    ok: state.ok && current <= state.previous,
    previous: current
  }), initial).ok;
}
