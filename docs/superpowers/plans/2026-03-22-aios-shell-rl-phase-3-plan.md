# AIOS Shell RL Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-repository online shell RL with micro-batch updates, automatic rollback, epoch tracking, and deterministic replay routing on top of the existing Phase 2 runtime.

**Architecture:** Implement Phase 3 in three chunks. Chunk 1 adds the control-plane primitives and schema changes needed to represent epochs, checkpoint pointers, and replay routing. Chunk 2 wires those primitives into the real-task runtime so batches, updates, replay-only epochs, and rollback all run through one deterministic event sequence. Chunk 3 adds evaluation, operator-facing commands, and run summaries so the new online path is measurable and debuggable.

**Tech Stack:** Node 22 ESM, built-in `node:test`, existing `scripts/lib/rl-shell-v1/*` runtime, git worktrees for real-task isolation, JSON artifact persistence under `experiments/rl-shell-v1`, existing ContextDB summary writer.

---

## File Structure

### Existing Files To Modify

- `scripts/lib/rl-shell-v1/schema.mjs`
  - add Phase 3 checkpoint, epoch, comparison, verification, and replay-routing fields.
- `memory/specs/rl-shell-v1-run-summary.schema.json`
  - add Phase 3 control-plane, rollback, and online-update summary fields.
- `scripts/lib/rl-shell-v1/trajectory-store.mjs`
  - persist live-batch metadata, diagnostic-only trajectories, and control-event lineage.
- `scripts/lib/rl-shell-v1/real-task-registry.mjs`
  - expose reproducible task metadata needed for admission and comparison routing.
- `scripts/lib/rl-shell-v1/replay-pool.mjs`
  - separate replay lanes from diagnostic-only storage and consume Phase 3 routing fields.
- `scripts/lib/rl-shell-v1/trainer.mjs`
  - add online micro-batch update entry points and update-failure disposition hooks.
- `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
  - become the single serialized controller for epochs, updates, comparison recording, and rollback.
- `scripts/lib/rl-shell-v1/eval-harness.mjs`
  - report Phase 3 matched real-task metrics, rollback metrics, and campaign acceptance.
- `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
  - write Phase 3 campaign summaries with checkpoint lineage and rollback evidence.
- `scripts/rl-shell-v1.mjs`
  - expose Phase 3 commands and flags without changing unrelated CLI surfaces.
- `package.json`
  - add Phase 3 test and smoke scripts only if needed.
- `README.md`
  - document the new Phase 3 control loop and operator constraints.
- `scripts/tests/rl-shell-v1-schema.test.mjs`
- `scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
- `scripts/tests/rl-shell-v1-replay-pool.test.mjs`
- `scripts/tests/rl-shell-v1-trainer.test.mjs`
- `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
- `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
  - extend existing coverage to the Phase 3 control path.

### New Files To Create

- `scripts/lib/rl-shell-v1/control-state-store.mjs`
  - persist serialized control state, event ids, and restart-safe pointer snapshots.
- `scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs`
  - own checkpoint pointer reads/writes and atomic transition helpers.
- `scripts/lib/rl-shell-v1/epoch-ledger.mjs`
  - own epoch status, close conditions, streak tracking, and promotion eligibility.
- `scripts/tests/rl-shell-v1-control-state-store.test.mjs`
- `scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs`
- `scripts/tests/rl-shell-v1-epoch-ledger.test.mjs`
  - focused tests for each new control-plane module.

## Chunk 1: Control Plane And Data Contracts

### Task 1: Extend schemas and run-summary metadata for Phase 3

**Files:**
- Modify: `scripts/lib/rl-shell-v1/schema.mjs`
- Modify: `scripts/tests/rl-shell-v1-schema.test.mjs`
- Modify: `memory/specs/rl-shell-v1-run-summary.schema.json`

- [ ] **Step 1: Write failing schema tests for Phase 3 fields**

Add assertions like:

```js
assert.throws(
  () => validateEpisodeRecord({ ...episode, update_epoch_id: undefined }),
  /update_epoch_id/i
);

