import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert } from './property.js';

/**
 * Run a property-based test in Vitest.
 */
export function fuzzIt<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  it(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}
