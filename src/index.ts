export * from './generators.js';
export * from './core.js';
export * from './property.js';

import { fuzzAssert, runProperty, type PropertyFailure, type PropertyResult } from './property.js';
import type { Arbitrary, Gen, PropertyConfig } from './core.js';

/**
 * Ergonomic entrypoint for property testing.
 */
export const fuzz = {
  property<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): PropertyResult<T> {
    return runProperty(arb, predicate, config);
  },
  assert<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
    return fuzzAssert(arb, predicate, config);
  }
};

export type { PropertyFailure, PropertyResult };
