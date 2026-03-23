# AIOS Shell RL V1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working shell and coding RL experiment loop for `aios`, train a local small student policy on synthetic bugfix tasks, and prove repeatable held-out improvement across three seeds.

**Architecture:** Keep v1 isolated from the main `aios` lifecycle commands. Implement a dedicated experimental runner under `scripts/rl-shell-v1.mjs`, with focused modules under `scripts/lib/rl-shell-v1/` for benchmark loading, temp-workspace execution, teacher normalization, reward fusion, PPO training, evaluation, and ContextDB summary persistence. Use a tiny local JSON-token student policy implemented in Node so the entire loop is trainable on CPU and testable in-repo without introducing a Python or GPU dependency.

**Tech Stack:** Node 22 ESM, built-in `node:test`, repo-local synthetic benchmark fixtures under `experiments/rl-shell-v1/`, existing `scripts/lib/platform/process.mjs` for subprocess control, existing ContextDB CLI bridge for run summaries.

---

## File Structure

Create:
- `scripts/rl-shell-v1.mjs`
- `scripts/generate-rl-shell-v1-benchmark.mjs`
- `scripts/lib/rl-shell-v1/schema.mjs`
- `scripts/lib/rl-shell-v1/action-protocol.mjs`
- `scripts/lib/rl-shell-v1/task-registry.mjs`
- `scripts/lib/rl-shell-v1/temp-runner.mjs`
- `scripts/lib/rl-shell-v1/student-policy.mjs`
- `scripts/lib/rl-shell-v1/student-runner.mjs`
- `scripts/lib/rl-shell-v1/teacher-gateway.mjs`
- `scripts/lib/rl-shell-v1/reward-fusion.mjs`
- `scripts/lib/rl-shell-v1/trajectory-store.mjs`
- `scripts/lib/rl-shell-v1/trainer.mjs`
- `scripts/lib/rl-shell-v1/eval-harness.mjs`
- `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
- `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- `scripts/tests/rl-shell-v1-schema.test.mjs`
- `scripts/tests/rl-shell-v1-task-registry.test.mjs`
- `scripts/tests/rl-shell-v1-temp-runner.test.mjs`
- `scripts/tests/rl-shell-v1-student-policy.test.mjs`
- `scripts/tests/rl-shell-v1-teacher-gateway.test.mjs`
- `scripts/tests/rl-shell-v1-reward-fusion.test.mjs`
- `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
- `scripts/tests/rl-shell-v1-trainer.test.mjs`
- `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- `scripts/tests/rl-shell-v1-orchestrator.test.mjs`
- `memory/specs/rl-shell-v1-run-summary.schema.json`
- `experiments/rl-shell-v1/README.md`
- `experiments/rl-shell-v1/configs/benchmark-v1.json`
- `experiments/rl-shell-v1/seeds/arithmetic-add/manifest.template.json`
- `experiments/rl-shell-v1/seeds/arithmetic-add/repo/package.json`
- `experiments/rl-shell-v1/seeds/arithmetic-add/repo/src/math.mjs`
- `experiments/rl-shell-v1/seeds/arithmetic-add/repo/tests/math.test.mjs`
- `experiments/rl-shell-v1/seeds/string-trim/manifest.template.json`
- `experiments/rl-shell-v1/seeds/string-trim/repo/package.json`
- `experiments/rl-shell-v1/seeds/string-trim/repo/src/normalize.mjs`
- `experiments/rl-shell-v1/seeds/string-trim/repo/tests/normalize.test.mjs`
- `experiments/rl-shell-v1/seeds/list-filter/manifest.template.json`
- `experiments/rl-shell-v1/seeds/list-filter/repo/package.json`
- `experiments/rl-shell-v1/seeds/list-filter/repo/src/filter.mjs`
- `experiments/rl-shell-v1/seeds/list-filter/repo/tests/filter.test.mjs`

Modify:
- `package.json`
- `README.md`

Keep unchanged in v1:
- `scripts/aios.mjs`
- `scripts/lib/cli/parse-args.mjs`
- `scripts/lib/lifecycle/*.mjs`
- `scripts/lib/harness/orchestrator*.mjs`
- `scripts/lib/harness/learn-eval.mjs`

Responsibility split:
- `schema.mjs`: versioned schema validation for task manifests, observation events, teacher payloads, episode records, and run summaries.
- `action-protocol.mjs`: parse, validate, and normalize student JSON actions.
- `task-registry.mjs`: load benchmark config, materialize train and held-out splits, enforce valid-task minimums, and sample tasks deterministically by seed.
- `temp-runner.mjs`: create isolated temp workspaces, enforce execution policy, run commands, apply patches, and return structured observation events.
- `student-policy.mjs`: hold the tiny local trainable parameter table, vocabulary, checkpoint I/O, and deterministic sampling logic.
- `student-runner.mjs`: translate observation traces into student prompts and request one action from the local policy.
- `teacher-gateway.mjs`: call one configured teacher backend plus fallback, normalize outputs, and surface deterministic failure defaults.
- `reward-fusion.mjs`: compute terminal reward, teacher term, and fused reward exactly per the spec.
- `trajectory-store.mjs`: write episodes, artifacts, metrics, and checkpoints under `experiments/rl-shell-v1/runs/<run_id>/`.
- `trainer.mjs`: compute PPO loss, distillation loss, KL loss, and checkpoint refresh on the local student policy.
- `eval-harness.mjs`: run held-out tasks, compare checkpoints, compute campaign metrics, and pick the best checkpoint deterministically.
- `contextdb-summary.mjs`: validate and write run or campaign summaries through the existing ContextDB bridge.
- `run-orchestrator.mjs`: own seed propagation, task-sampling attempts, run status transitions, and campaign aggregation without taking over runtime, trainer, or teacher logic.

## Chunk 1: Contracts, Benchmark Corpus, And Temp-Workspace Runtime

