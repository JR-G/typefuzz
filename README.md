# typefuzz

TypeScript-first fuzz/property testing utilities with test runner integrations.

## Quickstart

```ts
import { fuzz, gen } from 'typefuzz';

fuzz.assert(gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 100, seed: 123 });
```

## Status

Early scaffolding. The API is not stable yet.

## API stability

Expect breaking changes while the API evolves. The goal is to stabilize core generators and the `fuzz` API before cutting a public release.

## Tooling

This repo uses Bun for all commands.

```sh
bun install
bun run test
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

## Goals

- Simple property-based test helper for Vitest and Jest
- Deterministic seeding + replay
- Shrinking of failing cases
- Optional schema adapters (zod/typebox/io-ts)

## Generators

- `gen.int(min, max)` inclusive integer generator
- `gen.float(min, max)` float generator in `[min, max)`
- `gen.bool()` boolean generator
- `gen.string(length)` lowercase alphanumeric string
- `gen.uuid()` UUID v4 string
- `gen.email()` basic email address
- `gen.date(min, max)` date generator within bounds
- `gen.array(item, length)` fixed-length arrays
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

## Core API

- `fuzz.assert(arbitrary, predicate, config?)` run a property and throw on failure
- `fuzz.property(arbitrary, predicate, config?)` run and return a result
- `fuzz.replay(arbitrary, predicate, { seed, runs })` replay a property
- `fuzz.assertReplay(arbitrary, predicate, { seed, runs })` replay and throw on failure
- `fuzz.serializeFailure(failure)` JSON-friendly failure payload
- `fuzz.formatSerializedFailure(payload)` human-readable failure string

## Roadmap (MVP)

- `fuzzIt` wrapper for Vitest
- Core generators for primitives/arrays/objects
- Seeded RNG and reproducible failures
- Minimal shrinkers for common types

## Structure

- `src/index.ts` core API
- `src/vitest.ts` Vitest adapter
- `src/jest.ts` Jest adapter
- `src/generators.ts` built-in generators

## Test runner usage

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt('sum is commutative', gen.tuple(gen.int(0, 10), gen.int(0, 10)), ([left, right]) => {
  return left + right === right + left;
}, { runs: 200, seed: 123 });
```

### Jest

```ts
import { fuzzIt } from 'typefuzz/jest';
import { gen } from 'typefuzz';

fuzzIt('reverse is involutive', gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 200, seed: 123 });
```

## Shrinking behavior

When a property fails, Typefuzz attempts to shrink the counterexample by reducing sizes (arrays, records, sets) and moving numbers/dates toward smaller values. The final counterexample is the smallest failing case found within the shrink budget.

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

## FAQ

Why do some generators throw?  
Generators that require bounds (like `gen.int` or `gen.date`) validate inputs eagerly to surface errors early.

How deterministic are failures?  
Failures include a seed and run count. Use `fuzz.assertReplay` to reproduce the same counterexample path.

Do I need Zod?  
No. The Zod adapter is optional; core generators and fuzz helpers do not depend on it.

## Conventions

- Inclusive bounds: `gen.int(min, max)` and `gen.date(min, max)` include both ends.
- Half-open ranges: `gen.float(min, max)` generates values in `[min, max)`.
- Fixed sizes: `gen.array(item, length)` creates fixed-length arrays; use `gen.uniqueArray` for variable length with uniqueness.

## Design notes

Typefuzz prioritizes deterministic generation and shrinking. Shrinkers try smaller sizes first and then smaller values; the shrink budget (`maxShrinks`) bounds the total attempts.
