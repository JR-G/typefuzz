import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert, fuzzAssertAsync } from './property.js';

/**
 * Run a property-based test in Jest.
 */
export function fuzzIt<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}

/**
 * Run an async property-based test in Jest.
 */
export function fuzzItAsync<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, async () => {
    await fuzzAssertAsync(arbitraryInput, predicate, config);
  });
}

function getJestTest(): (name: string, fn: () => void | Promise<void>) => void {
  const globalTest = (globalThis as unknown as { test?: (name: string, fn: () => void | Promise<void>) => void }).test;
  if (!globalTest) {
    throw new Error('Jest global test function is not available');
  }
  return globalTest;
}
