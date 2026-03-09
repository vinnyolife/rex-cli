# AIOS Dispatch Preflight — Design

**Date:** 2026-03-09  
**Status:** Approved for implementation

## Goal

Turn `dispatchPolicy.requiredActions` into a local preflight stage that can run supported AIOS gate/runbook commands before final DAG selection.

## Problem

AIOS already emits structured `requiredActions`, but they are passive hints.
That means `orchestrate` can know which gate should run next without being able to use that result to update the effective dispatch decision.

## Scope

This slice adds:

- an explicit `--preflight <none|auto>` option on `orchestrate`,
- a local preflight runner for supported AIOS commands,
- an `effectiveDispatchPolicy` derived from raw policy plus preflight outcomes,
- DAG construction based on the effective policy instead of the raw recommendation-only policy.

This slice does not:

- execute remote model actions,
- recurse into real subagent runtimes,
- auto-run arbitrary shell commands,
- treat artifact-only actions as executable.

## Supported Preflight Actions

First slice supports only command actions that map cleanly to local lifecycle functions:

- `node scripts/aios.mjs quality-gate ...`
- `node scripts/aios.mjs doctor ...`

Unsupported commands are recorded as `SKIP` with a reason.
Artifact actions are also recorded as `SKIP`.

## Effective Policy Rules

- Start from the raw `dispatchPolicy` produced by `learn-eval` plus dispatch evidence.
- For each supported preflight action that passes, clear the matching blocker `sourceId`.
- For failed or skipped actions, keep the blocker.
- If all blockers clear, recompute effective `status`:
  - `ready` when observed dispatch evidence exists,
  - otherwise `caution`.
- `parallelism` still remains `serial-only` when merge-gate blockage is unresolved.

## Why Explicit `--preflight auto`

Running `quality-gate full` can be expensive locally.
Keeping preflight opt-in avoids surprising users while still giving orchestrate a real local gate loop when requested.
