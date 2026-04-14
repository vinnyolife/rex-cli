# Release Health Guard + History Export + CI Watch Plan

## Goal
Implement and verify three iterations:
1. Integrate `release-status --strict` into `quality-gate` and `orchestrate --preflight auto` as blocking guard.
2. Add daily historical failure/fallback export in CSV/NDJSON.
3. Add scheduled CI health watch with artifact upload and unhealthy alert.

## Scope
- CLI/options/help updates for release history export flags.
- Lifecycle updates in `release-status`, `quality-gate`, and `orchestrate`.
- Test coverage for parser, plan preview, quality category, and preflight blocking behavior.
- New GitHub Actions workflow for scheduled health checks.

## Implementation Checklist
- [x] Extend release-status options with `historyOutputPath`, `historyFormat`, `historyDays`.
- [x] Implement daily trend aggregation and CSV/NDJSON export writer.
- [x] Wire new CLI flags in argument parser and help text.
- [x] Add release strict gate stage to quality-gate with `quality-release` failure category.
- [x] Add orchestrate preflight auto release guard execution + effective policy blocking when failed.
- [x] Add scheduled CI workflow `release-health-watch.yml` with artifact upload and failure alert.
- [x] Add/adjust tests for all new behaviors.

## Verification Evidence
- `node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-harness.test.mjs scripts/tests/aios-orchestrator.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs`
- `npm run test:scripts`
- `cd mcp-server && npm run typecheck && npm run test && npm run build`

All commands completed successfully on this branch.
