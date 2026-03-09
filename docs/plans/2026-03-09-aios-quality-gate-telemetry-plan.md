# AIOS Quality Gate Telemetry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist real verification-result telemetry from local quality-gate runs so learn-eval can clear `gate.verification-results` without remote model calls.

**Architecture:** Add an optional `sessionId` path to `quality-gate` so successful or failed local verification runs append a ContextDB checkpoint with structured verification telemetry. Thread the current orchestration session into preflight quality-gate execution so `orchestrate --preflight auto` upgrades the session's recent verification sample before recomputing effective dispatch policy.

**Tech Stack:** Node.js ESM, existing AIOS lifecycle modules, ContextDB CLI bridge, Node test runner

---

### Task 1: Add failing telemetry tests

**Files:**
- Modify: `scripts/tests/aios-harness.test.mjs`
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Persist quality-gate verification checkpoints

**Files:**
- Modify: `scripts/lib/lifecycle/quality-gate.mjs`
- Create: `scripts/lib/harness/verification-evidence.mjs`

### Task 3: Thread session context through orchestration preflight

**Files:**
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/options.mjs`

### Task 4: Verify with real session evidence

**Files:**
- Verify only

**Verification:**
- `node --test scripts/tests/aios-harness.test.mjs`
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --preflight auto --format json`
- `node scripts/aios.mjs learn-eval --session codex-cli-20260303T080437-065e16c0 --format json`
