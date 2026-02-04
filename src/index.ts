export * from './generators.js';
export * from './core.js';
export * from './property.js';

import {
  fuzzAssert,
  fuzzReplay,
  runProperty,
  runReplay,
  formatSerializedFailure,
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
  property<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): PropertyResult<T> {
    return runProperty(arbitraryInput, predicate, config);
  },
  assert<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
    return fuzzAssert(arbitraryInput, predicate, config);
  },
  replay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): PropertyResult<T> {
    return runReplay(arbitraryInput, predicate, config);
  },
  assertReplay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): void {
    return fuzzReplay(arbitraryInput, predicate, config);
  },
  serializeFailure<T>(failure: PropertyFailure<T>): SerializedFailure<T> {
    return serializeFailure(failure);
  },
  formatSerializedFailure<T>(failure: SerializedFailure<T>): string {
    return formatSerializedFailure(failure);
  }
};

export type { PropertyFailure, PropertyResult };
export type { SerializedFailure };
