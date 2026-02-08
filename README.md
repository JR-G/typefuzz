<p align="center">
  <img src="https://raw.githubusercontent.com/JR-G/typefuzz/main/logo.png" alt="TypeFuzz" width="360" />
</p>

<p align="center">
  <a href="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml"><img src="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/typefuzz"><img src="https://img.shields.io/npm/v/typefuzz" alt="npm version" /></a>
  <a href="https://github.com/JR-G/typefuzz/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

# TypeFuzz

TypeScript-first fuzz/property testing utilities with test runner integrations.

## Quickstart

```ts
import { fuzz, gen } from 'typefuzz';

fuzz.assert(gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 100, seed: 123 });
```

## Installation

```sh
bun add typefuzz
```

## Tooling

This repo uses Bun for all commands.

```sh
bun install
bun run test
```

## Generators

- `gen.int(min, max)` inclusive integer generator
- `gen.float(min, max)` float generator in `[min, max)`
- `gen.bigint(min, max)` inclusive bigint generator (defaults `0n`–`100n`)
- `gen.bool()` boolean generator
- `gen.string(lengthOrOptions)` string from a character set
- `gen.uuid()` UUID v4 string
- `gen.email()` basic email address
- `gen.date(min, max)` date generator within bounds
- `gen.array(item, length)` fixed-length arrays
- `gen.array(item, { minLength, maxLength })` variable-length arrays
- `gen.uniqueArray(item, { minLength, maxLength })` unique arrays
- `gen.object(shape)` object from generator map
- `gen.record(value, { minKeys, maxKeys })` record with string keys
- `gen.dictionary(key, value, { minKeys, maxKeys })` dictionary with custom keys
- `gen.set(value, { minSize, maxSize })` set generator
- `gen.oneOf(...options)` random choice
- `gen.weightedOneOf(options)` weighted choice
- `gen.frequency(options)` alias for `weightedOneOf`
- `gen.tuple(...items)` heterogeneous tuple
- `gen.optional(item, probability)` optional values
- `gen.constant(value)` constant generator
- `gen.constantFrom(...values)` constant choice
- `gen.map(item, mapper, unmap?)` map values
- `gen.filter(item, predicate, maxAttempts?)` filter values

### `gen.string` charsets

The default character set is lowercase alphanumeric. Use an options object to pick a different set:

```ts
gen.string(8);                                   // 'alphanumeric' (default)
gen.string({ length: 16, charset: 'hex' });      // 0-9a-f
gen.string({ length: 6, charset: 'alpha' });     // a-z
gen.string({ length: 4, charset: 'numeric' });   // 0-9
gen.string({ length: 10, charset: 'ascii' });    // printable ASCII
gen.string({ length: 8, chars: 'ABC123' });      // custom character pool
```

Predefined charsets: `'alphanumeric'`, `'alpha'`, `'hex'`, `'numeric'`, `'ascii'`.

## Core API

- `fuzz.assert(arbitrary, predicate, config?)` run a property and throw on failure
- `fuzz.property(arbitrary, predicate, config?)` run and return a result
- `fuzz.replay(arbitrary, predicate, { seed, runs })` replay a property
- `fuzz.assertReplay(arbitrary, predicate, { seed, runs })` replay and throw on failure
- `fuzz.samples(arbitrary, count, config?)` generate N values from an arbitrary
- `fuzz.serializeFailure(failure)` JSON-friendly failure payload
- `fuzz.formatSerializedFailure(payload)` human-readable failure string

### Async API

All core methods have async variants that accept async predicates:

- `fuzz.assertAsync(arbitrary, predicate, config?)`
- `fuzz.propertyAsync(arbitrary, predicate, config?)`
- `fuzz.replayAsync(arbitrary, predicate, { seed, runs })`
- `fuzz.assertReplayAsync(arbitrary, predicate, { seed, runs })`

```ts
await fuzz.assertAsync(gen.int(1, 100), async (n) => {
  const result = await someAsyncCheck(n);
  return result.ok;
}, { runs: 50 });
```