### Task 1: Add versioned schemas and contract validation

**Files:**
- Create: `scripts/lib/rl-shell-v1/schema.mjs`
- Create: `scripts/tests/rl-shell-v1-schema.test.mjs`
- Create: `memory/specs/rl-shell-v1-run-summary.schema.json`

- [ ] **Step 1: Write failing schema tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateTaskManifest,
  validateObservationEvent,
  validateTeacherResponse,
  validateEpisodeRecord,
  validateRunSummary,
} from '../lib/rl-shell-v1/schema.mjs';

test('validateTaskManifest accepts v1 task manifests and rejects missing verification_command', () => {
  const valid = {
    schema_version: 1,
    task_id: 'bugfix-001',
    repo_snapshot_id: 'bugfix-001@v1',
    repo_source_path: 'experiments/rl-shell-v1/tasks/bugfix-001',
    split: 'train',
    task_prompt: 'Fix the bug',
    verification_command: 'npm test -- --runInBand',
    baseline_failing_tests: ['tests/math.test.mjs::addition'],
    constraints: ['Do not edit tests'],
  };

  assert.doesNotThrow(() => validateTaskManifest(valid));
  assert.throws(() => validateTaskManifest({ ...valid, verification_command: '' }), /verification_command/i);
});

test('validateObservationEvent enforces payload-by-action contracts', () => {
  const event = {
    schema_version: 1,
    step_index: 1,
    action: { action: 'run', command: 'npm test -- --runInBand' },
    status: 'ok',
    error_code: null,
    error_message: null,
    payload: {
      exit_code: 1,
      stdout_excerpt: '',
      stderr_excerpt: '1 failing test',
      stdout_truncated: false,
      stderr_truncated: false,
      files_touched: ['src/math.mjs'],
    },
  };

  assert.doesNotThrow(() => validateObservationEvent(event));
  assert.throws(() => validateObservationEvent({ ...event, status: 'bad' }), /status/i);
});

test('validateTeacherResponse enforces failure defaults and call_status enum', () => {
  const failed = {
    backend_used: 'codex-cli',
    call_status: 'failed_all_backends',
    latency_ms: 0,
    critique: null,
    reference_solution: null,
    shaping_score: 0,
    confidence: 0,
  };

  assert.doesNotThrow(() => validateTeacherResponse(failed));
  assert.throws(() => validateTeacherResponse({ ...failed, call_status: 'bad' }), /call_status/i);
});

test('validateEpisodeRecord requires reward, distillation, and artifact fields', () => {
  const episode = makeValidEpisodeRecord();
  assert.doesNotThrow(() => validateEpisodeRecord(episode));
  assert.throws(() => validateEpisodeRecord({ ...episode, fused_reward: undefined }), /fused_reward/i);
});

test('validateRunSummary enforces ContextDB summary contract', () => {
  const summary = {
    run_id: 'run-001',
    spec_path: 'docs/superpowers/specs/2026-03-22-aios-shell-rl-v1-design.md',
    student_model_id: 'tiny-json-policy-v1',
    primary_teacher: 'codex-cli',
    fallback_order: ['claude-code'],
    train_split: 'benchmark-v1-train',
    held_out_split: 'benchmark-v1-held-out',
    best_checkpoint_path: 'experiments/rl-shell-v1/runs/run-001/checkpoints/best/policy.json',
    best_metrics: { success_rate: 0.5 },
    seed_results: [{ seed: 17, status: 'ok' }],
    status: 'ok',
  };

  assert.doesNotThrow(() => validateRunSummary(summary));
  assert.throws(() => validateRunSummary({ ...summary, primary_teacher: '' }), /primary_teacher/i);
});
```

- [ ] **Step 2: Run the schema tests and confirm they fail**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: FAIL with missing-module errors for `scripts/lib/rl-shell-v1/schema.mjs`

- [ ] **Step 3: Implement schema validators and run-summary schema**

Add `scripts/lib/rl-shell-v1/schema.mjs` with:

```js
export function validateTaskManifest(raw) {}
export function validateObservationEvent(raw) {}
export function validateTeacherResponse(raw) {}
export function validateEpisodeRecord(raw) {}
export function validateRunSummary(raw) {}
export function assertEnum(value, allowed, label) {}
export function assertString(value, label) {}
export function assertArray(value, label) {}
```

Required behavior:
- reject unknown keys for all top-level schema objects,
- enforce `schema_version === 1` where applicable,
- enforce explicit nullability for teacher-failure defaults,
- require `split` in `train|held_out`,
- require `call_status` in `ok|fallback_ok|invalid_response|failed_all_backends`,
- require observation `status` in `ok|rejected|error|timeout`,
- require run summary fields `run_id`, `spec_path`, `student_model_id`, `primary_teacher`, `fallback_order`, `train_split`, `held_out_split`, `best_checkpoint_path`, `best_metrics`, `seed_results`, `status`,
- validate run summary shape against `memory/specs/rl-shell-v1-run-summary.schema.json`.

- [ ] **Step 4: Run schema tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit schema foundation**

```bash
git add scripts/lib/rl-shell-v1/schema.mjs scripts/tests/rl-shell-v1-schema.test.mjs memory/specs/rl-shell-v1-run-summary.schema.json
git commit -m "feat(rl): add shell rl v1 schemas"
```

### Task 2: Add seed corpus, benchmark generator, and task registry

**Files:**
- Create: `scripts/generate-rl-shell-v1-benchmark.mjs`
- Create: `scripts/lib/rl-shell-v1/task-registry.mjs`
- Create: `scripts/tests/rl-shell-v1-task-registry.test.mjs`
- Create: `experiments/rl-shell-v1/README.md`
- Create: `experiments/rl-shell-v1/configs/benchmark-v1.json`
- Create: `experiments/rl-shell-v1/seeds/arithmetic-add/manifest.template.json`
- Create: `experiments/rl-shell-v1/seeds/arithmetic-add/repo/package.json`
- Create: `experiments/rl-shell-v1/seeds/arithmetic-add/repo/src/math.mjs`
- Create: `experiments/rl-shell-v1/seeds/arithmetic-add/repo/tests/math.test.mjs`
- Create: `experiments/rl-shell-v1/seeds/string-trim/manifest.template.json`
- Create: `experiments/rl-shell-v1/seeds/string-trim/repo/package.json`
- Create: `experiments/rl-shell-v1/seeds/string-trim/repo/src/normalize.mjs`
- Create: `experiments/rl-shell-v1/seeds/string-trim/repo/tests/normalize.test.mjs`
- Create: `experiments/rl-shell-v1/seeds/list-filter/manifest.template.json`
- Create: `experiments/rl-shell-v1/seeds/list-filter/repo/package.json`
- Create: `experiments/rl-shell-v1/seeds/list-filter/repo/src/filter.mjs`
- Create: `experiments/rl-shell-v1/seeds/list-filter/repo/tests/filter.test.mjs`

- [ ] **Step 1: Write failing benchmark and registry tests**

```js
test('generateBenchmark writes at least 48 tasks and fixed train/held-out splits', async () => {
  const rootDir = await makeRootDir();
  const mod = await import('../lib/rl-shell-v1/task-registry.mjs');
  const result = await mod.generateBenchmark({ rootDir, seed: 17 });

  assert.equal(result.generatedTasks.length >= 48, true);
  assert.equal(result.trainTasks.length >= 32, true);
  assert.equal(result.heldOutTasks.length >= 16, true);
});