assert.doesNotThrow(validateEpisodeRecord({
  ...episode,
  verification_executed: true,
  verification_passed: false,
  comparison_status: 'completed',
  relative_outcome: 'worse',
  replay_route: 'negative',
  update_epoch_id: 'epoch-7',
}));
```

- [ ] **Step 2: Run schema tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: FAIL with missing validation for Phase 3 fields.

- [ ] **Step 3: Implement minimal schema and summary changes**

Update `schema.mjs` and run-summary schema so they require:

- `update_epoch_id`
- `verification_executed`
- `verification_passed`
- `comparison_status`
- `relative_outcome`
- `replay_route`
- checkpoint lineage fields:
  - `pre_update_ref_checkpoint_id`
  - `batch_id`
  - `rollback_batch`
  - `admission_status`
  - `admission_reason`
- rollback and online-update summary counts:
  - `updates_completed`
  - `updates_failed`
  - `rollbacks_completed`
  - `replay_only_epochs`
  - `comparison_failed_count`

- [ ] **Step 4: Re-run schema tests**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/schema.mjs scripts/tests/rl-shell-v1-schema.test.mjs memory/specs/rl-shell-v1-run-summary.schema.json
git commit -m "feat(rl): extend shell rl schemas for phase 3"
```

### Task 2: Add restart-safe control-state storage and checkpoint pointer ownership

**Files:**
- Create: `scripts/lib/rl-shell-v1/control-state-store.mjs`
- Create: `scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs`
- Create: `scripts/tests/rl-shell-v1-control-state-store.test.mjs`
- Create: `scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs`

- [ ] **Step 1: Write failing tests for control-state durability and idempotent event application**

Add tests covering:

```js
test('applyControlEvent ignores duplicate event ids', async () => {
  await applyControlEvent(store, event);
  await applyControlEvent(store, event);
  const snapshot = await readControlSnapshot(store);
  assert.equal(snapshot.appliedEventIds.length, 1);
});

test('checkpoint registry applies pointer transition atomically', async () => {
  const next = applyPointerTransition(current, {
    type: 'update.completed',
    new_active_checkpoint_id: 'ckpt-b',
    previous_active_checkpoint_id: 'ckpt-a',
  });
  assert.equal(next.active_checkpoint_id, 'ckpt-b');
  assert.equal(next.pre_update_ref_checkpoint_id, 'ckpt-a');
});

test('checkpoint registry covers promotion close, update failure, rollback, and invalid transitions', () => {
  assert.doesNotThrow(() => applyPointerTransition(state, { type: 'epoch.closed', promotion_eligible: true }));
  assert.doesNotThrow(() => applyPointerTransition(state, { type: 'update.failed' }));
  assert.doesNotThrow(() => applyPointerTransition(state, { type: 'rollback.completed', restored_checkpoint_id: 'ckpt-a' }));
  assert.throws(() => applyPointerTransition(state, { type: 'rollback.completed' }), /restored_checkpoint_id/i);
});
```

- [ ] **Step 2: Run the new control-state tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement `control-state-store.mjs`**

Create a small state store that:

- persists the latest control snapshot,
- records applied event ids,
- exposes atomic read/write helpers,
- stores enough state for restart recovery.

- [ ] **Step 4: Implement `active-checkpoint-registry.mjs`**

Add helpers that:

- own all pointer writes,
- apply only spec-defined transitions,
- reject invalid transition/event combinations,
- expose current `active`, `pre_update_ref`, and `last_stable`.

- [ ] **Step 5: Re-run the new control-state tests**

Run: `node --test scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/control-state-store.mjs scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs
git commit -m "feat(rl): add shell rl phase 3 control state"
```

### Task 3: Add epoch-ledger and deterministic replay-route decisions

**Files:**
- Create: `scripts/lib/rl-shell-v1/epoch-ledger.mjs`
- Modify: `scripts/lib/rl-shell-v1/replay-pool.mjs`
- Modify: `scripts/tests/rl-shell-v1-replay-pool.test.mjs`
- Create: `scripts/tests/rl-shell-v1-epoch-ledger.test.mjs`

