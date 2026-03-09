# AIOS Dispatch Policy — Design

**Date:** 2026-03-09  
**Status:** Approved for implementation

## Goal

Add a structured `dispatchPolicy` layer to `orchestrate` so local scheduling decisions are machine-readable instead of being buried in report prose.

## Problem

AIOS already has:

- blueprint selection,
- `learn-eval` recommendations,
- local dispatch DAG generation,
- local dry-run execution evidence persisted into ContextDB.

What it still lacks is one place that answers the operator/runtime questions directly:

- is the workflow blocked for future runtime use,
- should the next attempt stay serial or allow parallel branches with a merge gate,
- which gate or runbook should run first,
- which executors have prior observed evidence.

Without this layer, future runtime integration would need to re-derive policy from text output.

## Scope

This slice adds:

- a `dispatchPolicy` object in orchestration JSON output,
- text rendering for that policy,
- policy derivation from `learn-eval` recommendations plus dispatch evidence signals,
- executor preference summaries based on observed dispatch evidence.

This slice does not:

- invoke any real model runtime,
- auto-run gates or runbooks,
- mutate blueprints,
- change ContextDB schemas.

## Policy Schema

`dispatchPolicy` uses a stable additive shape:

- `status`: `blocked | caution | ready`
- `parallelism`: `serial-only | parallel-with-merge-gate`
- `blockerIds`: ordered `targetId` list for `fix` recommendations
- `advisoryIds`: ordered `targetId` list for `observe` recommendations
- `requiredActions`: concrete `nextCommand` / `nextArtifact` items extracted from recommendations
- `executorPreferences`: observed/planned executor hints for the current dispatch DAG
- `notes`: short operator-facing summaries

## Decision Rules

- Any `fix` recommendation makes policy `status=blocked`.
- `runbook.dispatch-merge-triage` or blocked dispatch evidence forces `parallelism=serial-only`.
- No `fix` recommendations but sparse evidence keeps `status=caution`.
- No `fix` recommendations and at least one observed dispatch run allows `status=ready`.
- Executor preferences are derived from the current DAG plus `signals.dispatch.executorUsage`:
  - `observed` when the executor already appears in prior dry-run evidence,
  - `planned` when it is required by the DAG but not yet observed.

## Why This Order

This is the next local-only upgrade with the best leverage:

- it uses the evidence already being collected,
- it improves orchestration intelligence without crossing into real execution,
- it gives future subagent runtimes a stable policy contract.
