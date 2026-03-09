# AIOS Orchestrate Learn-Eval Consumers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let `orchestrate` consume structured `learn-eval` recommendations directly so future subagent dispatch does not need to parse text output.

**Architecture:** Extend the `orchestrate` lifecycle with an optional learn-eval overlay. When a session is provided, `orchestrate` loads the session's learn-eval report, resolves a blueprint recommendation if one exists, carries forward the top structured recommendations, and renders them in both JSON and text output.

**Tech Stack:** Node.js ESM, existing AIOS lifecycle/harness modules, Node test runner

---

### Task 1: Add failing tests for orchestrate learn-eval overlay

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`
- Modify: `scripts/tests/aios-learn-eval.test.mjs` only if shared helpers are needed

### Task 2: Extend orchestrate option parsing and lifecycle defaults

**Files:**
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 3: Add structured recommendation overlay to orchestration plans

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 4: Verify end-to-end behavior

**Files:**
- Verify only

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session <session-id> --format json`
- `cd mcp-server && npm run typecheck && npm run build`
