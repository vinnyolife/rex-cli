# Live Dispatch Cost Telemetry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real token/cost telemetry to live `subagent-runtime` dispatch runs and persist that telemetry through dispatch evidence so `learn-eval` can consume it.

**Architecture:** Keep dry-run behavior unchanged. Extend live runtime execution to collect per-job usage telemetry from subagent CLI output, roll it up to `dispatchRun.cost`, and write that cost into ContextDB checkpoint telemetry when dispatch evidence is persisted. Persist live evidence only when a real live run actually executed jobs.

**Tech Stack:** Node.js ESM scripts, AIOS harness runtime/evidence modules, ContextDB CLI checkpoint flags, node:test.

---

### Task 1: Add failing tests for live cost telemetry propagation

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

- [x] Add/extend test fixtures to emit deterministic token/cost usage text from fake Codex runtime.
- [x] Add a failing assertion that `subagent-runtime` live execution reports non-zero `dispatchRun.cost` when usage is present.
- [x] Add a failing end-to-end `runOrchestrate` test asserting live dispatch evidence persists and checkpoint telemetry carries that cost.
- [x] Run: `node --test scripts/tests/aios-orchestrator.test.mjs`

### Task 2: Implement runtime usage collection and evidence persistence

**Files:**
- Modify: `scripts/lib/harness/subagent-runtime.mjs`
- Modify: `scripts/lib/harness/orchestrator-evidence.mjs`

- [x] Implement best-effort usage parsing (tokens/usd) from live subagent CLI outputs.
- [x] Attach per-job usage telemetry and aggregate to `dispatchRun.cost`.
- [x] Persist checkpoint cost fields (`inputTokens`, `outputTokens`, `totalTokens`, `usd`) from `dispatchRun.cost` instead of hardcoded zero.
- [x] Keep live evidence persistence gated to real executed live runs (jobRuns present) so blocked opt-in gate behavior remains unchanged.

### Task 3: Verify and checkpoint

**Files:**
- Modify: `docs/plans/2026-03-12-live-dispatch-cost-telemetry-plan.md`
- Update via CLI: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/*`

- [x] Run: `node --test scripts/tests/aios-orchestrator.test.mjs`
- [x] Run: `npm run test:scripts`
- [x] Run: `cd mcp-server && npm run typecheck && npm run build`
- [x] Write ContextDB session update with completed slice and refreshed next actions.
- [x] Refresh context export packet for this session.
