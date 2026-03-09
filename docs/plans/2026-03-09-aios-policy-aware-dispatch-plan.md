# AIOS Policy-Aware Dispatch DAG Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `dispatchPolicy.parallelism` change the local dispatch DAG so blocked workflows emit serial plans and stable workflows keep the merge-gated parallel path.

**Architecture:** Derive a preliminary dispatch policy from `learn-eval` before building the DAG. `buildLocalDispatchPlan` will read the normalized policy from the orchestration plan and choose either sequentialized grouped phases or the existing grouped-parallel-plus-merge-gate path. After DAG construction, `runOrchestrate` will keep recomputing the final policy for reporting and future runs.

**Tech Stack:** Node.js ESM, existing AIOS harness/lifecycle modules, Node test runner

---

### Task 1: Add failing DAG policy tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Make local dispatch plan policy-aware

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`

### Task 3: Build the DAG from preliminary policy in orchestrate lifecycle

**Files:**
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 4: Verify end-to-end behavior

**Files:**
- Verify only

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --format text`
- `cd mcp-server && npm run typecheck && npm run build`
