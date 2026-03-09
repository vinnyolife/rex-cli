# AIOS Dispatch Evidence And Executors Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade local orchestration from a single placeholder executor into explicit executor roles, expose stable executor capability manifests, and persist dry-run execution evidence back into ContextDB.

**Scope:**
- Split `local-placeholder` into stable local executors for phase work and merge-gate work.
- Move executor capability metadata into a reusable manifest/spec.
- Persist dry-run evidence only for `orchestrate --session ... --dispatch local --execute dry-run`.
- Reuse existing ContextDB append/write behavior so both JSONL and SQLite sidecar stay in sync.
- Do not attach any real model runtime or remote subagent execution.

**Design Notes:**
- `buildLocalDispatchPlan` continues to produce the DAG; executor resolution remains additive.
- Executor metadata should be machine-readable in both `dispatchPlan` and `dispatchRun`.
- Dry-run persistence should write a JSON artifact plus one event and one checkpoint.
- A successful dry-run should not mark the session `done`; it should remain `running` with partial verification evidence.
- A blocked dry-run should mark the checkpoint `blocked` and carry a failure category.

---

### Task 1: Update design docs and declarative specs

**Files:**
- Modify: `docs/plans/2026-03-09-aios-orchestrator-blueprints-design.md`
- Add: `docs/plans/2026-03-09-aios-dispatch-evidence-and-executors-plan.md`
- Add: `memory/specs/orchestrator-executors.json`

### Task 2: Add tests for executor split and evidence persistence

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

### Task 3: Implement executor manifest and routing

**Files:**
- Modify: `scripts/lib/harness/orchestrator-executors.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`

### Task 4: Implement ContextDB evidence persistence

**Files:**
- Add: `scripts/lib/contextdb-cli.mjs`
- Add: `scripts/lib/harness/orchestrator-evidence.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

### Task 5: Verify end-to-end

**Verification:**
- `node --test scripts/tests/aios-orchestrator.test.mjs`
- `npm run test:scripts`
- `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
- `cd mcp-server && npm run typecheck && npm run build`
