# AIOS Learn-Eval Routing — Ordered Plan

**Date:** 2026-03-09  
**Status:** Drafted for execution

## Goal

Turn `learn-eval` from a generic recommendation reporter into a routed operator tool that can:

1. map recurring failure patterns to concrete gate/runbook recommendations,
2. map stable success patterns to concrete blueprint recommendations,
3. keep both outputs in one schema with deterministic priority.

## Ordering Decision

Execution order is:

1. `fix -> gate/runbook`
2. `promote -> blueprint/checklist`
3. shared schema + report cleanup

Reason:

- A broken workflow should not be promoted before it is stabilized.
- `fix` recommendations reduce risk immediately.
- `promote` is only valuable after failure-heavy paths are fenced off.

## Priority Rule

Use one recommendation model with strict precedence:

- `fix > observe > promote`

Interpretation:

- same domain conflict: `fix` suppresses `promote`
- different domain signals: both may appear in the same report
- low-confidence data: fall back to `observe`

## Task 1: Fix Routing to Concrete Gates/Runbooks

**Files:**
- Modify: `scripts/lib/harness/learn-eval.mjs`
- Modify: `scripts/lib/lifecycle/quality-gate.mjs`
- Modify: `scripts/tests/aios-learn-eval.test.mjs`

**What to add:**
- replace generic `fix` text with routed actions:
  - `auth -> auth preflight gate`
  - `timeout -> timeout budget gate`
  - `network -> retry/backoff gate`
  - `permission -> human approval gate`
  - `tool -> tooling repair runbook`
- add stable identifiers for recommendations such as:
  - `gate.auth-preflight`
  - `gate.timeout-budget`
  - `runbook.tool-repair`
- include a suggested next command or next artifact in each recommendation.

**Acceptance criteria:**
- `learn-eval` reports exact gate/runbook targets, not only prose.
- timeout-heavy sessions produce a deterministic timeout gate recommendation.
- tests cover at least auth, timeout, and tool buckets.

## Task 2: Promote Routing to Concrete Blueprints/Checklists

**Files:**
- Modify: `scripts/lib/harness/learn-eval.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`
- Modify: `memory/specs/orchestrator-blueprints.json`
- Modify: `scripts/tests/aios-learn-eval.test.mjs`
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

**What to add:**
- route stable success signals to concrete blueprint recommendations:
  - implementation-heavy success -> `feature`
  - failure-isolation success -> `bugfix`
  - low-risk cleanup success -> `refactor`
  - auth/security hardening success -> `security`
- surface a recommended `orchestrate <blueprint>` follow-up.
- keep promotion conservative: require enough known verification, low retries, and no blocked checkpoints.

**Acceptance criteria:**
- `learn-eval` emits a concrete blueprint id, not just “promote blueprint”.
- rendered report includes the exact follow-up command.
- promotion tests prove that blocked/failing flows do not produce blueprint recommendations.

## Task 3: Shared Recommendation Schema and Rendering Cleanup

**Files:**
- Modify: `scripts/lib/harness/learn-eval.mjs`
- Modify: `scripts/lib/lifecycle/learn-eval.mjs`
- Modify: `docs/plans/2026-03-09-aios-learn-eval-design.md`
- Modify: `scripts/tests/aios-learn-eval.test.mjs`

**What to add:**
- normalize all recommendation objects to a shared shape:
  - `kind`: `fix | observe | promote`
  - `targetType`: `gate | runbook | blueprint | checklist | sample`
  - `targetId`
  - `title`
  - `reason`
  - `evidence`
  - `priority`
  - `nextCommand?`
- sort rendered output by priority then evidence strength.
- preserve both `text` and `json` output modes.

**Acceptance criteria:**
- JSON output is stable enough for future automation.
- text output remains readable for humans.
- priority ordering is deterministic in tests.

## Verification Plan

Run after each task when implemented:

```bash
npm run test:scripts
cd mcp-server && npm run typecheck && npm run build
node scripts/aios.mjs learn-eval --limit 5
```

## Recommended Execution Sequence

- Phase A: Task 1 only
- Phase B: Task 2 only after Task 1 passes
- Phase C: Task 3 as cleanup and stabilization

This keeps the risk-reduction path shipping first while preserving a clean promotion path afterward.
