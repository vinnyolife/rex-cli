# AIOS RL Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a stable shared RL control layer into `scripts/lib/rl-core/`, migrate shell RL to import it, and preserve current shell Phase 3 behavior without regression.

**Architecture:** Build `rl-core` as a focused library module tree that owns shared contracts, control state, checkpoint lineage, replay routing, trainer entry points, teacher contracts, and the serialized campaign controller. Migrate `rl-shell-v1` incrementally to import `rl-core` primitives first, then replace shell-owned control logic with adapter-facing `rl-core` calls while keeping the current shell CLI and tests green.

**Tech Stack:** Node 22 ESM, built-in `node:test`, existing `scripts/lib/rl-shell-v1/*` runtime, JSON schema validation, existing ContextDB summary writer, git worktrees.

---

## File Structure

### New Files To Create

- `scripts/lib/rl-core/contracts.mjs`
  - shared object builders and constants for episodes, batches, comparisons, replay lanes, checkpoint lineage, and update results.
- `scripts/lib/rl-core/schema.mjs`
  - shared validation for `rl-core` public contracts.
- `scripts/lib/rl-core/control-state-store.mjs`
  - shared restart-safe snapshot persistence and duplicate event suppression.
- `scripts/lib/rl-core/checkpoint-registry.mjs`
  - shared pointer transition helpers.
- `scripts/lib/rl-core/epoch-ledger.mjs`
  - shared epoch and degradation bookkeeping.
- `scripts/lib/rl-core/comparison-engine.mjs`
  - normalized `better/same/worse/comparison_failed` helpers.
- `scripts/lib/rl-core/reward-engine.mjs`
  - terminal reward + teacher shaping aggregation.
- `scripts/lib/rl-core/replay-pool.mjs`
  - shared replay lane routing and persistence helpers.
- `scripts/lib/rl-core/trainer.mjs`
  - shared online/offline update entry points and reference refresh helpers.
- `scripts/lib/rl-core/teacher-gateway.mjs`
  - shared teacher normalization and fallback handling.
- `scripts/lib/rl-core/campaign-controller.mjs`
  - shared serialized control loop for admission, update, comparison, rollback, and replay routing.
- `scripts/tests/rl-core-schema.test.mjs`
- `scripts/tests/rl-core-control-state-store.test.mjs`
- `scripts/tests/rl-core-checkpoint-registry.test.mjs`
- `scripts/tests/rl-core-epoch-ledger.test.mjs`
- `scripts/tests/rl-core-comparison-engine.test.mjs`
- `scripts/tests/rl-core-reward-engine.test.mjs`
- `scripts/tests/rl-core-replay-pool.test.mjs`
- `scripts/tests/rl-core-trainer.test.mjs`
- `scripts/tests/rl-core-teacher-gateway.test.mjs`
- `scripts/tests/rl-core-campaign-controller.test.mjs`

### Existing Files To Modify

- `scripts/lib/rl-shell-v1/schema.mjs`
  - re-export or delegate shared validation to `rl-core/schema.mjs` while preserving shell-specific fields.
- `scripts/lib/rl-shell-v1/control-state-store.mjs`
  - reduce to shell-compatible wrapper or thin re-export over `rl-core/control-state-store.mjs`.
- `scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs`
  - reduce to wrapper/re-export over `rl-core/checkpoint-registry.mjs`.
- `scripts/lib/rl-shell-v1/epoch-ledger.mjs`
  - reduce to wrapper/re-export over `rl-core/epoch-ledger.mjs`.
- `scripts/lib/rl-shell-v1/replay-pool.mjs`
  - delegate shared replay route logic to `rl-core/replay-pool.mjs`.
- `scripts/lib/rl-shell-v1/reward-fusion.mjs`
  - delegate shared fused reward behavior to `rl-core/reward-engine.mjs`.
- `scripts/lib/rl-shell-v1/trainer.mjs`
  - delegate shared trainer logic to `rl-core/trainer.mjs`.
- `scripts/lib/rl-shell-v1/teacher-gateway.mjs`
  - delegate normalization and fallback semantics to `rl-core/teacher-gateway.mjs`.
- `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
  - import `rl-core/campaign-controller.mjs` and use it for the Phase 3 control path.
- `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
  - continue shell-specific summary writing but consume shared summary-compatible fields.
- `scripts/tests/rl-shell-v1-*.test.mjs`
  - keep shell coverage green while migrating internals onto `rl-core`.
- `README.md`
  - document `rl-core` as the shared RL control layer.
