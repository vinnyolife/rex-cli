# AIOS Shell RL Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade shell RL v1 into a multi-step real-environment system, add real `aios` repository shadow evaluation, and introduce mixed offline replay with qualified real-sample priority.

**Architecture:** Build Phase 2 in three gated chunks. `2A` turns the synthetic runtime into a real multi-step episode loop. `2B` adds isolated real-repository shadow evaluation with temporary git worktrees and repeatability checks. `2C` adds mixed offline replay with strict quality gating and ablation-driven verification.

**Tech Stack:** Node 22 ESM, built-in `node:test`, existing `scripts/lib/rl-shell-v1/*` runtime, existing `scripts/lib/platform/process.mjs`, existing ContextDB CLI bridge, git worktrees for real-task isolation.

---

## File Structure

### Existing Files To Modify

- `scripts/lib/rl-shell-v1/schema.mjs`
  - extend episode, task, and replay metadata for multi-step traces, task source, stop conditions, and replay eligibility.
- `memory/specs/rl-shell-v1-run-summary.schema.json`
  - add Phase 2 summary fields only if run summaries need new acceptance metadata.
- `scripts/lib/rl-shell-v1/student-runner.mjs`
  - shift from one-shot action generation to step-driven multi-step prompting.
- `scripts/lib/rl-shell-v1/temp-runner.mjs`
  - add progress tracking, repeated-no-progress detection, and final verification evidence.
- `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
  - replace single-step synthetic orchestration with multi-step loop, shadow-eval routing, and replay-aware run metadata.
- `scripts/lib/rl-shell-v1/trajectory-store.mjs`
  - persist full multi-step traces and replay metadata.
- `scripts/lib/rl-shell-v1/trainer.mjs`
  - consume multi-step trajectories and replay batches.
- `scripts/lib/rl-shell-v1/eval-harness.mjs`
  - add 2A baseline comparison, real shadow metrics, and replay ablations.
- `scripts/rl-shell-v1.mjs`
  - expose Phase 2 subcommands and modes without touching `scripts/aios.mjs`.
- `package.json`
  - add Phase 2 test and smoke scripts.
- `README.md`
  - update the experimental shell RL workflow section.
- `scripts/tests/rl-shell-v1-schema.test.mjs`
- `scripts/tests/rl-shell-v1-temp-runner.test.mjs`
- `scripts/tests/rl-shell-v1-student-policy.test.mjs`
- `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
- `scripts/tests/rl-shell-v1-trainer.test.mjs`
- `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
  - expand tests to cover Phase 2 contracts.

### New Files To Create

- `scripts/lib/rl-shell-v1/real-task-registry.mjs`
  - collect, validate, and persist real-task admission metadata for current-failure-first and historical fallback tasks.
- `scripts/lib/rl-shell-v1/worktree-runner.mjs`
  - create and destroy temporary git worktrees for real-task shadow episodes.
- `scripts/lib/rl-shell-v1/replay-pool.mjs`
  - maintain synthetic and real replay pools, quality gates, and mixed sampling.
- `scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
- `scripts/tests/rl-shell-v1-worktree-runner.test.mjs`
- `scripts/tests/rl-shell-v1-replay-pool.test.mjs`
  - focused tests for each new module.

## Chunk 1: 2A Multi-Step Real Rollout On Synthetic Tasks

### Task 1: Expand schemas for multi-step traces and replay metadata

**Files:**
- Modify: `scripts/lib/rl-shell-v1/schema.mjs`
- Modify: `scripts/tests/rl-shell-v1-schema.test.mjs`
- Modify: `memory/specs/rl-shell-v1-run-summary.schema.json`

- [ ] **Step 1: Write failing schema tests for Phase 2 fields**

Add assertions for:

```js
assert.throws(
  () => validateEpisodeRecord({ ...episode, task_source: undefined }),
  /task_source/i
);

assert.doesNotThrow(() => validateEpisodeRecord({
  ...episode,
  task_source: 'synthetic',
  stop_condition: 'repeated_no_progress',
  no_progress_window: 3,
  replay_eligible: true,
  replay_priority: 0.6,
}));
```

- [ ] **Step 2: Run schema tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: FAIL with missing `task_source`, `stop_condition`, or replay-field validation errors.

- [ ] **Step 3: Implement minimal schema changes**

Update `schema.mjs` so episode records require:

- `task_source` in `synthetic | real_shadow`
- `stop_condition`
- `no_progress_window`
- `replay_eligible`
- `replay_priority`
- `attempt_id` for real-shadow episodes

Only update `run-summary` schema if new summary fields are required for acceptance reporting.

- [ ] **Step 4: Re-run schema tests**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/schema.mjs scripts/tests/rl-shell-v1-schema.test.mjs memory/specs/rl-shell-v1-run-summary.schema.json
git commit -m "feat(rl): extend shell rl schemas for phase 2"
```

### Task 2: Convert student-runner and temp-runner to multi-step runtime primitives

**Files:**
- Modify: `scripts/lib/rl-shell-v1/student-runner.mjs`
- Modify: `scripts/lib/rl-shell-v1/temp-runner.mjs`
- Modify: `scripts/tests/rl-shell-v1-student-policy.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-temp-runner.test.mjs`

- [ ] **Step 1: Add failing multi-step student-runner tests**

Add tests for:

```js
test('student runner uses latest observation trace when generating the next action', async () => {
  const result = await requestStudentAction({
    policy,
    trace: [
      { task_prompt: 'Fix src/math.mjs', baseline_failing_tests: ['not ok 1 - addition'] },
      { observation_event: { action: { action: 'read', path: 'src/math.mjs' }, status: 'ok', payload: { content_excerpt: 'return a - b;' } } },
    ],
    budget: { remainingSteps: 2 },
  });

  assert.notEqual(result.parsedAction, null);
});
```

- [ ] **Step 2: Add failing temp-runner tests for no-progress and final verification**

Add tests asserting:

- repeated identical failed actions trigger `repeated_no_progress`
- final verification returns canonical `tests_after`, `new_failures`, and `verification_status`

- [ ] **Step 3: Run student and temp-runner tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-student-policy.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs`
Expected: FAIL on missing multi-step fields or missing no-progress behavior.

- [ ] **Step 4: Implement bounded multi-step student context**

Update `student-runner.mjs` to:

- compress repeated observations,
- keep the latest N events only,
- expose one step-level prompt builder,
- return one action plus trace-derived `featureKey`.

- [ ] **Step 5: Implement temp-runner progress tracking**

Update `temp-runner.mjs` to:

- track repeated no-op or failed actions,
- surface `stop_condition` candidates,
- return final verification evidence in a structured result,
- keep all command and patch safety behavior from v1.

- [ ] **Step 6: Re-run student and temp-runner tests**

Run: `node --test scripts/tests/rl-shell-v1-student-policy.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/rl-shell-v1/student-runner.mjs scripts/lib/rl-shell-v1/temp-runner.mjs scripts/tests/rl-shell-v1-student-policy.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs
git commit -m "feat(rl): add multi-step shell rl runtime primitives"
```

### Task 3: Replace single-step orchestration with a true synthetic multi-step episode loop

**Files:**
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/lib/rl-shell-v1/trainer.mjs`
- Modify: `scripts/lib/rl-shell-v1/trajectory-store.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-trainer.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`

- [ ] **Step 1: Add failing orchestrator tests for multi-step synthetic episodes**

Add a test like:

```js
test('runTrainingRun persists a multi-step synthetic episode before trainer update', async () => {
  const result = await runTrainingRun({ config, seed: 17, deps: fakeDeps });
  assert.equal(result.episodesCompleted >= 1, true);
  assert.equal(result.lastEpisode.student_steps.length > 1, true);
});
```

- [ ] **Step 2: Add failing trainer test for multi-step trajectories**

Add:

```js
test('trainer computes advantages from multi-step reward sequences', async () => {
  const { advantages } = computeAdvantages({ rewards: [0, 0.25, 1] });
  assert.deepEqual(advantages, [1.25, 1.25, 1]);
});
```

- [ ] **Step 3: Run orchestrator, trainer, and trajectory tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: FAIL because the runtime is still single-step.

- [ ] **Step 4: Implement multi-step synthetic loop**

Update `run-orchestrator.mjs` so `runTrainingRun()`:

- replays baseline verification first,
- loops `student -> temp-runner -> observation append`,
- exits only on approved stop conditions,
- performs final canonical verification,
- teacher-call remains episode-level,
- updates trainer after the full trajectory is persisted.

- [ ] **Step 5: Extend trainer and trajectory persistence**

Update:

- `trainer.mjs` to consume episode-length trajectories,
- `trajectory-store.mjs` to persist per-step artifacts and new replay fields.

- [ ] **Step 6: Re-run orchestrator, trainer, and trajectory tests**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/lib/rl-shell-v1/trainer.mjs scripts/lib/rl-shell-v1/trajectory-store.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs
git commit -m "feat(rl): add multi-step synthetic shell rl loop"
```