- [ ] **Step 1: Write failing tests for epoch closure, replay-only recovery, and replay routing**

Add tests like:

```js
test('epoch closes as replay_only when any comparison fails', () => {
  const epoch = recordComparisonResults(seedEpoch(), [
    { comparison_status: 'completed', relative_outcome: 'better' },
    { comparison_status: 'comparison_failed', relative_outcome: null },
    { comparison_status: 'completed', relative_outcome: 'same' },
    { comparison_status: 'completed', relative_outcome: 'better' },
  ]);
  assert.equal(epoch.close_reason, 'replay_only');
  assert.equal(epoch.promotion_eligible, false);
});

test('replay pool keeps comparison_failed trajectories out of training lanes', () => {
  const route = classifyReplayRoute({
    comparison_status: 'comparison_failed',
    rollback_batch: false,
  });
  assert.equal(route, 'diagnostic_only');
});
```

- [ ] **Step 2: Run epoch and replay tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-epoch-ledger.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs`
Expected: FAIL because Phase 3 epoch and route logic is not implemented.

- [ ] **Step 3: Implement `epoch-ledger.mjs`**

Add deterministic helpers for:

- opening the initial collection epoch,
- recording admissions and comparisons,
- computing `promotion_eligible | replay_only | rolled_back`,
- tracking degradation streaks,
- reopening collection epochs after clean close or `update_failed`,
- reopening monitoring epochs after `replay_only`.

- [ ] **Step 4: Extend replay routing**

Update `replay-pool.mjs` so it routes:

- `better` -> `positive`
- `same` with `comparison_status=completed` -> `neutral`
- `worse` or `rollback_batch` -> `negative`
- `comparison_failed` and `update_failed` -> `diagnostic_only`

- [ ] **Step 5: Re-run epoch and replay tests**

Run: `node --test scripts/tests/rl-shell-v1-epoch-ledger.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs`
Expected: PASS

- [ ] **Step 6: Run the full Chunk 1 control-plane test set**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs scripts/tests/rl-shell-v1-epoch-ledger.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/rl-shell-v1/epoch-ledger.mjs scripts/lib/rl-shell-v1/replay-pool.mjs scripts/tests/rl-shell-v1-epoch-ledger.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs
git commit -m "feat(rl): add shell rl phase 3 epoch control"
```

## Chunk 2: Real-Task Online Update Flow

### Task 4: Persist Phase 3 real-task admission and trajectory evidence

**Files:**
- Modify: `scripts/lib/rl-shell-v1/real-task-registry.mjs`
- Modify: `scripts/lib/rl-shell-v1/worktree-runner.mjs`
- Modify: `scripts/lib/rl-shell-v1/trajectory-store.mjs`
- Modify: `scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`

- [ ] **Step 1: Add failing tests for reproducibility gating and diagnostic-only persistence**

Add coverage for:

```js
test('real task registry marks task reproducibility and task family metadata', async () => {
  const task = await buildRealTask(...);
  assert.equal(typeof task.reproducible, 'boolean');
  assert.match(task.task_family, /failing_tests|typecheck|build/);
});

test('trajectory store keeps update_failed and diagnostic_only records separate from replay lanes', async () => {
  await writeEpisode(store, {
    ...episode,
    replay_route: 'diagnostic_only',
    diagnostic_reason: 'comparison_failed',
  });
  const replay = await readReplayEligible(store);
  assert.equal(replay.length, 0);
});
```

- [ ] **Step 2: Run real-task registry and trajectory-store tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-real-task-registry.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: FAIL on missing reproducibility/admission fields and diagnostic-only handling.

- [ ] **Step 3: Extend real-task metadata and worktree outputs**

Update:

- `real-task-registry.mjs` to emit reproducibility and task-family fields used by Phase 3 admission,
- `worktree-runner.mjs` to expose structured verification execution results,
- `trajectory-store.mjs` to persist control-event ids, replay routes, and diagnostic-only records.

- [ ] **Step 4: Re-run real-task registry and trajectory-store tests**