## Test runner usage

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt('sum is commutative', gen.tuple(gen.int(0, 10), gen.int(0, 10)), ([left, right]) => {
  return left + right === right + left;
}, { runs: 200, seed: 123 });
```

### Async test runner usage

```ts
import { fuzzItAsync } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzItAsync('async property', gen.int(1, 100), async (n) => {
  const result = await fetchSomething(n);
  return result.status === 200;
}, { runs: 50 });
```

### Parameterised tests with `.each`

Generate N values and register each as a separate test case, similar to `it.each`:

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt.each(gen.int(1, 100), 10, { seed: 42 })('is positive: %s', (n) => {
  expect(n).toBeGreaterThan(0);
});
```

`%s` in the test name is replaced with a compact JSON representation of the value. An async variant is also available:

```ts
fuzzIt.eachAsync(gen.string(8), 5)('validates: %s', async (s) => {
  const result = await validate(s);
  expect(result.ok).toBe(true);
});
```

No shrinking is performed — each case is a standalone test.

### Jest

```ts
import { fuzzIt } from 'typefuzz/jest';
import { gen } from 'typefuzz';

fuzzIt('reverse is involutive', gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 200, seed: 123 });
```

The `.each` and `.eachAsync` methods are available on the Jest adapter too.

## Model-based testing

Model-based testing verifies a stateful system against a simplified model. Typefuzz generates random command sequences, executes them against both the system and the model, and checks that the system matches the model after each step.

```ts
import { fuzz, gen } from 'typefuzz';

class Counter {
  value = 0;
  add(n: number) { this.value += n; }
  reset() { this.value = 0; }
}

const result = fuzz.model({
  state: () => ({ count: 0 }),
  setup: () => new Counter(),
  commands: [
    {
      name: 'increment',
      arbitrary: gen.int(1, 5),
      run: (counter, model, n) => { counter.add(n); model.count += n; },
      check: (counter, model) => counter.value === model.count
    },
    {
      name: 'reset',
      run: (counter, model) => { counter.reset(); model.count = 0; },
      check: (counter, model) => counter.value === 0,
      precondition: (model) => model.count > 0
    }
  ]
}, { runs: 100, maxCommands: 20 });
```

### How it works

Each iteration creates a fresh model (via `state()`) and a fresh system (via `setup()`), then runs a random sequence of commands. For each step:

1. Filter commands by `precondition` (if defined)
2. Pick a random eligible command
3. Generate a parameter (if the command has an `arbitrary`)
4. Call `run(system, model, param)` to apply side effects
5. Call `check(system, model, param)` — if it returns `false` or throws, the sequence fails

On failure, the sequence is shrunk using delta-debugging chunk removal (tries removing contiguous chunks of decreasing size) followed by element-wise parameter shrinking, looping until convergence.

### Commands

A command has:

- `name` — used in failure output
- `arbitrary?` — generator for the command's parameter (omit for parameterless commands)
- `precondition?` — guard; command is only eligible when this returns `true`
- `run(system, model, param)` — apply the operation to both system and model
- `check(system, model, param)` — return `false` to signal failure, or use expect-style assertions (throw on mismatch). Returning `true` or `void` counts as passing.

### Configuration

- `runs` — number of iterations (default 100)
- `maxCommands` — max commands per sequence (default 20)
- `maxShrinks` — shrink budget (default 1000)
- `seed` — RNG seed for reproducibility

### Teardown

Provide an optional `teardown(system)` to clean up after each iteration. Called in a `finally` block so it runs even when the sequence fails or during shrink replays.

### Failure output

```
model-based test failed after 37/100 runs
seed: 42
shrinks: 15
command sequence:
  1. increment(1)
  2. buggyReset  <-- check failed
replay: fuzz.model(spec, { seed: 42, runs: 100 })
```

### API