test('loadTaskRegistry rejects benchmark configs with too few valid tasks', async () => {
  const rootDir = await makeRootDir();
  await writeTinyBenchmark(rootDir);
  const mod = await import('../lib/rl-shell-v1/task-registry.mjs');

  await assert.rejects(
    () => mod.loadTaskRegistry({ rootDir, configPath: 'experiments/rl-shell-v1/configs/benchmark-v1.json' }),
    /insufficient-valid-tasks/i
  );
});

test('generateBenchmark is deterministic for the same seed and sampleTrainingTask is deterministic for seed plus attempt', async () => {
  const rootDir = await makeRootDir();
  const mod = await import('../lib/rl-shell-v1/task-registry.mjs');

  const first = await mod.generateBenchmark({ rootDir, seed: 17 });
  const second = await mod.generateBenchmark({ rootDir, seed: 17 });

  assert.deepEqual(first.generatedTasks.map((item) => item.task_id), second.generatedTasks.map((item) => item.task_id));

  const registry = await mod.loadTaskRegistry({ rootDir, configPath: 'experiments/rl-shell-v1/configs/benchmark-v1.json' });
  assert.deepEqual(
    mod.sampleTrainingTask(registry, { seed: 17, attempt: 3 }),
    mod.sampleTrainingTask(registry, { seed: 17, attempt: 3 })
  );
});

test('sampleTrainingTask never returns held-out tasks and invalid-task exclusions are persisted', async () => {
  const rootDir = await makeRootDir();
  const mod = await import('../lib/rl-shell-v1/task-registry.mjs');

  await mod.generateBenchmark({ rootDir, seed: 17 });
  const registry = await mod.loadTaskRegistry({ rootDir, configPath: 'experiments/rl-shell-v1/configs/benchmark-v1.json' });

  const sampled = mod.sampleTrainingTask(registry, { seed: 17, attempt: 4 });
  assert.equal(sampled.split, 'train');

  const exclusionReport = await fs.readFile(
    path.join(rootDir, 'experiments', 'rl-shell-v1', 'configs', 'benchmark-v1.invalid-tasks.json'),
    'utf8'
  );
  assert.match(exclusionReport, /invalid_reason|baseline/i);
});
```

- [ ] **Step 2: Run task-registry tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-task-registry.test.mjs`
Expected: FAIL with missing-module errors for `scripts/lib/rl-shell-v1/task-registry.mjs`

- [ ] **Step 3: Add three seed repositories and one benchmark config**

Use these seed shapes:

```json
{
  "schema_version": 1,
  "seed_id": "arithmetic-add",
  "verification_command": "node --test",
  "variant_count": 16,
  "task_prompt_template": "Fix the failing addition behavior for variant {{variant_id}}.",
  "constraints": ["Do not edit tests", "Use only local files"]
}
```

```js
// experiments/rl-shell-v1/seeds/arithmetic-add/repo/src/math.mjs
export function add(a, b) {
  return a - b;
}
```

```js
// experiments/rl-shell-v1/seeds/arithmetic-add/repo/tests/math.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { add } from '../src/math.mjs';

test('addition returns the sum', () => {
  assert.equal(add(2, 3), 5);
});
```

```json
// experiments/rl-shell-v1/seeds/string-trim/manifest.template.json
{
  "schema_version": 1,
  "seed_id": "string-trim",
  "verification_command": "node --test",
  "variant_count": 16,
  "task_prompt_template": "Fix the normalization helper for trim variant {{variant_id}}.",
  "constraints": ["Do not edit tests", "Keep function signature stable"]
}
```

```js
// experiments/rl-shell-v1/seeds/string-trim/repo/src/normalize.mjs
export function normalizeName(value) {
  return value.toLowerCase();
}
```

```js
// experiments/rl-shell-v1/seeds/string-trim/repo/tests/normalize.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName } from '../src/normalize.mjs';

test('normalizeName trims outer whitespace', () => {
  assert.equal(normalizeName('  Alice  '), 'alice');
});
```

```json
// experiments/rl-shell-v1/seeds/list-filter/manifest.template.json
{
  "schema_version": 1,
  "seed_id": "list-filter",
  "verification_command": "node --test",
  "variant_count": 16,
  "task_prompt_template": "Fix the list filtering behavior for variant {{variant_id}}.",
  "constraints": ["Do not edit tests", "Keep array order stable"]
}
```