- `package.json`
  - add focused `rl-core` test script only if useful.

## Chunk 1: Extract Shared Core Contracts And Primitives

### Task 1: Add `rl-core` contracts and schema

**Files:**
- Create: `scripts/lib/rl-core/contracts.mjs`
- Create: `scripts/lib/rl-core/schema.mjs`
- Create: `scripts/tests/rl-core-schema.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/schema.mjs`
- Modify: `scripts/tests/rl-shell-v1-schema.test.mjs`

- [ ] **Step 1: Write failing `rl-core` schema tests**

Add tests covering:

```js
assert.doesNotThrow(() => validateCheckpointLineage({
  active_checkpoint_id: 'ckpt-a',
  pre_update_ref_checkpoint_id: null,
  last_stable_checkpoint_id: 'ckpt-a',
}));

assert.throws(
  () => validateComparisonResult({ comparison_status: 'completed', relative_outcome: null }),
  /relative_outcome/i
);
```

- [ ] **Step 2: Run the new schema tests to verify failure**

Run: `node --test scripts/tests/rl-core-schema.test.mjs`
Expected: FAIL because `rl-core/schema.mjs` does not exist yet.

- [ ] **Step 3: Implement shared contracts and schema**

Create:

- `contracts.mjs` with enums/constants for:
  - replay routes
  - comparison statuses
  - relative outcomes
  - control modes
  - update result statuses
- `schema.mjs` with validators for:
  - checkpoint lineage
  - comparison result
  - replay candidate
  - teacher response
  - online update result

Keep shell-specific schema in `rl-shell-v1/schema.mjs`, but delegate shared checks to `rl-core/schema.mjs`.

- [ ] **Step 4: Re-run schema tests**

Run: `node --test scripts/tests/rl-core-schema.test.mjs scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/contracts.mjs scripts/lib/rl-core/schema.mjs scripts/tests/rl-core-schema.test.mjs scripts/lib/rl-shell-v1/schema.mjs scripts/tests/rl-shell-v1-schema.test.mjs
git commit -m "feat(rl-core): add shared contracts and schema"
```

### Task 2: Move control state, checkpoint lineage, and epoch logic into `rl-core`

**Files:**
- Create: `scripts/lib/rl-core/control-state-store.mjs`
- Create: `scripts/lib/rl-core/checkpoint-registry.mjs`
- Create: `scripts/lib/rl-core/epoch-ledger.mjs`
- Create: `scripts/tests/rl-core-control-state-store.test.mjs`
- Create: `scripts/tests/rl-core-checkpoint-registry.test.mjs`
- Create: `scripts/tests/rl-core-epoch-ledger.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/control-state-store.mjs`
- Modify: `scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs`
- Modify: `scripts/lib/rl-shell-v1/epoch-ledger.mjs`
- Modify: `scripts/tests/rl-shell-v1-control-state-store.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-epoch-ledger.test.mjs`

- [ ] **Step 1: Write failing `rl-core` control-plane tests**

Add tests like:

```js
test('rl-core control state ignores duplicate event ids', async () => {
  await applyControlEvent(store, event);
  await applyControlEvent(store, event);
  assert.equal((await readControlSnapshot(store)).applied_event_ids.length, 1);
});

test('rl-core checkpoint registry transitions update, close, and rollback', () => {
  assert.equal(applyPointerTransition(state, event).active_checkpoint_id, 'ckpt-b');
});
```

- [ ] **Step 2: Run the new control-plane tests to verify failure**

Run: `node --test scripts/tests/rl-core-control-state-store.test.mjs scripts/tests/rl-core-checkpoint-registry.test.mjs scripts/tests/rl-core-epoch-ledger.test.mjs`
Expected: FAIL because the `rl-core` modules do not exist yet.

- [ ] **Step 3: Implement `rl-core` control-plane modules**

Move shared logic from shell equivalents into:

- `control-state-store.mjs`
- `checkpoint-registry.mjs`
- `epoch-ledger.mjs`

Then turn shell modules into thin wrappers or re-exports that preserve existing import paths.

- [ ] **Step 4: Re-run both new `rl-core` tests and shell compatibility tests**

