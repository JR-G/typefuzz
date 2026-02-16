# Core Property API

- `fuzz.assert(arbitrary, predicate, config?)` run a property and throw on failure
- `fuzz.property(arbitrary, predicate, config?)` run and return a result
- `fuzz.replay(arbitrary, predicate, { seed, runs })` replay a property
- `fuzz.assertReplay(arbitrary, predicate, { seed, runs })` replay and throw on failure
- `fuzz.samples(arbitrary, count, config?)` generate N values from an arbitrary
- `fuzz.serializeFailure(failure)` JSON-friendly failure payload
- `fuzz.formatSerializedFailure(payload)` human-readable failure string

## Async API

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

## Defaults

- `runs`: 100
- `maxShrinks`: 1000
- `gen.string(length)`: 8
- `gen.array(item, length)`: 5
