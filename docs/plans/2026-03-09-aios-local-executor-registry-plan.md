# AIOS Local Executor Registry Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract local dispatch execution behind an executor registry so future real runtimes can plug into orchestration without changing DAG construction.

**Scope:** Keep execution local-only. No real model calls, no remote subagent launch, no token-bearing runtime integration.

**Design Notes:**
- `buildLocalDispatchPlan` remains responsible only for DAG/job construction.
- Executor selection must happen through a registry-aware API, even when all jobs still resolve to the same local placeholder executor.
- `dispatchPlan` and `dispatchRun` should expose executor metadata so downstream consumers do not need to reverse-engineer capabilities from job data.
- Merge-gate behavior remains unchanged and continues to reuse `mergeParallelHandoffs`.

---

### Task 1: Add registry contract tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`
- Add: `scripts/lib/harness/orchestrator-executors.mjs`

### Task 2: Extract local executor registry module

**Files:**
- Add: `scripts/lib/harness/orchestrator-executors.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`

### Task 3: Surface executor metadata in plan/run artifacts

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs` only if report shaping changes

### Task 4: Update docs and verify

**Files:**
- Modify: `docs/plans/2026-03-09-aios-orchestrator-blueprints-design.md`
- Add: `docs/plans/2026-03-09-aios-local-executor-registry-plan.md`

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
- `cd mcp-server && npm run typecheck && npm run build`