```js
// experiments/rl-shell-v1/seeds/list-filter/repo/src/filter.mjs
export function filterActive(items) {
  return items.filter((item) => item.active === false);
}
```

```js
// experiments/rl-shell-v1/seeds/list-filter/repo/tests/filter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActive } from '../src/filter.mjs';

test('filterActive keeps only active items in original order', () => {
  assert.deepEqual(
    filterActive([{ id: 1, active: true }, { id: 2, active: false }, { id: 3, active: true }]),
    [{ id: 1, active: true }, { id: 3, active: true }]
  );
});
```

- [ ] **Step 4: Implement benchmark generation and registry loading**

Add `scripts/lib/rl-shell-v1/task-registry.mjs` with:

```js
export async function generateBenchmark({ rootDir, seed }) {}
export async function loadTaskRegistry({ rootDir, configPath }) {}
export function sampleTrainingTask(registry, { seed, attempt }) {}
export function buildTaskManifest({ seedDir, variantId, split }) {}
```

Required behavior:
- generate deterministic task ids from seed plus variant id,
- write generated tasks under `experiments/rl-shell-v1/tasks/generated/<task_id>/`,
- create fixed split assignments in `experiments/rl-shell-v1/configs/benchmark-v1.json`,
- require at least 32 valid train tasks and 16 valid held-out tasks,
- re-run each task's baseline failing tests before marking it valid for training or evaluation,
- exclude invalid tasks from train and held-out splits and persist the exclusion reason,
- persist `task_id`, `repo_snapshot_id`, `repo_source_path`, `split`, `task_prompt`, `verification_command`, `baseline_failing_tests`, and `constraints` into every manifest,
- support deterministic sampling by `(seed, attempt)` without hidden global state.

- [ ] **Step 5: Run the benchmark generator and verify output**

Run: `node scripts/generate-rl-shell-v1-benchmark.mjs --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17`
Expected:
- `generated >= 48 tasks`
- `train >= 32`
- `held_out >= 16`
- exit code `0`

- [ ] **Step 6: Run task-registry tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-task-registry.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit benchmark corpus and registry**

```bash
git add scripts/generate-rl-shell-v1-benchmark.mjs scripts/lib/rl-shell-v1/task-registry.mjs scripts/tests/rl-shell-v1-task-registry.test.mjs experiments/rl-shell-v1
git commit -m "feat(rl): add shell rl v1 benchmark registry"
```

### Task 3: Add action protocol and temp-workspace runner

**Files:**
- Create: `scripts/lib/rl-shell-v1/action-protocol.mjs`
- Create: `scripts/tests/rl-shell-v1-action-protocol.test.mjs`
- Create: `scripts/lib/rl-shell-v1/temp-runner.mjs`
- Create: `scripts/tests/rl-shell-v1-temp-runner.test.mjs`

- [ ] **Step 1: Write failing action-protocol and temp-runner tests**

```js
test('parseStudentAction accepts read/run/patch/stop and rejects unsupported actions', async () => {
  const mod = await import('../lib/rl-shell-v1/action-protocol.mjs');

  assert.deepEqual(mod.parseStudentAction('{"action":"read","path":"src/math.mjs"}'), {
    action: 'read',
    path: 'src/math.mjs',
  });

  assert.throws(
    () => mod.parseStudentAction('{"action":"delete","path":"src/math.mjs"}'),
    /unsupported action/i
  );
});
```

Put that test in `scripts/tests/rl-shell-v1-action-protocol.test.mjs`.

```js

test('temp runner rejects path escapes and command redirects outside the temp workspace', async () => {
  const mod = await import('../lib/rl-shell-v1/temp-runner.mjs');
  const workspace = await createFixtureWorkspace();

  await assert.rejects(
    () => mod.executeAction({ workspace, action: { action: 'read', path: '../../etc/passwd' }, policy: defaultPolicy() }),
    /temp workspace root/i
  );

  const result = await mod.executeAction({
    workspace,
    action: { action: 'run', command: 'node -e "console.log(1)" > /tmp/out.txt' },
    policy: defaultPolicy(),
  });

  assert.equal(result.status, 'rejected');
});

test('temp runner replays baseline failing tests before student actions and cleans up isolated workspaces', async () => {
  const mod = await import('../lib/rl-shell-v1/temp-runner.mjs');
  const workspace = await mod.createEpisodeWorkspace({ taskManifest: makeTaskManifest(), rootDir: await makeRootDir() });

  const baseline = await mod.runBaselineFailureCheck({ workspace, verificationCommand: 'node --test', policy: defaultPolicy() });
  assert.equal(baseline.reproduced, true);

  const workspacePath = workspace.workspacePath;
  await mod.destroyEpisodeWorkspace(workspace);
  await assert.rejects(() => fs.access(workspacePath));
});
```

- [ ] **Step 2: Run action-protocol and temp-runner tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-action-protocol.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs`
Expected: FAIL with missing-module errors for `scripts/lib/rl-shell-v1/action-protocol.mjs` or `temp-runner.mjs`

- [ ] **Step 3: Implement action parsing and policy enforcement**

Add `scripts/lib/rl-shell-v1/action-protocol.mjs` with:

```js
export function parseStudentAction(rawText) {}
export function validateStudentAction(action) {}
export function normalizePatchDiff(text) {}
```

Add `scripts/lib/rl-shell-v1/temp-runner.mjs` with:

```js
export async function createEpisodeWorkspace({ taskManifest, rootDir }) {}
export async function destroyEpisodeWorkspace(workspace) {}
export async function executeAction({ workspace, action, policy }) {}
export async function runBaselineFailureCheck({ workspace, verificationCommand, policy }) {}
export async function runVerification({ workspace, verificationCommand, policy }) {}
export function createDefaultExecutionPolicy() {}
```

Required behavior:
- enforce `max_steps_per_episode`, `max_command_seconds`, `max_episode_seconds`, and `max_output_bytes_per_stream`,
- reject `sudo`, `ssh`, `scp`, `curl`, `wget`, `git push`, `git reset --hard`, `rm -rf /`,
- reject absolute paths and traversal that escape the temp workspace root,
- execute commands only from the temp workspace root,
- force `network_access = false`,
- reject interactive commands and background processes,
- append structured `ObservationEvent` output for every executed or rejected action,
- record stdout and stderr truncation markers in observation payloads,
- provide `runBaselineFailureCheck()` so the student never acts before the baseline failure is reproduced,
- treat invalid patch and non-zero exit as continue-on-error,
- surface irrecoverable runtime failures only for unreadable workspace, expired wall-clock budget, or unsafe runner state.

- [ ] **Step 4: Run action-protocol and temp-runner tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-action-protocol.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs`
Expected: PASS

