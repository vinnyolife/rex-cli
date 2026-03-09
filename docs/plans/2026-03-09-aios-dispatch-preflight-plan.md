# AIOS Dispatch Preflight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `--preflight auto` to `orchestrate` so supported local gate/runbook actions run before final DAG selection and can resolve dispatch blockers.

**Architecture:** `orchestrate` will build a raw dispatch policy first, then optionally execute supported local required actions through lifecycle function adapters. The preflight runner will emit structured results and derive an `effectiveDispatchPolicy`, which becomes the policy used for DAG construction and final reporting.

**Tech Stack:** Node.js ESM, existing AIOS lifecycle modules, Node test runner

---

### Task 1: Add failing preflight tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Add preflight options and runner wiring

**Files:**
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 3: Add structured preflight/effective-policy helpers

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`

### Task 4: Verify end-to-end behavior

**Files:**
- Verify only

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --preflight auto --format json`
- `cd mcp-server && npm run typecheck && npm run build`
