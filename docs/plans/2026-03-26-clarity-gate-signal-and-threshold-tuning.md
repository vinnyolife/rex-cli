# Clarity Gate Signal + Threshold Tuning (session codex-cli-20260303T080437-065e16c0)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce false-positive `clarity-needs-input` triggers by narrowing boundary signal inputs and removing self-reinforcing blocked-threshold counting from prior clarity checkpoints.

**Architecture:** TDD change in `clarity-gate` logic with explicit metric fields for total vs excluded blocked checkpoints, plus regression tests and one controlled live orchestration sample for behavior comparison against baseline event `seq=71`.

**Tech Stack:** Node.js (`scripts/aios.mjs`), harness modules (`scripts/lib/harness/*.mjs`), ContextDB CLI (`mcp-server/src/contextdb/cli.ts`).

---

## Implemented

- [x] Narrowed boundary scan input in [scripts/lib/harness/clarity-gate.mjs](/Users/rex/cool.cnb/rex-ai-boot/scripts/lib/harness/clarity-gate.mjs):
  - [x] Boundary patterns now evaluate action-oriented snippets only (`taskTitle`, `openQuestions`, runtime `error`).
  - [x] Narrative-only fields (`contextSummary`, `findings`, `recommendations`) are excluded from boundary matching.
- [x] Added blocked-threshold decoupling in [scripts/lib/harness/clarity-gate.mjs](/Users/rex/cool.cnb/rex-ai-boot/scripts/lib/harness/clarity-gate.mjs):
  - [x] `blockedCheckpoints` now counts non-clarity blocked checkpoints.
  - [x] Added `blockedCheckpointsTotal` and `blockedCheckpointsExcluded` metrics.
- [x] Added regression tests in [scripts/tests/aios-orchestrator.test.mjs](/Users/rex/cool.cnb/rex-ai-boot/scripts/tests/aios-orchestrator.test.mjs):
  - [x] Boundary terms in narrative text do not trigger clarity gate.
  - [x] `clarity-needs-input` checkpoints are excluded from blocked-threshold gating.

## Verification

- [x] Red step: `node --test scripts/tests/aios-orchestrator.test.mjs` (2 new tests failed before implementation).
- [x] Green step: `node --test scripts/tests/aios-orchestrator.test.mjs` (all 75 tests passed).
- [x] Controlled live sample:
  - Command: `AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_SIMULATE=1 node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute live --format json`
  - Result: `clarityGate.needsHuman=false`, `boundaryCrossingSignals=[]`, `blockedCheckpoints=0`, `blockedCheckpointsTotal=4`, `blockedCheckpointsExcluded=4`.
  - Baseline comparison: prior event `seq=71` was blocked with `blocked checkpoints (...)` + `auth/payment/policy boundary signals`.

## ContextDB Update

- [x] Event added: `codex-cli-20260303T080437-065e16c0#77`.
- [x] Checkpoint added: `codex-cli-20260303T080437-065e16c0#C104`.
- [x] Context packet refreshed: [codex-cli-20260303T080437-065e16c0-context.md](/Users/rex/cool.cnb/rex-ai-boot/memory/context-db/exports/codex-cli-20260303T080437-065e16c0-context.md).

## Next Actions

1. Monitor the next 1-2 live runs for clarity-gate reason drift.
2. Re-run `learn-eval` after additional checkpoints to confirm the `clarity-needs-input` trend decreases.
