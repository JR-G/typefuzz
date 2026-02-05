import { it as vitestIt } from 'vitest';
import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert, fuzzAssertAsync } from './property.js';

/**
 * Run a property-based test in Vitest.
 */
export function fuzzIt<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  vitestIt(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}

/**
 * Run an async property-based test in Vitest.
 */
export function fuzzItAsync<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): void {
  vitestIt(name, async () => {
    await fuzzAssertAsync(arbitraryInput, predicate, config);
  });
}
