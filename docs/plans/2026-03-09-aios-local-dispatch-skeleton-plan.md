# AIOS Local Dispatch Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-only orchestration dispatch skeleton that turns blueprint phases into jobs, dependencies, and merge-gate metadata without invoking any model runtime.

**Architecture:** Extend `orchestrate` with an optional `--dispatch local` mode. The lifecycle will still resolve blueprint and learn-eval overlay first, then build a local dispatch plan from the orchestration phases. The dispatch plan is pure data: phase jobs, dependency edges, synthetic merge-gate jobs, and future-facing launch specs marked as non-executing.

**Tech Stack:** Node.js ESM, existing AIOS lifecycle/harness modules, Node test runner

---

### Task 1: Add failing dispatch skeleton tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Extend orchestrate CLI options for dispatch mode

**Files:**
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 3: Add local dispatch skeleton builder and rendering

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
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --format json`
- `cd mcp-server && npm run typecheck && npm run build`
