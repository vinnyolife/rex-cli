# Team History Perf + Concurrency Design

Date: 2026-04-05

## Goal

Speed up `node scripts/aios.mjs team history` on medium/large ContextDB session trees while keeping output shape stable.

Primary wins:
- Process multiple sessions concurrently (default concurrency = 4).
- Avoid redundant dispatch artifact reads/parses when computing dispatch hindsight (artifactCache reuse).

## Non-Goals / Constraints

- No ContextDB schema migrations.
- No model calls / no provider credentials required.
- No changes to `team status` behavior.
- No changes to hindsight semantics (only IO + orchestration).

## Current Pain

`team history` currently:
1) Iterates sessions sequentially.
2) For each session, reads the latest dispatch artifact (to summarize it) and then re-reads the same artifact again inside `buildHindsightEval`, plus additional dispatch artifacts for comparison.

This leads to avoidable IO + JSON parse overhead (especially noticeable when `--limit` is large).

## Design Overview

### 1) `team history` session concurrency

Add a `--concurrency <n>` option to `team history`.

- Default: `4` (enabled even when not provided).
- Range: clamp to `1..16` to avoid runaway file descriptor / IO contention issues.
- Ordering: preserve record order (same order as the `listContextDbSessions` result).

Implementation:
- Replace the sequential loop in `scripts/lib/lifecycle/team-ops.mjs` with a small promise pool (`mapWithConcurrency`).
- Each worker calls `readHudDispatchSummary` for one session meta.

CLI:
- Parse in `scripts/lib/cli/parse-args.mjs` under `parseTeamHistoryArgs`.
- Document in `scripts/lib/cli/help.mjs` under `team history` options.

### 2) Dispatch artifactCache reuse for hindsight evaluation

Enhance `readHudDispatchSummary` in `scripts/lib/hud/state.mjs` to preload dispatch artifacts and pass them into `buildHindsightEval`.

Behavior:
- Seed `artifactCache` with `latestDispatch.raw` (already parsed by `findLatestDispatchArtifact`) when available.
- Preload the remaining recent dispatch artifacts referenced by `dispatchEvidence` (up to the existing `limit`) and store parsed JSON in `artifactCache`.
- Call `buildHindsightEval({ ..., dispatchEvidence, artifactCache })`.

Error handling:
- Ignore preload failures per artifact (leave it absent from `artifactCache`); `buildHindsightEval` already tolerates missing artifacts.
- Preserve existing warnings behavior for hindsight failures.

## Testing & Verification

Update tests:
- `scripts/tests/aios-cli.test.mjs`: ensure `parseArgs` accepts `team history --concurrency <n>` and defaults to `4`.
- `scripts/tests/hud-state.test.mjs`: keep existing coverage for `readHudDispatchSummary` + `runTeamHistory --json` output shape.

Verification:
- `npm run test:scripts`

## Acceptance Criteria

- `node scripts/aios.mjs team history --json` output remains backward-compatible (same top-level keys + record shape).
- Default behavior uses `concurrency=4` and produces the same ordering as before.
- No additional model calls introduced.
- Script test suite passes (`npm run test:scripts`).

## Rollback

- Revert the concurrency pool in `scripts/lib/lifecycle/team-ops.mjs`.
- Remove `--concurrency` parsing/help text.
- Remove artifact preloading and `artifactCache` wiring in `readHudDispatchSummary`.

