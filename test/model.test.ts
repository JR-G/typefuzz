import { describe, expect, it } from 'vitest';
import { gen } from '../src/generators.js';
import { fuzz } from '../src/index.js';
import { fuzzIt } from '../src/vitest.js';
import { runModel, runModelAsync, assertModel, formatModelFailure, serializeModelFailure, type ModelSpec, type AsyncModelSpec, type ModelFailure } from '../src/model.js';

class Counter {
  value = 0;
  add(n: number): void { this.value += n; }
  reset(): void { this.value = 0; }
}

const counterSpec: ModelSpec<{ count: number }, Counter> = {
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
};

describe('model-based testing', () => {
  it('passes for a correct implementation', () => {
    const result = runModel(counterSpec, { seed: 42, runs: 100 });
    expect(result.ok).toBe(true);
  });

  it('detects a buggy implementation', () => {
    const buggySpec: ModelSpec<{ count: number }, Counter> = {
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
          name: 'buggyReset',
          run: (counter, _model) => { counter.reset(); },
          check: (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    const result = runModel(buggySpec, { seed: 42, runs: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const names = result.failure.sequence.map((s) => s.name);
      expect(names).toContain('buggyReset');
    }
  });

  it('shrinks to minimal sequence via chunk removal', () => {
    const buggySpec: ModelSpec<{ count: number }, Counter> = {
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
          name: 'buggyReset',
          run: (counter, _model) => { counter.reset(); },
          check: (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    const result = runModel(buggySpec, { seed: 42, runs: 100, maxShrinks: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.sequence).toHaveLength(2);
      expect(result.failure.sequence[0].name).toBe('increment');
      expect(result.failure.sequence[1].name).toBe('buggyReset');
      expect(result.failure.shrinks).toBeGreaterThan(0);
    }
  });

  it('shrinks parameter values to minimal', () => {
    const spec: ModelSpec<{ total: number }, { total: number }> = {
      state: () => ({ total: 0 }),
      setup: () => ({ total: 0 }),
      commands: [
        {
          name: 'add',
          arbitrary: gen.int(1, 100),
          run: (sys, model, n) => { sys.total += n; model.total += n; },
          check: (sys) => sys.total < 10
        }
      ]
    };
    const result = runModel(spec, { seed: 42, runs: 100, maxShrinks: 1000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const params = result.failure.sequence.map((s) => s.param as number);
      const total = params.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(10);
      expect(total).toBeLessThanOrEqual(11);
    }
  });

  it('finds buried 2-step failure in long sequence', () => {
    let stepCount = 0;
    const spec: ModelSpec<{ activated: boolean; deactivated: boolean }, object> = {
      state: () => ({ activated: false, deactivated: false }),
      setup: () => ({}),
      commands: [
        {
          name: 'noop',
          run: () => {},
          check: () => true
        },
        {
          name: 'activate',
          run: (_sys, model) => { model.activated = true; },
          check: () => true,
          precondition: (model) => !model.activated
        },
        {
          name: 'deactivate',
          run: (_sys, model) => { model.deactivated = true; },
          check: (_sys, model) => !(model.activated && model.deactivated),
          precondition: (model) => model.activated && !model.deactivated
        }
      ]
    };
    const result = runModel(spec, { seed: 42, runs: 200, maxCommands: 20, maxShrinks: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.sequence).toHaveLength(2);
      expect(result.failure.sequence[0].name).toBe('activate');
      expect(result.failure.sequence[1].name).toBe('deactivate');
    }
  });

  it('calls teardown on success', () => {
    let tornDown = false;
    const spec: ModelSpec<object, Counter> = {
      state: () => ({}),
      setup: () => new Counter(),
      teardown: () => { tornDown = true; },
      commands: [
        { name: 'noop', run: () => {}, check: () => true }
      ]
    };
    runModel(spec, { seed: 1, runs: 1 });
    expect(tornDown).toBe(true);
  });

  it('calls teardown on failure and during shrinking', () => {
    let teardownCount = 0;
    const spec: ModelSpec<{ count: number }, Counter> = {
      state: () => ({ count: 0 }),
      setup: () => new Counter(),
      teardown: () => { teardownCount++; },
      commands: [
        {
          name: 'increment',
          arbitrary: gen.int(1, 5),
          run: (counter, model, n) => { counter.add(n); model.count += n; },
          check: (counter, model) => counter.value === model.count
        },
        {
          name: 'buggyReset',
          run: (counter, _model) => { counter.reset(); },
          check: (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    runModel(spec, { seed: 42, runs: 100, maxShrinks: 50 });
    expect(teardownCount).toBeGreaterThan(2);
  });

  it('catches errors thrown in run()', () => {
    const spec: ModelSpec<object, object> = {
      state: () => ({}),
      setup: () => ({}),
      commands: [
        {
          name: 'throws',
          run: () => { throw new Error('boom'); },
          check: () => true
        }
      ]
    };
    const result = runModel(spec, { seed: 1, runs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.error).toBeInstanceOf(Error);
      expect((result.failure.error as Error).message).toBe('boom');
    }
  });

  it('catches errors thrown in check()', () => {
    const spec: ModelSpec<object, object> = {
      state: () => ({}),
      setup: () => ({}),
      commands: [
        {
          name: 'checkThrows',
          run: () => {},
          check: () => { throw new Error('check boom'); }
        }
      ]
    };
    const result = runModel(spec, { seed: 1, runs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.failure.error as Error).message).toBe('check boom');
    }
  });

  it('respects preconditions', () => {
    const spec: ModelSpec<{ ready: boolean }, object> = {
      state: () => ({ ready: false }),
      setup: () => ({}),
      commands: [
        {
          name: 'activate',
          run: (_sys, model) => { model.ready = true; },
          check: () => true
        },
        {
          name: 'guarded',
          precondition: (model) => model.ready,
          run: () => {},
          check: () => true
        }
      ]
    };
    const result = runModel(spec, { seed: 42, runs: 50 });
    expect(result.ok).toBe(true);
  });

  it('stops when no commands are eligible', () => {
    const spec: ModelSpec<{ done: boolean }, object> = {
      state: () => ({ done: false }),
      setup: () => ({}),
      commands: [
        {
          name: 'finish',
          precondition: (model) => !model.done,
          run: (_sys, model) => { model.done = true; },
          check: () => true
        }
      ]
    };
    const result = runModel(spec, { seed: 1, runs: 10, maxCommands: 10 });
    expect(result.ok).toBe(true);
  });

  it('is deterministic with the same seed', () => {
    const buggySpec: ModelSpec<{ count: number }, Counter> = {
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
          name: 'buggyReset',
          run: (counter, _model) => { counter.reset(); },
          check: (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    const a = runModel(buggySpec, { seed: 42, runs: 50, maxShrinks: 100 });
    const b = runModel(buggySpec, { seed: 42, runs: 50, maxShrinks: 100 });
    expect(a).toEqual(b);
  });

  it('rejects invalid maxCommands', () => {
    expect(() => runModel(counterSpec, { maxCommands: 0 })).toThrowError(RangeError);
    expect(() => runModel(counterSpec, { maxCommands: -1 })).toThrowError(RangeError);
    expect(() => runModel(counterSpec, { maxCommands: 1.5 })).toThrowError(RangeError);
  });

  it('rejects invalid maxShrinks', () => {
    expect(() => runModel(counterSpec, { maxShrinks: 0 })).toThrowError(RangeError);
    expect(() => runModel(counterSpec, { maxShrinks: -1 })).toThrowError(RangeError);
  });

  it('rejects empty commands array', () => {
    expect(() => runModel({
      state: () => ({}),
      setup: () => ({}),
      commands: []
    })).toThrowError(RangeError);
  });

  it('supports expect-style void checks', () => {
    const spec: ModelSpec<{ count: number }, Counter> = {
      state: () => ({ count: 0 }),
      setup: () => new Counter(),
      commands: [
        {
          name: 'increment',
          arbitrary: gen.int(1, 5),
          run: (counter, model, n) => { counter.add(n); model.count += n; },
          check: (counter, model) => { expect(counter.value).toBe(model.count); }
        }
      ]
    };
    const result = runModel(spec, { seed: 42, runs: 50 });
    expect(result.ok).toBe(true);
  });

  it('catches expect-style check failures as errors', () => {
    const spec: ModelSpec<{ count: number }, Counter> = {
      state: () => ({ count: 0 }),
      setup: () => new Counter(),
      commands: [
        {
          name: 'increment',
          arbitrary: gen.int(1, 5),
          run: (counter, model, n) => { counter.add(n); model.count += n + 1; },
          check: (counter, model) => { expect(counter.value).toBe(model.count); }
        }
      ]
    };
    const result = runModel(spec, { seed: 42, runs: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.error).toBeDefined();
    }
  });

  it('reproduces failure when replayed with same seed', () => {
    const buggySpec: ModelSpec<{ count: number }, Counter> = {
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
          name: 'buggyReset',
          run: (counter, _model) => { counter.reset(); },
          check: (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    const first = runModel(buggySpec, { seed: 42, runs: 100 });
    expect(first.ok).toBe(false);
    if (!first.ok) {
      const replay = runModel(buggySpec, { seed: first.failure.seed, runs: first.failure.runs });
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.failure.iterations).toBe(first.failure.iterations);
      }
    }
  });

  it('does not mask failures when teardown throws', () => {
    const spec: ModelSpec<object, object> = {
      state: () => ({}),
      setup: () => ({}),
      teardown: () => { throw new Error('teardown exploded'); },
      commands: [
        { name: 'fail', run: () => {}, check: () => false }
      ]
    };
    const result = runModel(spec, { seed: 1, runs: 1, maxShrinks: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.sequence.length).toBeGreaterThan(0);
    }
  });
});

describe('formatModelFailure', () => {
  it('formats failure with annotated command sequence', () => {
    const failure: ModelFailure = {
      seed: 42, runs: 100, iterations: 3, shrinks: 10,
      sequence: [
        { name: 'increment', param: 5 },
        { name: 'increment', param: 3 },
        { name: 'reset', param: undefined }
      ],
      failedStep: 2
    };
    const formatted = formatModelFailure(failure);
    expect(formatted).toContain('model-based test failed after 3/100 runs');
    expect(formatted).toContain('seed: 42');
    expect(formatted).toContain('shrinks: 10');
    expect(formatted).toContain('1. increment(5)');
    expect(formatted).toContain('2. increment(3)');
    expect(formatted).toContain('3. reset  <-- check failed');
    expect(formatted).toContain('replay: fuzz.model(spec, { seed: 42, runs: 100 })');
  });

  it('omits parens for parameterless commands', () => {
    const failure: ModelFailure = {
      seed: 1, runs: 1, iterations: 1, shrinks: 0,
      sequence: [{ name: 'doThing', param: undefined }],
      failedStep: 0
    };
    const formatted = formatModelFailure(failure);
    expect(formatted).toContain('1. doThing  <-- check failed');
    expect(formatted).not.toContain('doThing(');
  });
});

describe('assertModel', () => {
  it('throws with formatted message', () => {
    expect(() => {
      assertModel({
        state: () => ({}),
        setup: () => ({}),
        commands: [{ name: 'fail', run: () => {}, check: () => false }]
      }, { seed: 1, runs: 1, maxShrinks: 1 });
    }).toThrowError(/model-based test failed/);
  });

  it('attaches modelFailure metadata to thrown error', () => {
    try {
      assertModel({
        state: () => ({}),
        setup: () => ({}),
        commands: [{ name: 'fail', run: () => {}, check: () => false }]
      }, { seed: 99, runs: 1, maxShrinks: 1 });
      expect.unreachable();
    } catch (error) {
      const typed = error as Error & { modelFailure?: ModelFailure };
      expect(typed.modelFailure).toBeDefined();
      expect(typed.modelFailure!.seed).toBe(99);
      expect(typed.modelFailure!.sequence.length).toBeGreaterThan(0);
    }
  });

  it('sets error.cause when command throws', () => {
    try {
      assertModel({
        state: () => ({}),
        setup: () => ({}),
        commands: [
          { name: 'boom', run: () => { throw new Error('kaboom'); }, check: () => true }
        ]
      }, { seed: 1, runs: 1, maxShrinks: 1 });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).cause).toBeInstanceOf(Error);
      expect(((error as Error).cause as Error).message).toBe('kaboom');
    }
  });
});

describe('async model-based testing', () => {
  it('passes for correct async implementation', async () => {
    const spec: AsyncModelSpec<{ count: number }, Counter> = {
      state: () => ({ count: 0 }),
      setup: () => new Counter(),
      commands: [
        {
          name: 'increment',
          arbitrary: gen.int(1, 5),
          run: async (counter, model, n) => {
            await Promise.resolve();
            counter.add(n);
            model.count += n;
          },
          check: async (counter, model) => {
            await Promise.resolve();
            return counter.value === model.count;
          }
        }
      ]
    };
    const result = await runModelAsync(spec, { seed: 42, runs: 30 });
    expect(result.ok).toBe(true);
  });

  it('detects async failures and shrinks', async () => {
    const spec: AsyncModelSpec<{ count: number }, Counter> = {
      state: () => ({ count: 0 }),
      setup: async () => {
        await Promise.resolve();
        return new Counter();
      },
      teardown: async () => { await Promise.resolve(); },
      commands: [
        {
          name: 'increment',
          arbitrary: gen.int(1, 5),
          run: async (counter, model, n) => {
            await Promise.resolve();
            counter.add(n);
            model.count += n;
          },
          check: async (counter, model) => counter.value === model.count
        },
        {
          name: 'buggyReset',
          run: async (counter) => {
            await Promise.resolve();
            counter.reset();
          },
          check: async (counter, model) => counter.value === model.count,
          precondition: (model) => model.count > 0
        }
      ]
    };
    const result = await runModelAsync(spec, { seed: 42, runs: 100, maxShrinks: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.sequence).toHaveLength(2);
      expect(result.failure.sequence[0].name).toBe('increment');
      expect(result.failure.sequence[1].name).toBe('buggyReset');
    }
  });
});

describe('fuzz.model / fuzz.assertModel', () => {
  it('returns ok for passing spec', () => {
    const result = fuzz.model(counterSpec, { seed: 42, runs: 20 });
    expect(result.ok).toBe(true);
  });

  it('returns failure details', () => {
    const result = fuzz.model({
      state: () => ({}),
      setup: () => ({}),
      commands: [{ name: 'fail', run: () => {}, check: () => false }]
    }, { seed: 1, runs: 1, maxShrinks: 1 });
    expect(result.ok).toBe(false);
  });

  it('assertModel throws on failure', () => {
    expect(() => {
      fuzz.assertModel({
        state: () => ({}),
        setup: () => ({}),
        commands: [{ name: 'fail', run: () => {}, check: () => false }]
      }, { seed: 1, runs: 1, maxShrinks: 1 });
    }).toThrowError(/model-based test failed/);
  });

  it('assertModelAsync rejects on failure', async () => {
    await expect(fuzz.assertModelAsync({
      state: () => ({}),
      setup: () => ({}),
      commands: [
        {
          name: 'asyncFail',
          run: async () => { await Promise.resolve(); },
          check: async () => false
        }
      ]
    }, { seed: 1, runs: 1, maxShrinks: 1 })).rejects.toThrowError(/model-based test failed/);
  });

  it('serializeModelFailure returns structured payload', () => {
    const result = fuzz.model({
      state: () => ({}),
      setup: () => ({}),
      commands: [
        { name: 'fail', arbitrary: gen.constant(42), run: () => {}, check: () => false }
      ]
    }, { seed: 7, runs: 1, maxShrinks: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const serialized = fuzz.serializeModelFailure(result.failure);
      expect(serialized.seed).toBe(7);
      expect(serialized.sequence.length).toBeGreaterThan(0);
      expect(serialized.message).toContain('model-based test failed');
      expect(serialized.replay).toContain('seed: 7');
    }
  });
});

describe('serializeModelFailure', () => {
  it('produces a JSON-serializable object', () => {
    const failure: ModelFailure = {
      seed: 42, runs: 100, iterations: 5, shrinks: 3,
      sequence: [{ name: 'add', param: 10 }],
      failedStep: 0
    };
    const serialized = serializeModelFailure(failure);
    const json = JSON.parse(JSON.stringify(serialized));
    expect(json.seed).toBe(42);
    expect(json.sequence).toEqual([{ name: 'add', param: 10 }]);
    expect(json.message).toContain('seed: 42');
    expect(json.replay).toContain('seed: 42');
  });
});

describe('formatModelFailure edge cases', () => {
  it('truncates large param values', () => {
    const failure: ModelFailure = {
      seed: 1, runs: 1, iterations: 1, shrinks: 0,
      sequence: [{ name: 'bigParam', param: { data: 'x'.repeat(200) } }],
      failedStep: 0
    };
    const formatted = formatModelFailure(failure);
    expect(formatted).toContain('...');
    const paramLine = formatted.split('\n').find((l) => l.includes('bigParam'));
    expect(paramLine!.length).toBeLessThan(200);
  });
});

describe('fuzzIt.model integration', () => {
  fuzzIt.model('counter passes via fuzzIt.model', counterSpec, { seed: 42, runs: 20 });

  fuzzIt.model('single command passes via fuzzIt.model', {
    state: () => ({ n: 0 }),
    setup: () => ({ n: 0 }),
    commands: [
      {
        name: 'inc',
        run: (sys: { n: number }, model: { n: number }) => { sys.n++; model.n++; },
        check: (sys: { n: number }, model: { n: number }) => sys.n === model.n
      }
    ]
  }, { seed: 1, runs: 10 });
});
