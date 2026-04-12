# 2026-04-12 Snapshot Rollback Command

## Scope
- Close Hermes optimization item 1 by adding a dedicated rollback command for pre-mutation snapshot artifacts.
- Keep restore behavior manifest-driven with workspace-bound path safety.
- Support both explicit manifest input and session artifact auto-discovery.

## Implementation
1. Add new top-level CLI command `snapshot-rollback` and alias `rollback-snapshot`.
2. Implement lifecycle runner in `scripts/lib/lifecycle/snapshot-rollback.mjs`:
   - Normalize and validate snapshot manifests (`kind: orchestration.pre-mutation-snapshot`).
   - Resolve latest candidate by `--session` and optional `--job`.
   - Build restore plan with workspace escape protection.
   - Verify backup existence/types before apply.
   - Support `--dry-run`, `--format text|json`, and rollback history append on apply.
3. Wire parser/help/options for command flags (`--manifest`, `--session`, `--job`, `--dry-run`, `--format`).
4. Add CLI tests for argument parsing and runtime restore behavior.

## Verification
- `node --test scripts/tests/aios-cli.test.mjs`
- `node --test scripts/tests/aios-orchestrator.test.mjs`

Results:
- Pass (`32/32`) for `scripts/tests/aios-cli.test.mjs`.
- Pass (`83/83`) for `scripts/tests/aios-orchestrator.test.mjs`.
