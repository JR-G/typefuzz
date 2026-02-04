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

## Roadmap (MVP)

- `fuzz.it` wrapper for Vitest
- Core generators for primitives/arrays/objects
- Seeded RNG and reproducible failures
- Minimal shrinkers for common types

## Structure

- `src/index.ts` core API
- `src/vitest.ts` Vitest adapter
- `src/jest.ts` Jest adapter
- `src/generators.ts` built-in generators