Run: `node --test scripts/tests/rl-shell-v1-real-task-registry.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/real-task-registry.mjs scripts/lib/rl-shell-v1/worktree-runner.mjs scripts/lib/rl-shell-v1/trajectory-store.mjs scripts/tests/rl-shell-v1-real-task-registry.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs
git commit -m "feat(rl): persist phase 3 real-task evidence"
```

### Task 5: Wire the serialized epoch/update/rollback controller into the orchestrator

**Files:**
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/lib/rl-shell-v1/trainer.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-trainer.test.mjs`

- [ ] **Step 1: Add failing orchestrator tests for first update, replay-only recovery, and rollback**

Add cases for:

```js
test('orchestrator opens first collection epoch and triggers update after 4 admitted trajectories', async () => {
  const result = await runPhase3Campaign({ ...config, maxTasks: 4, deps });
  assert.equal(result.updatesCompleted, 1);
  assert.equal(result.currentEpoch.phase, 'monitoring');
});

test('orchestrator reopens monitoring after replay_only without promoting a new batch', async () => {
  const result = await runPhase3Campaign({ ...config, deps: replayOnlyDeps });
  assert.equal(result.replayOnlyEpochs, 1);
  assert.equal(result.updatesCompleted, 1);
});

test('orchestrator auto-rolls back after three worse outcomes without an intervening better', async () => {
  const result = await runPhase3Campaign({ ...config, deps: rollbackDeps });
  assert.equal(result.rollbacksCompleted, 1);
  assert.equal(result.activeCheckpointId, result.lastStableCheckpointId);
});
```

- [ ] **Step 2: Run orchestrator and trainer tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: FAIL because the current orchestrator has no Phase 3 control loop.

- [ ] **Step 3: Implement serialized Phase 3 control flow**

Update `run-orchestrator.mjs` so it:

- reads and writes control state through `control-state-store.mjs`,
- delegates pointer writes to `active-checkpoint-registry.mjs`,
- delegates epoch state to `epoch-ledger.mjs`,
- persists `trajectory.persisted`, `trajectory.admitted`, `comparison.recorded`, `epoch.closed`, `update.completed`, `update.failed`, `rollback.completed`, and `rollback.failed` events,
- runs only one control-plane mutation at a time.

- [ ] **Step 4: Extend trainer entry points for online micro-batches**

Update `trainer.mjs` to expose:

- `runOnlineUpdateBatch()`
- structured update failure results
- deterministic batch ids/checkpoint ids for tests

- [ ] **Step 5: Re-run orchestrator and trainer tests**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/lib/rl-shell-v1/trainer.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs
git commit -m "feat(rl): add phase 3 online epoch controller"
```

### Task 6: Add crash-safe event replay and restart recovery

**Files:**
- Modify: `scripts/lib/rl-shell-v1/control-state-store.mjs`
- Modify: `scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs`
- Modify: `scripts/lib/rl-shell-v1/epoch-ledger.mjs`
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/tests/rl-shell-v1-control-state-store.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`

- [ ] **Step 1: Add failing restart tests**

Add coverage for:

```js
test('orchestrator resumes from persisted control snapshot without reapplying duplicate events', async () => {
  await runPhase3Campaign({ ...config, maxTasks: 4, deps });
  const resumed = await runPhase3Campaign({ ...config, resume: true, deps });
  assert.equal(resumed.duplicateEventApplications, 0);
});

test('rollback failure enters frozen_failure mode and blocks further updates', async () => {
  const result = await runPhase3Campaign({ ...config, deps: rollbackFailureDeps });
  assert.equal(result.controlState.mode, 'frozen_failure');
  assert.equal(result.updatesAfterFreeze, 0);
});
```

- [ ] **Step 2: Run control-state and orchestrator tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL because restart/idempotency semantics are not enforced yet.

- [ ] **Step 3: Implement restart recovery and idempotent replay**

Update the control plane so restart logic:

- loads the persisted control snapshot,
- ignores duplicate event ids,
- rebuilds epoch state from the last committed control snapshot,
- blocks online updates when control mode is `frozen_failure`.

- [ ] **Step 4: Re-run control-state and orchestrator tests**

Run: `node --test scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/control-state-store.mjs scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs scripts/lib/rl-shell-v1/epoch-ledger.mjs scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs
git commit -m "feat(rl): harden phase 3 restart and rollback safety"
```

## Chunk 3: Evaluation, Reporting, And Operator Surface

### Task 7: Extend evaluation and summaries for Phase 3 acceptance metrics

**Files:**
- Modify: `scripts/lib/rl-shell-v1/eval-harness.mjs`
- Modify: `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
- Modify: `scripts/tests/rl-shell-v1-eval-harness.test.mjs`

