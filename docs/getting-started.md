# Getting Started

## Installation

```sh
bun add typefuzz
```

## Tooling

This repository uses Bun for all commands:

```sh
bun install
bun run test
```

## Quickstart

```ts
import { fuzz, gen } from 'typefuzz';

fuzz.assert(gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 100, seed: 123 });
```

## Project structure

- `src/index.ts` core API
- `src/core.ts` core primitives and run-state utilities
- `src/property.ts` property execution, shrinking, replay, and sampling
- `src/vitest.ts` Vitest adapter
- `src/jest.ts` Jest adapter
- `src/generators.ts` built-in generators
- `src/model.ts` model-based testing
- `src/shrink-utils.ts` shared shrink helpers
- `src/zod.ts` Zod schema adapter