- [ ] **Step 5: Smoke-test one generated task by hand**

Run: `node scripts/generate-rl-shell-v1-benchmark.mjs --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17`

Run: `node -e "import('./scripts/lib/rl-shell-v1/temp-runner.mjs').then(async (m) => { const policy = m.createDefaultExecutionPolicy(); console.log(JSON.stringify(policy, null, 2)); })"`

Expected:
- first command prints generated-task summary,
- second command prints policy defaults including:
  - `max_steps_per_episode: 12`
  - `max_command_seconds: 30`
  - `max_episode_seconds: 180`
  - `max_output_bytes_per_stream: 65536`
  - `network_access: false`
  - forbidden-command patterns containing `sudo` and `curl`

- [ ] **Step 6: Commit action protocol and temp runner**

```bash
git add scripts/lib/rl-shell-v1/action-protocol.mjs scripts/lib/rl-shell-v1/temp-runner.mjs scripts/tests/rl-shell-v1-action-protocol.test.mjs scripts/tests/rl-shell-v1-temp-runner.test.mjs
git commit -m "feat(rl): add shell rl v1 temp runner"
```

## Chunk 2: Student Policy, Teacher Gateway, Reward, And Trajectory Persistence

### Task 4: Add the local student policy backend and single-step student runner

**Files:**
- Create: `scripts/lib/rl-shell-v1/student-policy.mjs`
- Create: `scripts/lib/rl-shell-v1/student-runner.mjs`
- Create: `scripts/tests/rl-shell-v1-student-policy.test.mjs`

- [ ] **Step 1: Write failing student-policy tests**

```js
test('student policy returns deterministic logits and token sampling under a fixed seed', async () => {
  const mod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const policy = mod.createStudentPolicy({ seed: 7 });

  const first = mod.sampleNextToken(policy, { contextTokens: ['{', '"action"', ':'] });
  const second = mod.sampleNextToken(mod.createStudentPolicy({ seed: 7 }), { contextTokens: ['{', '"action"', ':'] });

  assert.deepEqual(first, second);
});

test('student runner emits stop_reason=budget_exhausted when no steps remain', async () => {
  const mod = await import('../lib/rl-shell-v1/student-runner.mjs');
  const result = await mod.requestStudentAction({
    policy: fakePolicyThatReturns('{"action":"stop","message":"done"}'),
    trace: [],
    budget: { remainingSteps: 0 },
  });

  assert.equal(result.parsedAction, null);
  assert.equal(result.stopReason, 'budget_exhausted');
});
```

- [ ] **Step 2: Run student-policy tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-student-policy.test.mjs`
Expected: FAIL with missing-module errors for `student-policy.mjs` or `student-runner.mjs`

- [ ] **Step 3: Implement a tiny trainable JSON-token policy**

Add `scripts/lib/rl-shell-v1/student-policy.mjs` with:

```js
export function createStudentPolicy({ seed, vocabulary, weights }) {}
export function createDefaultVocabulary() {}
export function scoreNextToken(policy, { contextTokens, featureKey }) {}
export function sampleNextToken(policy, { contextTokens, featureKey }) {}
export async function loadPolicyCheckpoint(filePath) {}
export async function savePolicyCheckpoint(filePath, policy) {}
```

Implementation requirements:
- use a small fixed vocabulary covering JSON punctuation plus action-language keys and common path or command fragments,
- keep parameters in plain JS arrays or typed arrays so checkpoints serialize to JSON,
- expose deterministic seeded sampling for training and greedy mode for evaluation,
- do not introduce external ML libraries in v1.

- [ ] **Step 4: Implement student-runner**

Add `scripts/lib/rl-shell-v1/student-runner.mjs` with:

```js
export async function requestStudentAction({ policy, trace, budget, evaluationMode = false }) {}
export function buildStudentFeatureKey({ trace }) {}
export function truncateTraceForPrompt(trace, maxEvents = 12) {}
```

Required behavior:
- build one feature key from the latest task prompt, latest failing-test summary, and latest observation events,
- emit exactly one valid JSON action string or a parse-failure observation,
- return raw output text, token ids, token logprobs, parsed action, and stop reason.

- [ ] **Step 5: Run student-policy tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-student-policy.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit student policy foundation**

```bash
git add scripts/lib/rl-shell-v1/student-policy.mjs scripts/lib/rl-shell-v1/student-runner.mjs scripts/tests/rl-shell-v1-student-policy.test.mjs
git commit -m "feat(rl): add shell rl v1 student policy"
```

### Task 5: Add teacher gateway and reward fusion

**Files:**
- Create: `scripts/lib/rl-shell-v1/teacher-gateway.mjs`
- Create: `scripts/lib/rl-shell-v1/reward-fusion.mjs`
- Create: `scripts/tests/rl-shell-v1-teacher-gateway.test.mjs`
- Create: `scripts/tests/rl-shell-v1-reward-fusion.test.mjs`

- [ ] **Step 1: Write failing teacher-gateway and reward tests**

```js
test('teacher gateway falls back and returns deterministic failure defaults when all backends fail', async () => {
  const mod = await import('../lib/rl-shell-v1/teacher-gateway.mjs');
  const result = await mod.callTeacher({
    primary: 'codex-cli',
    fallbacks: ['claude-code'],
    trace: [],
    transport: async () => { throw new Error('offline'); },
  });

  assert.equal(result.call_status, 'failed_all_backends');
  assert.equal(result.shaping_score, 0);
  assert.equal(result.confidence, 0);
  assert.equal(result.reference_solution, null);
  assert.equal(result.critique, null);
});