### Task 4: Add 2A evaluation gates and synthetic superiority checks

**Files:**
- Modify: `scripts/lib/rl-shell-v1/eval-harness.mjs`
- Modify: `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- Modify: `scripts/rl-shell-v1.mjs`

- [ ] **Step 1: Add failing eval tests for 2A-specific metrics**

Add tests for:

- `invalid_step_ratio`
- `repeated_no_progress_rate`
- comparison against an untrained multi-step `2A` baseline

- [ ] **Step 2: Run eval-harness tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: FAIL on missing `2A` metrics or missing baseline comparison.

- [ ] **Step 3: Implement 2A eval metrics**

Update `eval-harness.mjs` to:

- summarize multi-step process metrics,
- compare trained `2A` against v1 and against untrained multi-step `2A`,
- expose deterministic best-checkpoint selection on the new metric set.

- [ ] **Step 4: Add 2A CLI smoke path**

Update `scripts/rl-shell-v1.mjs` to expose a phase-aware synthetic smoke such as:

```bash
node scripts/rl-shell-v1.mjs train --phase 2A --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17 --teacher codex-cli
```

- [ ] **Step 5: Re-run eval tests and 2A smoke**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: PASS

Run: `node scripts/rl-shell-v1.mjs train --phase 2A --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17 --teacher codex-cli`
Expected: exit code `0`, printed `run_id`, and a 2A summary path.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/eval-harness.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/rl-shell-v1.mjs
git commit -m "feat(rl): add shell rl phase 2A evaluation gates"
```

## Chunk 2: 2B Real Repository Shadow Evaluation

### Task 5: Add real-task registry and admission gates

**Files:**
- Create: `scripts/lib/rl-shell-v1/real-task-registry.mjs`
- Create: `scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/schema.mjs`

- [ ] **Step 1: Write failing real-task registry tests**

Add tests for:

```js
test('real-task registry admits only stable reproducible failing tasks', async () => {
  const result = await collectRealTasks({ rootDir, mode: 'current-failures-first' });
  assert.equal(result.admitted.every((task) => task.admission_status === 'admitted'), true);
});

test('real-task registry marks limited-pool when fewer than three tasks are admitted', async () => {
  const result = await collectRealTasks({ rootDir, mode: 'current-failures-first' });
  assert.equal(result.pool_status, 'limited-pool');
});
```

- [ ] **Step 2: Run real-task registry tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
Expected: FAIL with missing-module errors for `real-task-registry.mjs`.

- [ ] **Step 3: Implement current-failure-first task collection**

Add `real-task-registry.mjs` with:

- current-failure discovery for `test:scripts`, `typecheck`, and `build`,
- historical replay fallback hook,
- repeated baseline admission checks,
- persisted `limited-pool` status when admitted tasks `< 3`.

- [ ] **Step 4: Re-run real-task registry tests**

Run: `node --test scripts/tests/rl-shell-v1-real-task-registry.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-shell-v1/real-task-registry.mjs scripts/tests/rl-shell-v1-real-task-registry.test.mjs scripts/lib/rl-shell-v1/schema.mjs
git commit -m "feat(rl): add shell rl real task registry"
```

### Task 6: Add temporary git worktree isolation for real-task episodes

**Files:**
- Create: `scripts/lib/rl-shell-v1/worktree-runner.mjs`
- Create: `scripts/tests/rl-shell-v1-worktree-runner.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/temp-runner.mjs`

- [ ] **Step 1: Write failing worktree-runner tests**

Add tests for:

```js
test('worktree runner creates and destroys an isolated git worktree for one episode', async () => {
  const workspace = await createEpisodeWorktree({ rootDir, runId: 'run-001', taskId: 'task-001' });
  assert.equal(workspace.worktreePath.includes('.git'), false);
  await destroyEpisodeWorktree(workspace);
});
```

