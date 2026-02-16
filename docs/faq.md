# FAQ

## Why do some generators throw?

Generators that require valid bounds (for example `gen.int` and `gen.date`) validate inputs eagerly so failures surface early.

## How deterministic are failures?

Failures include a seed and run count. Use `fuzz.assertReplay` (or model replay with `fuzz.model`) to reproduce the same counterexample path.

## Do I need Zod?

No. The Zod adapter is optional. Core generators and fuzz helpers do not depend on Zod.
