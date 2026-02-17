# Test Runner Integrations

## Vitest

```ts
import { fuzzIt } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzIt('sum is commutative', gen.tuple(gen.int(0, 10), gen.int(0, 10)), ([left, right]) => {
  return left + right === right + left;
}, { runs: 200, seed: 123 });
```

### Async Vitest

```ts
import { fuzzItAsync } from 'typefuzz/vitest';
import { gen } from 'typefuzz';

fuzzItAsync('async property', gen.int(1, 100), async (n) => {
  const result = await fetchSomething(n);
  return result.status === 200;
}, { runs: 50 });
```

## Parameterized tests with `.each`

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

No shrinking is performed for `.each` cases.

## Jest

```ts
import { fuzzIt } from 'typefuzz/jest';
import { gen } from 'typefuzz';

fuzzIt('reverse is involutive', gen.array(gen.int(0, 10), 5), (values) => {
  const doubleReversed = [...values].reverse().reverse();
  return JSON.stringify(doubleReversed) === JSON.stringify(values);
}, { runs: 200, seed: 123 });
```

The `.each`, `.eachAsync`, `model`, and `modelAsync` methods are available on the Jest adapter too.

## Model-based integration

```ts
import { fuzzIt } from 'typefuzz/vitest';

fuzzIt.model('counter behaves correctly', {
  state: () => ({ count: 0 }),
  setup: () => new Counter(),
  commands: [/* ... */]
}, { runs: 100 });

fuzzIt.modelAsync('async counter', { /* ... */ });
```