- [ ] **Step 2: Run worktree-runner tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-worktree-runner.test.mjs`
Expected: FAIL with missing-module errors for `worktree-runner.mjs`.

- [ ] **Step 3: Implement temporary git worktree lifecycle**

Add `worktree-runner.mjs` to:

- create per-episode worktrees,
- ensure a clean checkout,
- provide cleanup even after failed shadow episodes,
- surface worktree metadata to the trajectory store.

- [ ] **Step 4: Integrate temp-runner with worktree-backed paths**

Update `temp-runner.mjs` so real-task episodes can execute inside worktree-backed repo roots without weakening safety checks.

- [ ] **Step 5: Re-run worktree-runner tests**

Run: `node --test scripts/tests/rl-shell-v1-worktree-runner.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/worktree-runner.mjs scripts/tests/rl-shell-v1-worktree-runner.test.mjs scripts/lib/rl-shell-v1/temp-runner.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs
git commit -m "feat(rl): add shell rl real-task worktree isolation"
```

### Task 7: Add real-task shadow-eval mode and repeatability checks

**Files:**
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/lib/rl-shell-v1/eval-harness.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- Modify: `scripts/rl-shell-v1.mjs`

- [ ] **Step 1: Add failing tests for real-task shadow mode**

Add assertions for:

- shadow episodes do not update trainer state,
- the same task is attempted across multiple `seed / attempt` pairs,
- repeated repair is required before a task is counted as stable.

- [ ] **Step 2: Run orchestrator and eval tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: FAIL on missing shadow-eval branching or repeatability accounting.

- [ ] **Step 3: Implement shadow-eval-only real-task routing**

Update `run-orchestrator.mjs` so real tasks:

- run in temporary worktrees,
- capture complete trajectories,
- never call online trainer updates,
- emit repeatability summaries per task and per seed.

- [ ] **Step 4: Implement real-task shadow metrics**

Update `eval-harness.mjs` to report:

- repeated repair rate,
- per-task attempt counts,
- stable repair counts,
- main-worktree contamination failures.

- [ ] **Step 5: Add CLI command for real shadow evaluation**

Expose a path such as:

```bash
node scripts/rl-shell-v1.mjs eval --phase 2B --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli
```

- [ ] **Step 6: Re-run tests and one real-task smoke**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs`
Expected: PASS

Run: `node scripts/rl-shell-v1.mjs eval --phase 2B --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli`
Expected: exit code `0`, printed `pool_status`, `admitted_tasks`, and repeatability metrics.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/lib/rl-shell-v1/eval-harness.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/rl-shell-v1.mjs
git commit -m "feat(rl): add shell rl phase 2B shadow eval"
```

## Chunk 3: 2C Mixed Offline Replay With Real-Sample Priority

### Task 8: Add replay-pool persistence and quality gates

**Files:**
- Create: `scripts/lib/rl-shell-v1/replay-pool.mjs`
- Create: `scripts/tests/rl-shell-v1-replay-pool.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/trajectory-store.mjs`

- [ ] **Step 1: Write failing replay-pool tests**

Add tests for:

```js
test('replay pool keeps synthetic and real-shadow pools separate', async () => {
  const pool = await createReplayPool({ rootDir });
  await addReplayEpisode({ pool, episode: { task_source: 'synthetic', replay_eligible: true, replay_priority: 0.4 } });
  await addReplayEpisode({ pool, episode: { task_source: 'real_shadow', replay_eligible: true, replay_priority: 0.6 } });
  assert.equal(pool.synthetic.count, 1);
  assert.equal(pool.realShadow.count, 1);
});
```

- [ ] **Step 2: Run replay-pool tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-replay-pool.test.mjs`
Expected: FAIL with missing-module errors for `replay-pool.mjs`.

- [ ] **Step 3: Implement replay-pool storage**

Add `replay-pool.mjs` with:

- separate synthetic and real-shadow stores,
- quality gate evaluation,
- `limited-pool` duplication backoff,
- explicit `replay_priority` handling.

- [ ] **Step 4: Extend trajectory-store replay metadata**

Update `trajectory-store.mjs` so persisted episodes include enough metadata to be admitted into replay without re-deriving task provenance.

- [ ] **Step 5: Re-run replay-pool tests**

Run: `node --test scripts/tests/rl-shell-v1-replay-pool.test.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/replay-pool.mjs scripts/tests/rl-shell-v1-replay-pool.test.mjs scripts/lib/rl-shell-v1/trajectory-store.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs
git commit -m "feat(rl): add shell rl replay pool"
```

### Task 9: Integrate mixed replay sampling into trainer updates

**Files:**
- Modify: `scripts/lib/rl-shell-v1/trainer.mjs`
- Modify: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Modify: `scripts/tests/rl-shell-v1-trainer.test.mjs`