test('reward fusion implements full fused-reward math and teacher-term clamping', async () => {
  const mod = await import('../lib/rl-shell-v1/reward-fusion.mjs');

  assert.deepEqual(
    mod.fuseReward({ terminalReward: 1, shapingScore: -1, callStatus: 'ok' }),
    { teacherTerm: -0.2, fusedReward: 0.8 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: 0, shapingScore: 2, callStatus: 'ok' }),
    { teacherTerm: 0.2, fusedReward: 0.2 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: -1, shapingScore: 1, callStatus: 'ok' }),
    { teacherTerm: 0.2, fusedReward: -0.8 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: -1, shapingScore: 1, callStatus: 'failed_all_backends' }),
    { teacherTerm: 0, fusedReward: -1 }
  );
});
```

- [ ] **Step 2: Run teacher-gateway and reward tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-teacher-gateway.test.mjs scripts/tests/rl-shell-v1-reward-fusion.test.mjs`
Expected: FAIL with missing-module errors for `teacher-gateway.mjs` or `reward-fusion.mjs`

- [ ] **Step 3: Implement teacher gateway with injectable transport**

Add `scripts/lib/rl-shell-v1/teacher-gateway.mjs` with:

```js
export async function callTeacher({ primary, fallbacks, trace, transport = defaultTeacherTransport }) {}
export async function defaultTeacherTransport({ backend, prompt, cwd }) {}
export function normalizeTeacherResponse(raw, { backend, callStatus }) {}
export function buildTeacherPrompt(trace) {}
```

Required behavior:
- resolve primary backend from persisted run config only,
- use `scripts/lib/platform/process.mjs` for actual CLI invocation,
- normalize `backend_used`, `call_status`, `latency_ms`, `critique`, `reference_solution`, `shaping_score`, `confidence`,
- emit teacher-unavailable defaults exactly as frozen in the spec,
- support test doubles by injecting `transport`.

- [ ] **Step 4: Implement reward fusion**

Add `scripts/lib/rl-shell-v1/reward-fusion.mjs` with:

```js
export function computeTerminalReward({ baselineFailures, finalFailures, newFailures, verificationStatus }) {}
export function fuseReward({ terminalReward, shapingScore, callStatus }) {}
export function summarizeReward({ terminalReward, teacherTerm, fusedReward }) {}
```

Required behavior:
- implement the full reward table from the spec,
- clamp teacher term to `[-0.2, 0.2]`,
- force `teacherTerm = 0` when `call_status !== ok` and `call_status !== fallback_ok`.

- [ ] **Step 5: Run tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-teacher-gateway.test.mjs scripts/tests/rl-shell-v1-reward-fusion.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit teacher and reward modules**

```bash
git add scripts/lib/rl-shell-v1/teacher-gateway.mjs scripts/lib/rl-shell-v1/reward-fusion.mjs scripts/tests/rl-shell-v1-teacher-gateway.test.mjs scripts/tests/rl-shell-v1-reward-fusion.test.mjs
git commit -m "feat(rl): add shell rl v1 teacher gateway"
```

### Task 6: Add trajectory store and artifact persistence

**Files:**
- Create: `scripts/lib/rl-shell-v1/trajectory-store.mjs`
- Create: `scripts/tests/rl-shell-v1-trajectory-store.test.mjs`

- [ ] **Step 1: Write failing trajectory-store tests**

```js
test('trajectory store writes one episode json plus full artifact files for truncated outputs', async () => {
  const mod = await import('../lib/rl-shell-v1/trajectory-store.mjs');
  const runDir = await makeRunDir();
  const record = await mod.persistEpisode({
    runDir,
    episode: makeEpisodeRecordWithTruncatedStreams(),
  });

  assert.equal(record.episodePath.endsWith('.json'), true);
  assert.equal(record.stdoutArtifactPath.endsWith('.log'), true);
  assert.equal(record.stderrArtifactPath.endsWith('.log'), true);
  assert.equal(record.finalDiffArtifactPath.endsWith('.patch'), true);
  assert.equal(record.observationTraceArtifactPath.endsWith('.json'), true);
});
```

- [ ] **Step 2: Run trajectory-store tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: FAIL with missing-module errors for `trajectory-store.mjs`

- [ ] **Step 3: Implement trajectory-store**

Add `scripts/lib/rl-shell-v1/trajectory-store.mjs` with:

```js
export async function createRunLayout({ rootDir, runId }) {}
export async function persistEpisode({ runDir, episode }) {}
export async function appendMetrics({ runDir, metric }) {}
export async function writeCheckpointMetadata({ runDir, kind, metadata }) {}
```

Required behavior:
- create `episodes/`, `checkpoints/`, `evals/`, and `artifacts/` directories,
- write full artifact files whenever inline excerpts are truncated,
- validate episode records before writing,
- append metrics as JSONL,
- keep `latest/` and `best/` checkpoint metadata separate.

- [ ] **Step 4: Run trajectory-store tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-trajectory-store.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit trajectory persistence**

```bash
git add scripts/lib/rl-shell-v1/trajectory-store.mjs scripts/tests/rl-shell-v1-trajectory-store.test.mjs
git commit -m "feat(rl): add shell rl v1 trajectory store"
```

