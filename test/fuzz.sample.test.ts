import { describe, expect } from 'vitest';
import { fuzzIt } from '../src/vitest.js';
import { gen } from '../src/generators.js';

describe('typefuzz sample', () => {
  fuzzIt('reverse is involutive', gen.array(gen.int(-10, 10), 10), (arr) => {
    const doubleReversed = [...arr].reverse().reverse();
    expect(doubleReversed).toEqual(arr);
  }, { runs: 200, seed: 12345 });
});
