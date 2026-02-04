import { createSeededRng, type RunConfig } from './core.js';
import type { Gen } from './generators.js';

export function fuzzIt<T>(name: string, gen: Gen<T>, fn: (value: T) => void, cfg: RunConfig = {}): void {
  const runs = cfg.runs ?? 100;
  const seed = cfg.seed ?? Date.now();
  const rng = createSeededRng(seed);

  test(`${name} (seed ${seed})`, () => {
    for (let i = 0; i < runs; i += 1) {
      const value = gen(rng);
      fn(value);
    }
  });
}