## Chunk 3: PPO Trainer, Evaluation Harness, Campaign Orchestration, And Entrypoint

### Task 7: Add the PPO trainer for the local student policy

**Files:**
- Create: `scripts/lib/rl-shell-v1/trainer.mjs`
- Create: `scripts/tests/rl-shell-v1-trainer.test.mjs`

- [ ] **Step 1: Write failing trainer tests**

```js
test('trainer computes total_loss with rl, distill, and kl components', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 0.5,
    klLoss: 0.1,
    distillationStatus: 'applied',
  });

  assert.equal(result.totalLoss, 0.6 + 0.2 * 0.5 + 0.01 * 0.1);
});

test('trainer zeros distillation weight when distillation was skipped', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 99,
    klLoss: 0.1,
    distillationStatus: 'skipped',
  });

  assert.equal(result.distillLossWeight, 0);
});
```

- [ ] **Step 2: Run trainer tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: FAIL with missing-module errors for `trainer.mjs`

- [ ] **Step 3: Implement PPO trainer over the local policy**

Add `scripts/lib/rl-shell-v1/trainer.mjs` with:

```js
export function createTrainerConfig(overrides = {}) {}
export function computeLosses({ rlLoss, distillLoss, klLoss, distillationStatus, config }) {}
export function computeAdvantages({ rewards }) {}
export function applyPpoUpdate({ policy, referencePolicy, trajectory, config }) {}
export function maybeRefreshReferencePolicy({ policy, referencePolicy, updateCount, config }) {}
```

Required behavior:
- default to `ppo_clip_epsilon = 0.2`, `distill_loss_weight = 0.2`, `kl_loss_weight = 0.01`,
- compute per-episode advantages and returns with `gamma = 1.0`, `lambda = 1.0`,
- update local policy weights in-place or via returned copy,
- refresh the frozen reference policy every 100 optimizer updates,
- keep trainer metrics separately reportable as `policy_loss`, `distill_loss`, `kl_loss`, `total_loss`.

- [ ] **Step 4: Run trainer tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit trainer**

```bash
git add scripts/lib/rl-shell-v1/trainer.mjs scripts/tests/rl-shell-v1-trainer.test.mjs
git commit -m "feat(rl): add shell rl v1 ppo trainer"
```

### Task 8: Add evaluation harness and run or campaign orchestration

**Files:**
- Create: `scripts/lib/rl-shell-v1/eval-harness.mjs`
- Create: `scripts/lib/rl-shell-v1/run-orchestrator.mjs`
- Create: `scripts/tests/rl-shell-v1-eval-harness.test.mjs`
- Create: `scripts/tests/rl-shell-v1-orchestrator.test.mjs`

- [ ] **Step 1: Write failing evaluation and orchestrator tests**

```js
test('eval harness selects best checkpoint deterministically', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const best = mod.pickBestCheckpoint([
    { step: 200, successRate: 0.5, regressionFreeFixRate: 0.5, avgTokenCount: 100 },
    { step: 300, successRate: 0.5, regressionFreeFixRate: 0.6, avgTokenCount: 130 },
  ]);

  assert.equal(best.step, 300);
});

test('run orchestrator marks campaign as insufficient-valid-tasks when registry gates fail', async () => {
  const mod = await import('../lib/rl-shell-v1/run-orchestrator.mjs');
  const result = await mod.runCampaign({
    config: makeConfig(),
    registryLoader: async () => ({ valid: false, reason: 'insufficient-valid-tasks' }),
  });

  assert.equal(result.status, 'insufficient-valid-tasks');
});

test('held-out evaluation never mutates student weights or trainer counters', async () => {
  const evalMod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const policy = makePolicyCheckpoint();
  const snapshot = JSON.stringify(policy);

  await evalMod.runHeldOutEval({
    checkpoint: policy,
    registry: makeHeldOutOnlyRegistry(),
    policyFactory: () => policy,
    teacherMode: 'none',
  });

  assert.equal(JSON.stringify(policy), snapshot);
});
```

- [ ] **Step 2: Run evaluation and orchestrator tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL with missing-module errors for `eval-harness.mjs` or `run-orchestrator.mjs`

- [ ] **Step 3: Implement eval harness**

Add `scripts/lib/rl-shell-v1/eval-harness.mjs` with:

```js
export async function runHeldOutEval({ checkpoint, registry, policyFactory, teacherMode = 'none' }) {}
export function summarizeEvalResults(results) {}
export function pickBestCheckpoint(checkpoints) {}
```

Required behavior:
- run held-out tasks with greedy student decoding,
- compute primary metrics and negative monitoring metrics,
- compute secondary metrics: average reward, average fused reward, average episode length, average token count, average runtime duration, teacher backend hit rate, fallback rate, teacher latency, policy loss, distillation loss, and KL loss,
- compute `teacher_overdependence_gap` only as diagnostic output,
- guarantee held-out evaluation is read-only with respect to student weights, optimizer state, and trainer counters,
- pick best checkpoint by success rate, then regression-free fix rate, then lower token count, then earlier step.

- [ ] **Step 4: Implement run and campaign orchestration**

Add `scripts/lib/rl-shell-v1/run-orchestrator.mjs` with:

```js
export async function runTrainingRun({ config, seed, deps = {} }) {}
export async function runCampaign({ config, deps = {} }) {}
export function createRunId({ seed }) {}
export function shouldStopRun({ episodesCompleted, updatesCompleted, config }) {}
```

Required behavior:
- require explicit `teacher_backend_requested` for campaign runs,
- own `max_task_sample_attempts`, seed propagation, run status transitions, and campaign aggregation,
- stop runs only on budget exhaustion or hard trainer failure,
- stop campaigns early only when valid-task gates fail before training starts,
- run exactly three seeds for acceptance campaigns.

- [ ] **Step 5: Run evaluation and orchestrator tests and confirm pass**

