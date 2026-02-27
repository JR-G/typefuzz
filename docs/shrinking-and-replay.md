# Shrinking and Replay

When a property test fails, the initial counterexample is often large and noisy. TypeFuzz automatically shrinks it — producing the smallest input that still triggers the failure.

## How shrinking works

After finding a failing input, TypeFuzz runs a **fixed-point shrink loop**:

1. Generate a set of smaller candidates from the current counterexample.
2. Test each candidate against the property.
3. If any candidate still fails, replace the counterexample with the best (smallest) failing candidate.
4. Repeat from step 1 until no further improvement is found or the shrink budget is exhausted.

"Smallest" is determined by a scoring function: absolute value for numbers, length for strings and arrays, JSON size for objects.

## Per-type shrink strategies

### Numbers (integers and floats)

Binary search toward a target value. The target is `0` if it falls within the generator's range, otherwise the range minimum.

```
gen.int(0, 100) — failing value: 87

87 → 43 → 21 → 10 → 5 → 2 → 1 → 0
```

Floats use the same binary search but converge with floating-point midpoints (capped at 20 iterations to avoid infinite bisection).

### Strings

Exponential length halving. The empty string is tried first, then progressively longer prefixes:

```
gen.string(8) — failing value: "k9f2m1xp"

"k9f2m1xp" → "" → "k9f2" → "k9" → "k"
```

The shrinker tries the empty string, then half the original length, then a quarter, and so on.

### Arrays

Two phases — length shrinking first, then element shrinking:

1. **Length shrinking**: try progressively shorter prefixes (half, quarter, eighth, ... down to empty).
2. **Element shrinking**: for each element, try replacing it with its own shrunk candidates.

```
gen.array(gen.int(0, 100), 5) — failing value: [87, 42, 3, 91, 15]

Length:   [87, 42, 3, 91, 15] → [87, 42] → [87]
Element:  [87] → [43] → [21] → [10] → [5] → [2] → [1] → [0]
```

### Objects

Recursive field shrinking. Each field is shrunk independently using the shrinker for its generator. Fields are tried in declaration order; the first improvement restarts the loop.

```
gen.object({ id: gen.int(1, 100), name: gen.string(5) })

{ id: 73, name: "ab2xq" } → { id: 36, name: "ab2xq" } → { id: 36, name: "" } → { id: 18, name: "" } → ...
```

### Records, sets, and dictionaries

These use the same two-phase approach as arrays: size shrinking (removing entries) followed by value shrinking (minimising individual entries). Dictionaries also shrink keys.

### Booleans

`true` shrinks to `false`. `false` does not shrink.

### Dates and BigInts

Binary search toward the epoch (`1970-01-01T00:00:00.000Z`) for dates, or toward `0n` for bigints, using the same strategy as integers.

## Shrink budget

The `maxShrinks` option (default: `1000`) limits the total number of candidates tested during shrinking. Each candidate evaluation counts as one shrink attempt.

```ts
fuzz.assert(gen.int(0, 1000), (n) => n < 500, {
  maxShrinks: 5000
});
```

When to increase it:

- Complex nested structures where each round produces many candidates.
- Model-based tests with long command sequences.
- When you see a counterexample that looks like it could be simpler.

When to decrease it:

- Slow predicates (e.g. network calls) where each shrink attempt is expensive.
- When you just need a quick signal and don't need the minimal case.

## Model-based shrinking

Model-based tests shrink command sequences in two phases, wrapped in a fixed-point loop:

### Phase 1: Chunk removal (delta debugging)

Remove contiguous chunks of commands from the sequence. Start with chunks of half the sequence length, try every position. If a removal succeeds (the shorter sequence still fails), restart with larger chunks since the shorter sequence might allow even bigger removals. If no removal helps at a given chunk size, halve the chunk size and try again, down to single-step removal.

```
Original sequence (12 commands):
  add(5), remove(3), add(1), clear, add(7), remove(2),
  add(4), clear, add(9), remove(1), add(3), check

After chunk removal (3 commands):
  add(5), clear, check
```

### Phase 2: Parameter shrinking

After the sequence is as short as possible, shrink each command's parameters using the per-type strategies above. Loop through all steps; when any parameter shrinks successfully, restart from the beginning.

```
After parameter shrinking:
  add(0), clear, check
```

The two phases alternate in a fixed-point loop: chunk removal → parameter shrinking → chunk removal → ... until neither phase makes progress or the budget runs out.

## Failure output

### Property tests

```
property failed after 37/100 runs
seed: 42
shrinks: 12
counterexample: 0
replay: fuzz.assert(arbitrary, predicate, { seed: 42, runs: 100 })
```

| Field | Meaning |
| --- | --- |
| `37/100 runs` | Failed on iteration 37 out of 100 |
| `seed: 42` | RNG seed — pass this to `seed` to reproduce |
| `shrinks: 12` | Number of shrink candidates tested |
| `counterexample` | The smallest failing input found |
| `replay` | Copy-paste snippet to reproduce the failure |

### Model-based tests

```
model-based test failed after 37/100 runs
seed: 42
shrinks: 15
command sequence:
  1. increment(1)
  2. buggyReset  <-- check failed
replay: fuzz.model(spec, { seed: 42, runs: 100 })
```

The `<-- check failed` marker shows which step triggered the failure. Parameterless commands omit the parentheses.

## Reproducing failures

Every failure output includes a `seed` and `runs` value. Pass them back to reproduce the exact same run:

### Property tests

```ts
fuzz.assertReplay(arbitrary, predicate, { seed: 42, runs: 100 });
```

### Model-based tests

```ts
fuzz.model(spec, { seed: 42, runs: 100 });
```

### In test runners

```ts
fuzzIt('my property', gen.int(0, 100), (n) => n < 50, {
  seed: 42,
  runs: 100
});
```

The seed ensures deterministic RNG, so the exact same inputs are generated in the same order. This makes failures fully reproducible across machines and CI runs.
