import { it as vitestIt } from 'vitest';
import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert } from './property.js';

/**
 * Run a property-based test in Vitest.
 */
export function fuzzIt<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  vitestIt(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}
