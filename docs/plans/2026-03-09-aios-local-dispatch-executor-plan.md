# AIOS Local Dispatch Executor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-only dry-run executor layer that consumes the dispatch DAG, simulates phase jobs, and validates merge-gate contracts without invoking any model runtime.

**Architecture:** Keep `dispatchPlan` as the static DAG and add an optional `--execute dry-run` mode on top. The orchestrator harness will expose a small local executor registry keyed by `launchSpec.executor`. Phase jobs will emit synthetic handoff payloads, merge-gate jobs will consume those handoffs through the existing merge logic, and the lifecycle will return a `dispatchRun` artifact alongside the static plan.

**Tech Stack:** Node.js ESM, existing AIOS lifecycle/harness modules, Node test runner

---

### Task 1: Add failing dry-run executor tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Extend orchestrate CLI options for execute mode

**Files:**
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 3: Implement local executor registry and dispatch run output

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 4: Document and verify

**Files:**
- Modify: `docs/plans/2026-03-09-aios-orchestrator-blueprints-design.md`
- Verify only

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
- `cd mcp-server && npm run typecheck && npm run build`
