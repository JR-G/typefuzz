import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert } from './property.js';

/**
 * Run a property-based test in Jest.
 */
export function fuzzIt<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}

function getJestTest(): (name: string, fn: () => void) => void {
  const globalTest = (globalThis as unknown as { test?: (name: string, fn: () => void) => void }).test;
  if (!globalTest) {
    throw new Error('Jest global test function is not available');
  }
  return globalTest;
}