- [ ] **Step 1: Add failing evaluation tests for matched comparison and rollback metrics**

Add assertions for:

```js
test('eval harness reports better/same/worse and comparison_failed counts', async () => {
  const summary = await evaluatePhase3Run({ runDir });
  assert.equal(summary.better_count, 3);
  assert.equal(summary.comparison_failed_count, 1);
});

test('contextdb summary includes checkpoint lineage and rollback evidence', async () => {
  const payload = buildPhase3ContextSummary({ runSummary });
  assert.equal(payload.last_stable_checkpoint_id, 'ckpt-9');
  assert.equal(payload.rollbacks_completed, 1);
});
```

- [ ] **Step 2: Run eval-harness tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: FAIL because Phase 3 metrics are not emitted.

- [ ] **Step 3: Implement Phase 3 evaluation metrics**

Update `eval-harness.mjs` and `contextdb-summary.mjs` to emit:

- `better/same/worse/comparison_failed`
- update counts
- rollback counts
- replay-only epoch counts
- checkpoint lineage
- teacher-shaping alignment rate

- [ ] **Step 4: Re-run eval-harness tests**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/eval-harness.mjs scripts/lib/rl-shell-v1/contextdb-summary.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs
git commit -m "feat(rl): add phase 3 evaluation metrics"
```

### Task 8: Expose Phase 3 commands, docs, and verification scripts

**Files:**
- Modify: `scripts/rl-shell-v1.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add failing command-surface tests or smoke assertions**

If there is no command-surface test file yet, add a small smoke assertion to an existing orchestrator CLI test or document the smoke check in the task notes. Minimum expected checks:

```js
assert.match(helpText, /phase 3/i);
assert.match(helpText, /--resume/);
```

- [ ] **Step 2: Run the relevant smoke test to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL on missing Phase 3 CLI surface or smoke assertions.

- [ ] **Step 3: Implement the operator surface**

Update:

- `scripts/rl-shell-v1.mjs` to expose `phase3-train`, `phase3-eval`, and `phase3-resume` modes or equivalent Phase 3 flags,
- `package.json` to include one deterministic Phase 3 smoke command,
- `README.md` to document:
  - temporary-worktree isolation,
  - online updates every 4 trajectories,
  - automatic rollback,
  - frozen-failure behavior.

- [ ] **Step 4: Re-run the smoke test**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: PASS

- [ ] **Step 5: Run the full Phase 3 test suite**

Run: `node --test scripts/tests/rl-shell-v1-*.test.mjs`
Expected: PASS

- [ ] **Step 6: Run one end-to-end Phase 3 smoke command**

Run: `node scripts/rl-shell-v1.mjs phase3-train --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli`
Expected: exit code `0` and a run summary with Phase 3 fields.

- [ ] **Step 7: Commit**

```bash
git add scripts/rl-shell-v1.mjs package.json README.md
git commit -m "feat(rl): expose shell rl phase 3 operator surface"
```

## Plan Review Notes

- Implement in order. Do not skip Chunk 1; the Phase 3 control plane will be unstable if orchestrator work starts before checkpoint and epoch primitives exist.
- Keep pointer writes inside `active-checkpoint-registry.mjs` only. Other modules may request transitions, but they may not mutate pointers directly.
- Keep `diagnostic_only` storage out of replay training input paths.
- Preserve the existing Phase 2 command surfaces while adding Phase 3 flags or subcommands.
