import { createRunState, type RunConfig } from './core.js';
import type { Gen } from './generators.js';

/**
 * Run a property-based test in Vitest.
 */
export function fuzzIt<T>(name: string, gen: Gen<T>, fn: (value: T) => void, cfg: RunConfig = {}): void {
  const { runs, seed, rng } = createRunState(cfg);

  it(`${name} (seed ${seed})`, () => {
    for (let i = 0; i < runs; i += 1) {
      const value = gen(rng);
      fn(value);
    }
  });
}
