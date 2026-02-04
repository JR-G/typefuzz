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
