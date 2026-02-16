<p align="center">
  <img src="https://raw.githubusercontent.com/JR-G/typefuzz/main/logo.png" alt="TypeFuzz" width="360" />
</p>

<p align="center">
  <a href="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml"><img src="https://github.com/JR-G/typefuzz/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/typefuzz"><img src="https://img.shields.io/npm/v/typefuzz" alt="npm version" /></a>
  <a href="https://github.com/JR-G/typefuzz/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

# TypeFuzz

TypeScript-first fuzz/property testing utilities with Vitest/Jest integrations, shrinking, replay, and model-based testing.

## Installation

```sh
bun add typefuzz
```

## Quickstart

```ts
import { fuzz, gen } from 'typefuzz';

fuzz.assert(gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 100, seed: 123 });
```

## Test runner usage

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt('sum is commutative', gen.tuple(gen.int(0, 10), gen.int(0, 10)), ([left, right]) => {
  return left + right === right + left;
}, { runs: 200, seed: 123 });
```

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