Run: `node --test scripts/tests/rl-core-control-state-store.test.mjs scripts/tests/rl-core-checkpoint-registry.test.mjs scripts/tests/rl-core-epoch-ledger.test.mjs scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs scripts/tests/rl-shell-v1-epoch-ledger.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/control-state-store.mjs scripts/lib/rl-core/checkpoint-registry.mjs scripts/lib/rl-core/epoch-ledger.mjs scripts/tests/rl-core-control-state-store.test.mjs scripts/tests/rl-core-checkpoint-registry.test.mjs scripts/tests/rl-core-epoch-ledger.test.mjs scripts/lib/rl-shell-v1/control-state-store.mjs scripts/lib/rl-shell-v1/active-checkpoint-registry.mjs scripts/lib/rl-shell-v1/epoch-ledger.mjs scripts/tests/rl-shell-v1-control-state-store.test.mjs scripts/tests/rl-shell-v1-active-checkpoint-registry.test.mjs scripts/tests/rl-shell-v1-epoch-ledger.test.mjs
git commit -m "feat(rl-core): extract shared control state and epoch logic"
```

## Chunk 2: Extract Shared Learning Units

### Task 3: Move shared reward, replay, trainer, and teacher logic into `rl-core`

**Files:**
- Create: `scripts/lib/rl-core/reward-engine.mjs`
- Create: `scripts/lib/rl-core/replay-pool.mjs`
- Create: `scripts/lib/rl-core/trainer.mjs`
- Create: `scripts/lib/rl-core/teacher-gateway.mjs`
- Create: `scripts/tests/rl-core-reward-engine.test.mjs`
- Create: `scripts/tests/rl-core-replay-pool.test.mjs`
- Create: `scripts/tests/rl-core-trainer.test.mjs`
- Create: `scripts/tests/rl-core-teacher-gateway.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/reward-fusion.mjs`
- Modify: `scripts/lib/rl-shell-v1/replay-pool.mjs`
- Modify: `scripts/lib/rl-shell-v1/trainer.mjs`
- Modify: `scripts/lib/rl-shell-v1/teacher-gateway.mjs`
- Modify: `scripts/tests/rl-shell-v1-reward-fusion.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-replay-pool.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-trainer.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-teacher-gateway.test.mjs`

- [ ] **Step 1: Write failing `rl-core` learning-unit tests**

Add focused tests for:

```js
assert.equal(fuseReward({ terminalReward: 1, shapingScore: 0.4, callStatus: 'complete' }).fusedReward > 1, true);
assert.equal(classifyReplayRoute({ comparison_status: 'comparison_failed' }), 'diagnostic_only');
assert.equal(runOnlineUpdateBatch(...).status, 'ok');
assert.equal(normalizeTeacherResponse(...).call_status, 'complete');
```

- [ ] **Step 2: Run the new tests to verify failure**

Run: `node --test scripts/tests/rl-core-reward-engine.test.mjs scripts/tests/rl-core-replay-pool.test.mjs scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-core-teacher-gateway.test.mjs`
Expected: FAIL because the `rl-core` learning modules do not exist yet.

- [ ] **Step 3: Implement shared learning modules**

Extract shared logic into the new `rl-core` files and reduce shell modules to thin wrappers over them.

Preserve:

- shell reward behavior,
- replay lane behavior,
- trainer batch ids and failure semantics,
- teacher fallback normalization.

- [ ] **Step 4: Re-run new and existing tests**

Run: `node --test scripts/tests/rl-core-reward-engine.test.mjs scripts/tests/rl-core-replay-pool.test.mjs scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-core-teacher-gateway.test.mjs scripts/tests/rl-shell-v1-reward-fusion.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-teacher-gateway.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/reward-engine.mjs scripts/lib/rl-core/replay-pool.mjs scripts/lib/rl-core/trainer.mjs scripts/lib/rl-core/teacher-gateway.mjs scripts/tests/rl-core-reward-engine.test.mjs scripts/tests/rl-core-replay-pool.test.mjs scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-core-teacher-gateway.test.mjs scripts/lib/rl-shell-v1/reward-fusion.mjs scripts/lib/rl-shell-v1/replay-pool.mjs scripts/lib/rl-shell-v1/trainer.mjs scripts/lib/rl-shell-v1/teacher-gateway.mjs scripts/tests/rl-shell-v1-reward-fusion.test.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-teacher-gateway.test.mjs
git commit -m "feat(rl-core): extract shared learning units"
```

### Task 4: Add shared comparison engine and campaign controller

**Files:**
- Create: `scripts/lib/rl-core/comparison-engine.mjs`
- Create: `scripts/lib/rl-core/campaign-controller.mjs`
- Create: `scripts/tests/rl-core-comparison-engine.test.mjs`
- Create: `scripts/tests/rl-core-campaign-controller.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`

