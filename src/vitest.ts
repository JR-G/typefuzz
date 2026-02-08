import { it as vitestIt } from 'vitest';
import { type Arbitrary, type Gen, type PropertyConfig } from './core.js';
import { fuzzAssert, fuzzAssertAsync, generateSamples, formatTestName, type EachConfig } from './property.js';
import { assertModel, assertModelAsync, type ModelSpec, type AsyncModelSpec, type ModelConfig } from './model.js';

function fuzzItBase<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void, config: PropertyConfig = {}): void {
  vitestIt(name, () => {
    fuzzAssert(arbitraryInput, predicate, config);
  });
}

function fuzzItAsyncBase<T>(name: string, arbitraryInput: Arbitrary<T> | Gen<T>, predicate: (value: T) => boolean | void | Promise<boolean | void>, config: PropertyConfig = {}): void {
  vitestIt(name, async () => {
    await fuzzAssertAsync(arbitraryInput, predicate, config);
  });
}

function each<T>(arbitraryInput: Arbitrary<T> | Gen<T>, count: number, config?: EachConfig): (name: string, predicate: (value: T) => void) => void {
  const samples = generateSamples(arbitraryInput, count, config);
  return (name: string, predicate: (value: T) => void) => {
    for (const sample of samples) {
      vitestIt(formatTestName(name, sample), () => {
        predicate(sample);
      });
    }
  };
}

function eachAsync<T>(arbitraryInput: Arbitrary<T> | Gen<T>, count: number, config?: EachConfig): (name: string, predicate: (value: T) => void | Promise<void>) => void {
  const samples = generateSamples(arbitraryInput, count, config);
  return (name: string, predicate: (value: T) => void | Promise<void>) => {
    for (const sample of samples) {
      vitestIt(formatTestName(name, sample), async () => {
        await predicate(sample);
      });
    }
  };
}

function model<Model, System>(name: string, spec: ModelSpec<Model, System>, config: ModelConfig = {}): void {
  vitestIt(name, () => {
    assertModel(spec, config);
  });
}

function modelAsync<Model, System>(name: string, spec: AsyncModelSpec<Model, System>, config: ModelConfig = {}): void {
  vitestIt(name, async () => {
    await assertModelAsync(spec, config);
  });
}

/**
 * Run a property-based test in Vitest.
 */
export const fuzzIt = Object.assign(fuzzItBase, { each, eachAsync, model, modelAsync });

/**
 * Run an async property-based test in Vitest.
 */
export { fuzzItAsyncBase as fuzzItAsync };
