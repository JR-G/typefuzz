# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository workflow

- Install: `bun install`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Tests: `bun run test`

## Release workflow

- Create release PR: `bun run release patch|minor|major`
- After release PR merges to `main`, publish tag: `bun run release:tag`
- The tag push triggers publish workflow.
- Release details: `docs/releasing.md`

## Test authoring rules

- Prefer properties over one-off fixed examples when behavior should hold broadly.
- Always include explicit seeds in generated tests to keep CI deterministic.
- Use `runs` intentionally; default is `100`, typical range is `100-200`.
- Use `.each` only when you want separate test cases per sampled input and do not need shrinking.
- For async properties, use async test helpers/APIs and await assertions.

## Failure and replay protocol

- Preserve `seed` and `runs` from failures.
- Add a deterministic replay/regression test before or alongside behavior fixes.
- Use the replay commands documented in `docs/core-api.md` and `docs/model-based-testing.md`.

## Where to read next

- `docs/index.md`
- `docs/ai-testing-playbook.md`
- `docs/core-api.md`
- `docs/model-based-testing.md`
- `docs/releasing.md`
