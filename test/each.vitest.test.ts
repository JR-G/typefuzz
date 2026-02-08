import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { fuzzIt } from '../src/vitest.js';
import { generateSamples, formatTestName } from '../src/property.js';

describe('generateSamples', () => {
  it('generates the requested number of samples', () => {
    const samples = generateSamples(gen.int(1, 100), 10, { seed: 42 });
    expect(samples).toHaveLength(10);
    samples.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(100);
    });
  });

  it('is deterministic with the same seed', () => {
    const a = generateSamples(gen.int(0, 1000), 5, { seed: 99 });
    const b = generateSamples(gen.int(0, 1000), 5, { seed: 99 });
    expect(a).toEqual(b);
  });

  it('produces different values with different seeds', () => {
    const a = generateSamples(gen.int(0, 1000), 5, { seed: 1 });
    const b = generateSamples(gen.int(0, 1000), 5, { seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('works with plain generator functions', () => {
    const samples = generateSamples((rng) => Math.floor(rng() * 10), 3, { seed: 7 });
    expect(samples).toHaveLength(3);
    samples.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(10);
    });
  });
});

describe('formatTestName', () => {
  it('replaces %s with the value', () => {
    expect(formatTestName('value is %s', 42)).toBe('value is 42');
  });

  it('formats objects as compact JSON', () => {
    expect(formatTestName('got %s', { a: 1 })).toBe('got {"a":1}');
  });

  it('truncates long values at 80 chars', () => {
    const longValue = 'x'.repeat(100);
    const result = formatTestName('val: %s', longValue);
    expect(result.length).toBeLessThanOrEqual(4 + 80 + 2);
    expect(result).toContain('...');
  });

  it('handles arrays', () => {
    expect(formatTestName('arr %s', [1, 2, 3])).toBe('arr [1,2,3]');
  });
});

describe('fuzzIt.each', () => {
  fuzzIt.each(gen.int(1, 100), 5, { seed: 42 })('is positive: %s', (n) => {
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(100);
  });
});

describe('fuzzIt.eachAsync', () => {
  fuzzIt.eachAsync(gen.int(1, 50), 3, { seed: 7 })('async positive: %s', async (n) => {
    await Promise.resolve();
    expect(n).toBeGreaterThan(0);
  });
});
