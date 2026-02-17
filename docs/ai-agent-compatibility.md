# AI Agent Compatibility

This repository includes generic conventions so code-generation agents can contribute reliably across different tools.

## Principles used in this repo

1. Stable entrypoints
- Keep an explicit command contract (`bun run lint`, `bun run typecheck`, `bun run test`).
- Keep docs paths stable (`docs/index.md`, `AGENTS.md`, `llms.txt`).

2. Deterministic testing workflows
- Generated tests should include explicit `seed` values.
- Reproducibility should always include `seed` + `runs` in bug reports and regression tests.

3. Machine-readable orientation
- `AGENTS.md` gives concise repository instructions for coding agents.
- `llms.txt` provides a compact map of high-value docs and commands.

4. Progressive docs depth
- `README.md` stays short and task-oriented.
- Detailed guidance is split by topic in `docs/` for faster retrieval and lower context overhead.

## Suggested maintenance rules

- Keep `AGENTS.md` aligned with any command or workflow changes.
- Update `llms.txt` whenever documentation structure changes.
- When adding APIs, include one example in topical docs and one deterministic test in `test/`.
- Prefer examples that demonstrate replay behavior for failure-driven debugging.
