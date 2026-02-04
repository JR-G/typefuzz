export * from './generators.js';
export * from './core.js';
export * from './property.js';

import {
  fuzzAssert,
  fuzzReplay,
  runProperty,
  runReplay,
  serializeFailure,
  type PropertyFailure,
  type PropertyResult,
  type SerializedFailure
} from './property.js';
import type { Arbitrary, Gen, PropertyConfig } from './core.js';
import type { ReplayConfig } from './property.js';

/**
 * Ergonomic entrypoint for property testing.
 */
export const fuzz = {
  property<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): PropertyResult<T> {
    return runProperty(arb, predicate, config);
  },
  assert<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
    return fuzzAssert(arb, predicate, config);
  },
  replay<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): PropertyResult<T> {
    return runReplay(arb, predicate, config);
  },
  assertReplay<T>(arb: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): void {
    return fuzzReplay(arb, predicate, config);
  },
  serializeFailure<T>(failure: PropertyFailure<T>): SerializedFailure<T> {
    return serializeFailure(failure);
  }
};

export type { PropertyFailure, PropertyResult };
export type { SerializedFailure };