- `fuzz.model(spec, config?)` — run and return `ModelResult`
- `fuzz.modelAsync(spec, config?)` — async variant
- `fuzz.assertModel(spec, config?)` — run and throw on failure
- `fuzz.assertModelAsync(spec, config?)` — async variant
- `fuzz.serializeModelFailure(failure)` — JSON-friendly failure payload

### Test runner integration

```ts
import { fuzzIt } from 'typefuzz/vitest';

fuzzIt.model('counter behaves correctly', {
  state: () => ({ count: 0 }),
  setup: () => new Counter(),
  commands: [/* ... */]
}, { runs: 100 });

// Async variant
fuzzIt.modelAsync('async counter', { /* ... */ });
```

## Zod adapter (optional)

```ts
import { z } from 'zod';
import { zodArbitrary } from 'typefuzz/zod';

const schema = z.object({
  name: z.string().min(2).max(5),
  count: z.number().int().min(1).max(3)
});

const arb = zodArbitrary(schema);
```

### Supported Zod types

- `z.string`
- `z.number` (incl. `int`)
- `z.boolean`
- `z.array`
- `z.object`
- `z.record`
- `z.tuple`
- `z.union`
- `z.discriminatedUnion`
- `z.literal`
- `z.enum`
- `z.nativeEnum`
- `z.optional`
- `z.nullable`
- `z.map`
- `z.set`
- `z.bigint`
- `z.date`
- `z.lazy`
- `z.default`
- `z.any` / `z.unknown`
- `z.effects` (transforms, refinements, preprocess)
- `z.undefined` / `z.void`

## Shrinking behaviour

When a property fails, typefuzz attempts to shrink the counterexample by reducing sizes (arrays, records, sets) and moving numbers/dates toward smaller values. The final counterexample is the smallest failing case found within the shrink budget.

For model-based tests, shrinking uses delta-debugging chunk removal to find the shortest failing command sequence, then shrinks individual parameter values. Both phases loop until no further improvement is found.

## Replay failures

```ts
import { fuzz, gen } from 'typefuzz';

const arbitrary = gen.array(gen.int(0, 10), 5);
const predicate = (values: number[]) => values.length === 0;

// Replay a known failing seed
fuzz.assertReplay(arbitrary, predicate, { seed: 123, runs: 100 });
```

## Failure output

```ts
import { fuzz, gen } from 'typefuzz';

const result = fuzz.property(gen.int(1, 10), () => false, { seed: 42, runs: 1 });
if (!result.ok && result.failure) {
  const serialized = fuzz.serializeFailure(result.failure);
  console.log(fuzz.formatSerializedFailure(serialized));
}
```

## Structure

- `src/index.ts` core API
- `src/vitest.ts` Vitest adapter
- `src/jest.ts` Jest adapter
- `src/generators.ts` built-in generators
- `src/model.ts` model-based testing
- `src/zod.ts` Zod schema adapter

## FAQ

Why do some generators throw?
Generators that require bounds (like `gen.int` or `gen.date`) validate inputs eagerly to surface errors early.

How deterministic are failures?
Failures include a seed and run count. Use `fuzz.assertReplay` to reproduce the same counterexample path.

Do I need Zod?
No. The Zod adapter is optional; core generators and fuzz helpers do not depend on it.

## Conventions

- Inclusive bounds: `gen.int(min, max)`, `gen.bigint(min, max)`, and `gen.date(min, max)` include both ends.
- Half-open ranges: `gen.float(min, max)` generates values in `[min, max)`.
- Fixed or variable arrays: `gen.array(item, length)` for fixed-length, `gen.array(item, { minLength, maxLength })` for variable-length.

## Defaults

- `runs`: 100
- `maxShrinks`: 1000
- `maxCommands`: 20 (model-based testing)
- `gen.string(length)`: 8
- `gen.array(item, length)`: 5

## Design notes

Typefuzz prioritises deterministic generation and shrinking. Shrinkers try smaller sizes first and then smaller values; the shrink budget (`maxShrinks`) bounds the total attempts.