- [ ] **Step 1: Write failing comparison/controller tests**

Add tests covering:

```js
test('comparison engine normalizes better/same/worse/comparison_failed', () => {
  assert.equal(compareResults(...).relative_outcome, 'better');
});

test('campaign controller promotes, reopens replay_only, and rolls back on three worse results', async () => {
  const result = await runCampaignController({ ... });
  assert.equal(result.rollbacksCompleted, 1);
});
```

- [ ] **Step 2: Run the new `rl-core` controller tests to verify failure**

Run: `node --test scripts/tests/rl-core-comparison-engine.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs`
Expected: FAIL because the new modules do not exist yet.

- [ ] **Step 3: Implement shared comparison/controller modules**

Move common comparison and serialized control-loop logic into `rl-core`.

Then modify `rl-shell-v1/run-orchestrator.mjs` so Phase 3 paths delegate to `rl-core/campaign-controller.mjs` while shell still owns shell-specific task execution and CLI glue.

- [ ] **Step 4: Re-run `rl-core` tests and shell orchestrator tests**

Run: `node --test scripts/tests/rl-core-comparison-engine.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/comparison-engine.mjs scripts/lib/rl-core/campaign-controller.mjs scripts/tests/rl-core-comparison-engine.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs
git commit -m "feat(rl-core): add shared comparison and campaign control"
```

## Chunk 3: Migrate Shell To `rl-core` And Verify No Regression

### Task 5: Make shell Phase 3 import `rl-core` end-to-end

**Files:**
- Modify: `scripts/lib/rl-shell-v1/*.mjs` as needed
- Modify: `scripts/tests/rl-shell-v1-*.test.mjs`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add failing shell integration checks for `rl-core` delegation**

If there is no clean assertion yet, extend shell tests to verify behavior through the shell API while core modules are imported underneath. Minimum checks:

```js
assert.equal(result.activeCheckpointId, 'ckpt-b');
assert.equal(result.controlState.mode, 'frozen_failure');
```

and confirm shell wrappers still expose previous import paths.

- [ ] **Step 2: Run focused shell tests to verify any remaining integration failures**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL only if migration glue is incomplete.

- [ ] **Step 3: Finish shell migration**

Ensure shell modules now import `rl-core` instead of carrying duplicated logic.

Keep shell-only responsibilities in place:

- task registry
- student policy and runner
- temp/worktree execution
- real-task registry
- shell CLI
- shell-specific ContextDB summary wrapper

- [ ] **Step 4: Re-run full shell suite**

Run: `npm run test:rl-shell-v1`
Expected: PASS

- [ ] **Step 5: Run Phase 3 smoke on shell**

Run: `npm run rl-shell-v1:phase3:smoke`
Expected: exit code `0` and a printed Phase 3 summary with update/rollback fields.

- [ ] **Step 6: Update docs**

Document in `README.md` that:

- `rl-core` now owns shared RL control logic,
- shell is the first adapter migrated onto `rl-core`,
- browser and orchestrator adapters will follow.

- [ ] **Step 7: Commit**

```bash
git add README.md package.json scripts/lib/rl-shell-v1 scripts/tests/rl-shell-v1-*.test.mjs
git commit -m "feat(rl-core): migrate shell phase 3 onto shared core"
```

### Task 6: Run final verification and record implementation outcome

**Files:**
- Modify: `README.md` if final command references need polish
- Optionally modify: `package.json` if a focused `rl-core` test script improves maintainability

- [ ] **Step 1: Run `rl-core` focused tests**

Run: `node --test scripts/tests/rl-core-*.test.mjs`
Expected: PASS

- [ ] **Step 2: Run full shell suite again**

Run: `npm run test:rl-shell-v1`
Expected: PASS

- [ ] **Step 3: Run Phase 3 smoke again**

Run: `npm run rl-shell-v1:phase3:smoke`
Expected: exit code `0`

- [ ] **Step 4: Check git status**

Run: `git status --short`
Expected: only intended tracked changes remain.

- [ ] **Step 5: Commit final polish if needed**

```bash
git add README.md package.json
git commit -m "docs(rl-core): polish shared core integration notes"
```

Only do this if there are actual remaining doc/script changes.

## Notes

- Do not add browser or orchestrator adapters in this plan.
- Do not redesign shell task execution in this plan.
- Prefer wrapper/re-export migration where possible to reduce breakage.
- Preserve existing CLI surface for `rl-shell-v1` while changing its internals.
- Keep all code changes in a dedicated worktree before execution.
