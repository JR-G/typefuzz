# Shrinking and Replay

When a property fails, TypeFuzz attempts to shrink the counterexample by reducing sizes (arrays, records, sets) and moving numbers/dates toward smaller values. The final counterexample is the smallest failing case found within the configured shrink budget.

For model-based tests, shrinking runs in two stages:

1. Delta-debugging chunk removal to find a shorter failing command sequence.
2. Parameter shrinking for each command parameter in the sequence.

These stages repeat until no further improvement is found or the shrink budget is exhausted.

## Design notes

TypeFuzz prioritizes deterministic generation and shrinking. Shrinkers try smaller sizes first and then smaller values; the shrink budget (`maxShrinks`) bounds total shrink attempts.

## Reproduce failures

Persist the seed and run count from a failure and replay with:

```ts
fuzz.assertReplay(arbitrary, predicate, { seed, runs });
```

For model-based failures, replay with:

```ts
fuzz.model(spec, { seed, runs });
```