- [ ] **Step 1: Add failing trainer tests for mixed replay**

Add tests asserting:

- replay batches prefer qualified real-shadow samples,
- the trainer falls back toward synthetic when real-sample duplication exceeds threshold,
- replay updates preserve existing PPO and distillation accounting.

- [ ] **Step 2: Run trainer tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: FAIL on missing replay-batch behavior.

- [ ] **Step 3: Implement mixed replay sampling**

Update `trainer.mjs` to:

- accept replay batches in addition to live trajectories,
- target a `60/40` qualified real/synthetic mix,
- back off toward synthetic when the real pool is too sparse.

- [ ] **Step 4: Integrate replay into orchestration**

Update `run-orchestrator.mjs` so post-`2B` training runs can pull offline replay batches without mixing them into shadow-only real-task execution.

- [ ] **Step 5: Re-run trainer tests**

Run: `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/trainer.mjs scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/tests/rl-shell-v1-trainer.test.mjs
git commit -m "feat(rl): add shell rl mixed replay training"
```

### Task 10: Add 2C ablation reporting, scripts, docs, and final verification

**Files:**
- Modify: `scripts/lib/rl-shell-v1/eval-harness.mjs`
- Modify: `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
- Modify: `scripts/rl-shell-v1.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- Modify: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`

- [ ] **Step 1: Add failing ablation and CLI tests**

Add tests for:

- `2A-only` vs `2A+2B` vs `2A+2B+2C` comparison output,
- ContextDB summary fields that report phase and pool status,
- CLI output for full Phase 2 campaign.

- [ ] **Step 2: Run eval and orchestrator tests to verify failure**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL on missing ablation summary or Phase 2 CLI output.

- [ ] **Step 3: Implement 2C ablation reporting**

Update `eval-harness.mjs` to compare:

- `2A-only`
- `2A + 2B shadow-eval`
- `2A + 2B + 2C replay`

and report:

- held-out synthetic improvement,
- repeated real-task repair rate,
- replay-driven improvement,
- overfitting warnings.

- [ ] **Step 4: Update summary writer, CLI, scripts, and docs**

Update:

- `contextdb-summary.mjs` to carry phase and replay-pool status,
- `scripts/rl-shell-v1.mjs` to expose `phase 2A`, `phase 2B`, and `phase 2C` flows,
- `package.json` with focused Phase 2 scripts,
- `README.md` with the new workflow.

- [ ] **Step 5: Run full Phase 2 verification**

Run: `npm run test:rl-shell-v1`
Expected: PASS

Run: `node scripts/rl-shell-v1.mjs train --phase 2A --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17 --teacher codex-cli`
Expected: exit code `0`

Run: `node scripts/rl-shell-v1.mjs eval --phase 2B --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli`
Expected: exit code `0`

Run: `node scripts/rl-shell-v1.mjs campaign --phase 2C --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli`
Expected:
- exit code `0`
- printed `campaign_id`
- printed `phase=2C`
- printed synthetic and real replay metrics
- printed best checkpoint and replay-pool status

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/rl-shell-v1/eval-harness.mjs scripts/lib/rl-shell-v1/contextdb-summary.mjs scripts/rl-shell-v1.mjs package.json README.md scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs
git commit -m "feat(rl): add shell rl phase 2 campaign flow"
```

## Plan Review Notes

- Keep Phase 2 split into `2A`, `2B`, and `2C`; do not collapse them into one implementation batch.
- Do not let real repository tasks trigger online PPO updates in `2B`.
- Keep `read / run / patch / stop` as the only action types throughout Phase 2.
- Prefer temporary git worktrees for real tasks and keep main-worktree mutation as a hard failure.
- If the real current-failure pool is too small, record `limited-pool` explicitly instead of faking a large enough task set.
- Preserve `scripts/aios.mjs` as untouched; continue using `scripts/rl-shell-v1.mjs` as the isolated experiment runner.

## Execution Order

1. Finish Chunk 1 and prove `2A` synthetic superiority over v1.
2. Finish Chunk 2 and prove repeatable real-task shadow repair without trainer mutation.
3. Finish Chunk 3 and prove replay-driven improvement over `2A` alone.
4. Only after all three chunks pass should any follow-on Phase 3 work be considered.

Plan complete and saved to `docs/superpowers/plans/2026-03-22-aios-shell-rl-phase-2-plan.md`. Ready to execute?
