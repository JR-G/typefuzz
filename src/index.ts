export * from './generators.js';
export * from './core.js';
export * from './property.js';

import {
  fuzzAssert,
  fuzzAssertAsync,
  fuzzReplay,
  fuzzReplayAsync,
  runProperty,
  runPropertyAsync,
  runReplay,
  runReplayAsync,
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
  propertyAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): Promise<PropertyResult<T>> {
    return runPropertyAsync(arbitraryInput, predicate, config);
  },
  assert<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
    return fuzzAssert(arbitraryInput, predicate, config);
  },
  assertAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): Promise<void> {
    return fuzzAssertAsync(arbitraryInput, predicate, config);
  },
  replay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): PropertyResult<T> {
    return runReplay(arbitraryInput, predicate, config);
  },
  replayAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: ReplayConfig): Promise<PropertyResult<T>> {
    return runReplayAsync(arbitraryInput, predicate, config);
  },
  assertReplay<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: ReplayConfig): void {
    return fuzzReplay(arbitraryInput, predicate, config);
  },
  assertReplayAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: ReplayConfig): Promise<void> {
    return fuzzReplayAsync(arbitraryInput, predicate, config);
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
