import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert } from './property.js';

/**
 * Run a property-based test in Vitest.
 */
export function fuzzIt<T>(name: string, arb: Arbitrary<T> | Gen<T>, fn: (value: T) => boolean | void, cfg: PropertyConfig = {}): void {
  it(name, () => {
    fuzzAssert(arb, fn, cfg);
  });
}
