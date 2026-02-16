# Model-Based Testing

Model-based testing verifies a stateful system against a simplified model. TypeFuzz generates random command sequences, executes them against both the system and the model, and checks that the system matches the model after each step.

```ts
import { fuzz, gen } from 'typefuzz';

class Counter {
  value = 0;
  add(n: number) { this.value += n; }
  reset() { this.value = 0; }
}

const result = fuzz.model({
  state: () => ({ count: 0 }),
  setup: () => new Counter(),
  commands: [
    {
      name: 'increment',
      arbitrary: gen.int(1, 5),
      run: (counter, model, n) => { counter.add(n); model.count += n; },
      check: (counter, model) => counter.value === model.count
    },
    {
      name: 'reset',
      run: (counter, model) => { counter.reset(); model.count = 0; },
      check: (counter, model) => counter.value === 0,
      precondition: (model) => model.count > 0
    }
  ]
}, { runs: 100, maxCommands: 20 });
```

## How it works

Each iteration creates a fresh model (`state()`) and a fresh system (`setup()`), then runs a random sequence of commands. For each step:

1. Filter commands by `precondition` (if defined)
2. Pick a random eligible command
3. Generate a parameter (if the command has an `arbitrary`)
4. Call `run(system, model, param)` to apply side effects
5. Call `check(system, model, param)` - if it returns `false` or throws, the sequence fails

On failure, the sequence is shrunk using delta-debugging chunk removal (tries removing contiguous chunks of decreasing size) followed by element-wise parameter shrinking, looping until convergence.

## Commands

A command has:

- `name` used in failure output
- `arbitrary?` generator for the command parameter (omit for parameterless commands)
- `precondition?` guard for eligibility
- `run(system, model, param)` applies the operation to both system and model
- `check(system, model, param)` returns `false` to fail, or throws via assertions

## Configuration

- `runs` number of iterations (default `100`)
- `maxCommands` max commands per sequence (default `20`)
- `maxShrinks` shrink budget (default `1000`)
- `seed` RNG seed for reproducibility

## Teardown

Provide optional `teardown(system)` to clean up after each iteration. It is called in a `finally` block, even during failure and shrink replay.

## Failure output

```txt
model-based test failed after 37/100 runs
seed: 42
shrinks: 15
command sequence:
  1. increment(1)
  2. buggyReset  <-- check failed
replay: fuzz.model(spec, { seed: 42, runs: 100 })
```

## API

- `fuzz.model(spec, config?)` run and return `ModelResult`
- `fuzz.modelAsync(spec, config?)` async variant
- `fuzz.assertModel(spec, config?)` run and throw on failure
- `fuzz.assertModelAsync(spec, config?)` async variant
- `fuzz.serializeModelFailure(failure)` JSON-friendly failure payload
