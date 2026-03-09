# AIOS Dispatch Policy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a structured `dispatchPolicy` to `orchestrate` so scheduling readiness, parallelism advice, gate/runbook blockers, and executor preferences are available in machine-readable form.

**Architecture:** Keep `learn-eval` as the policy source of truth and derive a normalized dispatch policy inside the orchestrator harness. The lifecycle will attach that policy to orchestration output and dry-run artifacts without invoking any real runtime.

**Tech Stack:** Node.js ESM, existing AIOS harness/lifecycle modules, Node test runner

---

### Task 1: Add failing policy tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Derive dispatch policy in the orchestrator harness

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`

### Task 3: Thread policy through orchestrate lifecycle output

**Files:**
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 4: Verify end-to-end behavior

**Files:**
- Verify only

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs scripts/tests/aios-learn-eval.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
- `cd mcp-server && npm run typecheck && npm run build`