Run: `node --test scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit evaluation and orchestration**

```bash
git add scripts/lib/rl-shell-v1/eval-harness.mjs scripts/lib/rl-shell-v1/run-orchestrator.mjs scripts/tests/rl-shell-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-orchestrator.test.mjs
git commit -m "feat(rl): add shell rl v1 campaign orchestrator"
```

### Task 9: Add ContextDB summary writer, entrypoint, docs, and final verification

**Files:**
- Create: `scripts/lib/rl-shell-v1/contextdb-summary.mjs`
- Create: `scripts/rl-shell-v1.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing entrypoint and summary tests**

Add tests to `scripts/tests/rl-shell-v1-orchestrator.test.mjs` asserting:

```js
test('entrypoint train command prints run summary path', async () => {
  const result = spawnSync(process.execPath, ['scripts/rl-shell-v1.mjs', 'train', '--config', 'experiments/rl-shell-v1/configs/benchmark-v1.json', '--seed', '17'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /run_id/i);
});

test('contextdb summary writer validates required fields and keeps write failures non-fatal', async () => {
  const mod = await import('../lib/rl-shell-v1/contextdb-summary.mjs');
  const summary = {
    run_id: 'run-001',
    spec_path: 'docs/superpowers/specs/2026-03-22-aios-shell-rl-v1-design.md',
    student_model_id: 'tiny-json-policy-v1',
    primary_teacher: 'codex-cli',
    fallback_order: ['claude-code'],
    train_split: 'benchmark-v1-train',
    held_out_split: 'benchmark-v1-held-out',
    best_checkpoint_path: 'experiments/rl-shell-v1/runs/run-001/checkpoints/best/policy.json',
    best_metrics: { success_rate: 0.4 },
    seed_results: [{ seed: 17, status: 'ok' }],
    status: 'ok',
  };

  await assert.doesNotReject(() => mod.writeRunSummary({
    rootDir,
    summary,
    sessionId: 'session-123',
    writer: async () => { throw new Error('ctxdb unavailable'); },
  }));
});
```

- [ ] **Step 2: Run the entrypoint tests and confirm failure**

Run: `node --test scripts/tests/rl-shell-v1-orchestrator.test.mjs`
Expected: FAIL with missing entrypoint or missing summary-writer module

- [ ] **Step 3: Implement ContextDB summary writer**

Add `scripts/lib/rl-shell-v1/contextdb-summary.mjs` with:

```js
export async function writeRunSummary({ rootDir, summary, sessionId = '' }) {}
export function buildRunSummaryPayload({ run, metrics, config }) {}
```

Required behavior:
- validate summaries before writing,
- use the existing ContextDB CLI bridge instead of inventing a new persistence path,
- keep write failures non-fatal for local experiments but log them clearly,
- write only run-level summaries and best-checkpoint references, never raw episodes.

- [ ] **Step 4: Implement the standalone entrypoint and package scripts**

Add `scripts/rl-shell-v1.mjs` with subcommands:

```text
benchmark-generate
train
eval
campaign
```

Add `package.json` scripts:

```json
{
  "scripts": {
    "test:rl-shell-v1": "node --test scripts/tests/rl-shell-v1-*.test.mjs",
    "rl-shell-v1:benchmark": "node scripts/generate-rl-shell-v1-benchmark.mjs --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17",
    "rl-shell-v1:campaign": "node scripts/rl-shell-v1.mjs campaign --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli"
  }
}
```

Do not modify `scripts/aios.mjs` in v1.

- [ ] **Step 5: Document the experiment workflow**

Update `README.md` with one short experimental section:

```md
## Experimental: Shell RL V1

This repository includes an isolated shell/coding RL experiment runner under `scripts/rl-shell-v1.mjs`.

- Generate benchmark: `npm run rl-shell-v1:benchmark`
- Run campaign: `npm run rl-shell-v1:campaign`
- Run focused tests: `npm run test:rl-shell-v1`
```

- [ ] **Step 6: Run final verification**

Run: `npm run test:rl-shell-v1`
Expected: PASS

Run: `node scripts/generate-rl-shell-v1-benchmark.mjs --config experiments/rl-shell-v1/configs/benchmark-v1.json --seed 17`
Expected: `generated >= 48 tasks`

Run: `node scripts/rl-shell-v1.mjs campaign --config experiments/rl-shell-v1/configs/benchmark-v1.json --teacher codex-cli`
Expected:
- exit code `0` after a full three-seed campaign,
- printed `campaign_id`,
- printed `status=passed` or `status=failed`,
- printed per-seed held-out success rates,
- printed best checkpoint chosen by held-out outcome ordering,
- campaign artifact under `experiments/rl-shell-v1/campaigns/`,
- run artifacts under `experiments/rl-shell-v1/runs/`.

- [ ] **Step 7: Commit entrypoint and docs**

```bash
git add scripts/lib/rl-shell-v1/contextdb-summary.mjs scripts/rl-shell-v1.mjs package.json README.md
git commit -m "feat(rl): add shell rl v1 experiment runner"
```

## Plan Review Notes

- Keep each new module under one clear responsibility.
- Do not wire RL v1 into `scripts/aios.mjs` until the experimental runner has passed held-out campaign checks.
- Prefer injected dependencies in tests for teacher transport, registry loading, and checkpoint I/O.
- If the tiny local student policy proves too weak, do not expand scope to external ML stacks in the same branch. Write a follow-on spec instead.

## Execution Order

1. Finish Chunk 1 completely and keep the benchmark plus temp-runner green.
2. Finish Chunk 2 completely and keep the single-episode path green with teacher and reward tests.
3. Finish Chunk 3 only after the local PPO trainer has deterministic tests.
4. Run one benchmark generation, one short train smoke, one held-out eval smoke, then one three-seed campaign before claiming v1 is ready.

Plan complete and saved to `docs/superpowers/plans/2026-03-22-aios-shell-rl-v1-plan.md`. Ready to execute?
