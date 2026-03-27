# Clarity Gate Post-Tuning Follow-Up (session codex-cli-20260303T080437-065e16c0)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement follow-up changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm the March 26 clarity-gate tuning stays stable across additional live samples and document the current meaning of the blocked-checkpoint metrics for future triage.

**Architecture:** Treat this as an observability checkpoint, not a new behavior change. Re-run controlled live orchestration samples against the same session, compare the gate output with the prior March 26 baseline, then write down the metric semantics in the repo's existing `docs/plans/` history because there is no dedicated clarity-gate runbook file yet.

**Tech Stack:** Node.js CLI (`scripts/aios.mjs`), harness modules (`scripts/lib/harness/clarity-gate.mjs`), ContextDB artifacts under `memory/context-db/`.

---

## Observed On 2026-03-27

- Controlled live sample 1
  - Command: `AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_SIMULATE=1 node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute live --format json`
  - Artifact: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260327T073856Z.json`
  - Result: `clarityGate.needsHuman=false`, `boundaryCrossingSignals=[]`, `blockedCheckpoints=0`, `blockedCheckpointsTotal=2`, `blockedCheckpointsExcluded=2`
- Controlled live sample 2
  - Command: `AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_SIMULATE=1 node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute live --format json`
  - Artifact: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260327T073902Z.json`
  - Result: `clarityGate.needsHuman=false`, `boundaryCrossingSignals=[]`, `blockedCheckpoints=0`, `blockedCheckpointsTotal=1`, `blockedCheckpointsExcluded=1`
- Refreshed telemetry
  - Command: `node scripts/aios.mjs learn-eval --session codex-cli-20260303T080437-065e16c0 --limit 30 --format json`
  - Result: `blocked=10`, `clarity-needs-input=7`, `dispatch-runtime-blocked=3`, `avgElapsedMs=117516`
  - March 26 comparison point: `blocked=15`, `clarity-needs-input=9`, `dispatch-runtime-blocked=5`, `avgElapsedMs=123018`

## Metric Semantics

- `blockedCheckpointsTotal`
  - Raw blocked-checkpoint count from `learn-eval` for the current sample window.
  - This still includes historical `clarity-needs-input` checkpoints.
- `blockedCheckpointsExcluded`
  - Count of blocked checkpoints whose dominant failure category is `clarity-needs-input`.
  - This is the portion intentionally removed from the gate threshold calculation.
- `blockedCheckpoints`
  - Effective blocked count used by the clarity gate after exclusions.
  - Formula: `blockedCheckpointsTotal - blockedCheckpointsExcluded`
  - This is the value compared against `blockedCheckpointThreshold`.
- `boundaryCrossingSignals`
  - Now derived only from action-oriented snippets: `taskTitle`, `openQuestions`, and runtime `error`.
  - Narrative-only text such as `contextSummary`, `findings`, and `recommendations` is not supposed to trigger auth/payment/policy boundaries anymore.

## Interpretation

- The March 26 tuning held across two additional controlled live samples.
- The gate stayed clear even when the learn-eval window still contained historical clarity checkpoints, which is the exact failure mode the tuning was intended to fix.
- `runbook.failure-triage` still appears in learn-eval recommendations because the last-30-checkpoint window still contains older clarity failures. That recommendation is now lagging telemetry, not evidence of a fresh false positive in the March 27 live samples.

## Decision

- Treat the current clarity-gate metric semantics as stable enough to document.
- Keep using `docs/plans/` as the temporary runbook/history surface until the repo grows a dedicated clarity-gate runbook file.

## Next Actions

1. If a dedicated harness runbook directory is introduced later, move the metric semantics above into that canonical runbook.
2. After enough newer checkpoints replace the older March 16 failures, re-run `learn-eval` again to confirm `runbook.failure-triage` drops out of recommendations without any further code changes.
