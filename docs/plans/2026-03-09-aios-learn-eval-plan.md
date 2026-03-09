# AIOS Learn-Eval — Implementation Plan

## Task 1: Add command model and CLI wiring

Files:
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`

Steps:
1. Add learn-eval defaults and format normalization.
2. Parse `learn-eval` plus `--session`, `--limit`, `--format`.
3. Add help text and top-level dispatch.

## Task 2: Implement telemetry aggregation

Files:
- Create: `scripts/lib/harness/learn-eval.mjs`
- Create: `scripts/lib/lifecycle/learn-eval.mjs`

Steps:
1. Load latest or specified session from canonical ContextDB files.
2. Read recent checkpoints and aggregate verification, retries, latency, failure categories, and cost.
3. Emit minimal recommendations under `promote`, `fix`, and `observe`.
4. Support both text and JSON output.

## Task 3: Add tests and verify

Files:
- Create: `scripts/tests/aios-learn-eval.test.mjs`
- Modify: `package.json`

Steps:
1. Add parse-args coverage for `learn-eval`.
2. Add aggregation/report tests against a temporary ContextDB fixture.
3. Run `npm run test:scripts`.
4. Run `cd mcp-server && npm run typecheck && npm run build` to confirm no regression in the shared stack.
