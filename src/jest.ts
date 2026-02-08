import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert, fuzzAssertAsync, generateSamples, formatTestName, type EachConfig } from './property.js';
import { assertModel, assertModelAsync, type ModelSpec, type AsyncModelSpec, type ModelConfig } from './model.js';

function fuzzItBase<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}

function fuzzItAsyncBase<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, async () => {
    await fuzzAssertAsync(arbitraryInput, predicate, config);
  });
}

function each<T>(arbitraryInput: Arbitrary<T> | Gen<T>, count: number, config?: EachConfig): (name: string, predicate: (value: T) => void) => void {
  const jestTest = getJestTest();
  const samples = generateSamples(arbitraryInput, count, config);
  return (name: string, predicate: (value: T) => void) => {
    for (const sample of samples) {
      jestTest(formatTestName(name, sample), () => {
        predicate(sample);
      });
    }
  };
}

function eachAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, count: number, config?: EachConfig): (name: string, predicate: (value: T) => void | Promise<void>) => void {
  const jestTest = getJestTest();
  const samples = generateSamples(arbitraryInput, count, config);
  return (name: string, predicate: (value: T) => void | Promise<void>) => {
    for (const sample of samples) {
      jestTest(formatTestName(name, sample), async () => {
        await predicate(sample);
      });
    }
  };
}

function model<Model, System>(name: string, spec: ModelSpec<Model, System>, config: ModelConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, () => {
    assertModel(spec, config);
  });
}

function modelAsync<Model, System>(name: string, spec: AsyncModelSpec<Model, System>, config: ModelConfig = {}): void {
  const jestTest = getJestTest();
  jestTest(name, async () => {
    await assertModelAsync(spec, config);
  });
}

/**
 * Run a property-based test in Jest.
 */
export const fuzzIt = Object.assign(fuzzItBase, { each, eachAsync, model, modelAsync });

/**
 * Run an async property-based test in Jest.
 */
export { fuzzItAsyncBase as fuzzItAsync };

function getJestTest(): (name: string, fn: () => void | Promise<void>) => void {
  const globalTest = (globalThis as unknown as { test?: (name: string, fn: () => void | Promise<void>) => void }).test;
  if (!globalTest) {
    throw new Error('Jest global test function is not available');
  }
  return globalTest;
}
