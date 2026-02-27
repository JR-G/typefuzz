<p align="center">
  <img src="https://raw.githubusercontent.com/JR-G/typefuzz/main/logo.png" alt="TypeFuzz" width="360" />
</p>

<p align="center">
  <a href="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml"><img src="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/typefuzz"><img src="https://img.shields.io/npm/v/typefuzz" alt="npm version" /></a>
  <a href="https://github.com/JR-G/typefuzz/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

# TypeFuzz

Property-based testing for TypeScript that drops straight into your existing test runner. No wrappers, no config — write fuzz tests like you write unit tests.

## Why TypeFuzz?

- **Test runner integration** — `fuzzIt` works like `it`/`test` inside Vitest and Jest. No separate CLI.
- **Zero dependencies** — ships nothing you don't need. Vitest, Jest, and Zod are optional peer deps.
- **TypeScript-first** — full type inference from generators to predicates. No casting.
- **Deterministic** — seeded RNG means every failure is reproducible with a single seed value.
- **Built-in shrinking** — automatic counterexample minimisation using binary search, length reduction, and delta debugging.

## Install

```sh
npm install -D typefuzz
```

<details>
<summary>Other package managers</summary>

```sh
pnpm add -D typefuzz
yarn add -D typefuzz
bun add -D typefuzz
```

</details>

## Quick example

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt('sort is idempotent', gen.array(gen.int(-100, 100), { minLength: 0, maxLength: 50 }), (arr) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const sortedTwice = [...sorted].sort((a, b) => a - b);
  return JSON.stringify(sorted) === JSON.stringify(sortedTwice);
});
```

If the property fails, TypeFuzz shrinks the input to the smallest counterexample and prints the seed for replay.

## TypeFuzz vs fast-check

| | TypeFuzz | fast-check |
| --- | --- | --- |
| Test runner integration | `fuzzIt` — one function, same signature as `it` | `@fast-check/vitest` with `test.prop` |
| API surface | Small, opinionated | Large, highly configurable |
| Shrinking | Binary search + delta debugging | Shrink-on-generate |
| Model-based testing | Built-in | Built-in |
| Zod integration | `typefuzz/zod` adapter | Community `zod-fast-check` |
| Async support | Native | Native |

## Features

### Model-based testing

Test stateful systems against a simplified model. TypeFuzz generates random command sequences, runs them against both your system and the model, and shrinks failing sequences to the shortest reproduction. [Read more &rarr;](./docs/model-based-testing.md)

### Zod adapter

Already have Zod schemas? Generate test data directly from them with `zodArbitrary`. Supports objects, arrays, unions, discriminated unions, transforms, and more. [Read more &rarr;](./docs/zod-adapter.md)

### Shrinking

When a property fails, TypeFuzz automatically minimises the counterexample — binary search for numbers, length halving for strings and arrays, delta debugging for model-based command sequences. [Read more &rarr;](./docs/shrinking-and-replay.md)

## Documentation

- [Documentation Index](./docs/index.md)
- [Getting Started](./docs/getting-started.md)
- [Generators](./docs/generators.md)
- [Core API](./docs/core-api.md)
- [Test Runner Integrations](./docs/test-runners.md)
- [Model-Based Testing](./docs/model-based-testing.md)
- [Zod Adapter](./docs/zod-adapter.md)
- [Shrinking and Replay](./docs/shrinking-and-replay.md)
- [FAQ](./docs/faq.md)
- [Releasing](./docs/releasing.md)
- [AI Testing Playbook](./docs/ai-testing-playbook.md)
- [AI Agent Compatibility](./docs/ai-agent-compatibility.md)
- [Agent Instructions](./AGENTS.md)
- [LLM Index](./llms.txt)

## Development

```sh
bun install
bun run lint
bun run typecheck
bun run test
```

## Licence

[MIT](./LICENSE)
