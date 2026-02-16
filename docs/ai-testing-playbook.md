# AI Testing Playbook

This guide is designed for any AI coding agent that needs to add tests using TypeFuzz.

## Goals

- Prefer properties over single handpicked examples.
- Keep tests deterministic with explicit seeds.
- Keep failure output reproducible and actionable.

## Repo commands

```sh
bun run lint
bun run typecheck
bun run test
```

## Property test template (sync)

```ts
import { describe, expect } from 'vitest';
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

describe('feature name', () => {
  fuzzIt('property statement', gen.tuple(gen.int(-10, 10), gen.int(-10, 10)), ([a, b]) => {
    expect(a + b).toBe(b + a);
  }, { runs: 200, seed: 12345 });
});
```

## Property test template (async)

```ts
import { describe, expect } from 'vitest';
import { fuzzItAsync } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

describe('feature name', () => {
  fuzzItAsync('async property statement', gen.int(1, 50), async (n) => {
    const value = await Promise.resolve(n * 2);
    expect(value).toBeGreaterThan(0);
  }, { runs: 100, seed: 12345 });
});
```

## Parameterized example checks

Use `.each` when each generated input should be a separate test case and shrinking is not needed.

```ts
fuzzIt.each(gen.string(8), 8, { seed: 12345 })('input shape: %s', (value) => {
  expect(value.length).toBe(8);
});
```

## Model-based test template

```ts
import { describe } from 'vitest';
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

describe('counter model', () => {
  fuzzIt.model('counter matches model', {
    state: () => ({ value: 0 }),
    setup: () => ({ value: 0 }),
    commands: [
      {
        name: 'add',
        arbitrary: gen.int(1, 5),
        run: (system, model, n) => {
          system.value += n;
          model.value += n;
        },
        check: (system, model) => system.value === model.value
      }
    ]
  }, { runs: 100, maxCommands: 20, seed: 12345 });
});
```

## Failure reproduction protocol

When a generated test fails:

1. Keep the failure seed and run count from output.
2. Add or update a replay test using `fuzz.assertReplay` for minimal reproduction.
3. Fix behavior.
4. Keep one deterministic regression test with explicit seed.

## Heuristics for better generated tests

- Generate structured data with `gen.object`, `gen.record`, and `gen.tuple` instead of only primitive inputs.
- Add edge-biased domains deliberately: small/large numbers, empty/non-empty containers, optional values.
- Keep predicates pure when possible.
- Prefer `expect` assertions for clear failure messages.
- Start with `runs: 100-200` unless the property is expensive.
