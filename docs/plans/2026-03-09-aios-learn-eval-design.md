# AIOS Learn-Eval — Design

**Date:** 2026-03-09  
**Status:** Approved for implementation

## Goal

Add a minimal `aios learn-eval` command that reads recent ContextDB checkpoint telemetry and turns it into operator-facing recommendations.

## Scope

This slice evaluates one session at a time and reports:

- verification signal quality,
- retry and latency patterns,
- dominant failure categories,
- cost totals when present,
- promotion / fix / observe recommendations.

## Why This Layer

`learn-eval` belongs in the AIOS operator layer, not the raw ContextDB CLI.

- ContextDB stores canonical evidence.
- AIOS turns that evidence into workflow decisions.
- This keeps storage generic and keeps policy in the harness layer.

## Command Shape

```bash
node scripts/aios.mjs learn-eval [options]
```

Options:

- `--session <id>`: analyze a specific session
- `--limit <n>`: analyze the most recent `n` checkpoints from that session
- `--format <text|json>`: human report or machine-readable output

If `--session` is omitted, the command uses the most recently updated session in `memory/context-db/sessions/`.

## Decision Rules

- `promote`: emitted when verification pass rate is strong, retries stay low, and there is enough sample size.
- `fix`: emitted when failures, blocked checkpoints, or dominant failure categories indicate a missing gate/runbook.
- `observe`: emitted when telemetry is sparse or verification is mostly unknown.

This first slice stays conservative. It does not modify skills, blueprints, or gates automatically.

## Recommendation Schema

All recommendations now use one shared object shape so text and JSON output stay aligned:

- `kind`: `fix | observe | promote`
- `targetType`: `gate | runbook | blueprint | checklist | sample`
- `targetId`: stable identifier such as `gate.timeout-budget` or `blueprint.feature`
- `title`: short operator-facing label
- `reason`: why the recommendation exists
- `evidence`: compact evidence summary derived from checkpoint telemetry
- `priority`: deterministic numeric priority used for rendering and future automation
- `nextCommand?`: concrete follow-up command when one exists
- `nextArtifact?`: concrete artifact path when one exists

## Priority Model

`learn-eval` sorts recommendations by strict precedence:

- `fix > observe > promote`

Within the same precedence bucket, items are sorted by numeric `priority`, then by evidence strength, then by stable identifiers. Text output renders sections in the same order: `Fix`, `Observe`, `Promote`.

## Non-Goals

- No auto-editing of orchestrator blueprints
- No auto-generation of skills
- No cross-session scoring dashboard
