# AIOS Shell RL V1 Design

Date: 2026-03-22

## Summary

Build a true reinforcement learning experiment loop for `aios` that trains a local small `student` model on shell and coding tasks. V1 trains only the local student. Hosted CLI clients such as Codex CLI, Claude Code, Gemini CLI, or OpenCode act as external `teacher` backends and are never updated.

The v1 experiment uses synthetic bugfix repositories with failing tests. Each episode runs inside a fresh temporary workspace. The student interacts with the workspace through a constrained action protocol, the environment computes a terminal reward from real test outcomes, and the teacher augments each episode with shaping and a reference solution. Training uses a PPO policy objective plus a teacher distillation loss and a KL anchor to a frozen reference policy.

V1 is successful only if the trained student improves on held-out synthetic bugfix tasks with repeatable gains across multiple seeds.

## Problem

`aios` already has strong orchestration, memory, and evaluation primitives, but it does not have a true online RL loop:

- no trainable local agent policy for shell or coding work,
- no episode-level rollout store for trainable trajectories,
- no trainer that updates a local policy from reward,
- no isolated benchmark harness for proving that a local agent actually improves.

The project goal is not merely "self-improvement" through memory or prompt edits. The goal is a real RL system where a local student policy is updated from task outcomes and becomes better on repeat evaluation.

## Goals

1. Train a local token-level student policy with real RL updates.
2. Use synthetic shell and coding bugfix tasks with real tests as the first training environment.
3. Keep the environment terminal reward authoritative while allowing teacher shaping and distillation to accelerate learning.
4. Make experiment data reproducible, reviewable, and separate from normal `ContextDB` session traffic.
5. Prove improvement on held-out tasks before considering real repository tasks.

## Non-Goals

1. Productionizing RL inside the normal `aios` runtime.
2. Training Codex CLI, Claude Code, Gemini CLI, or OpenCode model weights.
3. Covering browser RL or orchestrator-policy RL in v1.
4. Training directly on real repository tasks in the first phase.
5. Supporting multi-machine, distributed, or GPU-first training in v1.
6. Building a multi-teacher ensemble in a single experiment run.

## Scope

In scope:

- a synthetic bugfix benchmark for shell and coding tasks,
- a local student model that emits token-level actions,
- one teacher backend per run with automatic fallback,
- terminal environment reward from test outcomes,
- teacher shaping and teacher reference-solution distillation,
- PPO training with KL regularization,
- held-out evaluation, checkpointing, and run summaries.

Out of scope:

- browser action environments,
- orchestrator routing environments,
- human-in-the-loop production training,
- model-serving hot swap inside the current user runtime,
- direct training against hosted teacher logits,
- merging raw RL episodes into standard `ContextDB` event streams.

## V1 Boundary

V1 answers exactly one question:

Can a small local student policy, trained with teacher-shaped PPO on synthetic shell and coding bugfix tasks, outperform its initial checkpoint on held-out tasks?

Everything in the design serves that question. Anything not required to answer it is excluded from v1.

## Core Architecture

V1 has eight units:

1. `rl-task-registry`
2. `rl-temp-runner`
3. `rl-student-runner`
4. `rl-trajectory-store`
5. `rl-teacher-gateway`
6. `rl-reward-fusion`
7. `rl-trainer`
8. `rl-eval-harness`

`rl-run-orchestrator` coordinates those units but does not absorb their responsibilities.

### 1. `rl-task-registry`

Purpose:
- store the synthetic bugfix benchmark,
- define train and held-out splits,
- provide a stable task manifest and repository snapshot identity.

Inputs:
- benchmark root directory,
- task id,
- split selector.

Outputs:
- `task_id`,
- `task_prompt`,
- `repo_snapshot_id`,
- `repo_source_path`,
- `verification_command`,
- `baseline_failing_tests`,
- `constraints`,
- `split`.

Contract:
- every task must reproduce its baseline failing tests before it is eligible for training or evaluation,
- held-out tasks are read-only to the trainer.

### 2. `rl-temp-runner`

Purpose:
- create a fresh temporary workspace for each episode,
- copy or materialize the task repository snapshot,
- execute student actions safely,
- collect filesystem and test evidence,
- clean up after the episode.

Inputs:
- task manifest,
- action sequence emitted by the student,
- per-run execution policy.

Outputs:
- executed command log,
- file-change log,
- final diff,
- test results before and after,
- runtime failures,
- timeout flags.

Contract:
- every episode runs in a new temp directory,
- no workspace state survives to the next episode,
- baseline failing tests are verified before the student acts,
- runtime failure still produces a valid terminal episode result.

### 3. `rl-student-runner`

Purpose:
- load the local trainable student,
- build the student prompt and running context,
- generate token-level actions plus log probabilities.

Inputs:
- task prompt,
- current observation trace,
- action budget,
- model checkpoint,
- prompt template.

Outputs:
- raw model text for the chosen action,
- token ids,
- token logprobs,
- parsed action object,
- stop reason when the episode ends.

Contract:
- the student is the only trainable policy in v1,
- each decision step emits exactly one structured action,
- generation must be deterministic under a fixed seed and checkpoint when sampling is disabled for evaluation.

### 4. `rl-trajectory-store`

Purpose:
- persist the full episode record for replay, analysis, and trainer input.

Inputs:
- task metadata,
- step-by-step student outputs,
- runtime evidence,
- teacher outputs,
- trainer metadata.

Outputs:
- one durable episode record per rollout,
- run-level metrics streams,
- checkpoint metadata.

Contract:
- episode storage is separate from the normal `ContextDB` event graph,
- the store must contain enough information to recompute metrics and inspect failures without rerunning the episode.

### 5. `rl-teacher-gateway`

Purpose:
- call the active teacher backend,
- normalize teacher output across Codex CLI, Claude Code, Gemini CLI, and OpenCode,
- apply automatic fallback when the primary teacher is unavailable.

Inputs:
- complete episode trace,
- run configuration,
- teacher backend preference,
- fallback list.

Outputs:
- normalized critique,
- normalized reference solution,
- scalar shaping score,
- teacher confidence,
- backend identity actually used,
- call status and latency.

Contract:
- the primary teacher used during execution always comes from persisted run config,
- ad hoc run config may be initialized from the current user client before the run starts,
- a fallback backend is attempted automatically on teacher failure,
- if all teachers fail, the episode continues with environment reward only,
- teacher output never mutates the workspace or the student checkpoint directly.

### 6. `rl-reward-fusion`

Purpose:
- combine environment terminal reward and teacher shaping into the scalar RL reward used by the trainer.

Inputs:
- terminal environment reward,
- teacher shaping score,
- fusion policy.

Outputs:
- fused reward,
- reward components,
- any clipping or override markers.

Contract:
- environment reward remains the dominant signal,
- teacher shaping can refine ranking among episodes but cannot convert a failed environment outcome into a successful one,
- fusion rules are fixed for a run and recorded with metrics.

### 7. `rl-trainer`

Purpose:
- update the student from rollout data,
- maintain the frozen reference policy,
- compute PPO loss, distillation loss, and KL penalty,
- write checkpoints.

Inputs:
- student rollout tokens and logprobs,
- fused reward,
- teacher reference solution,
- trainer hyperparameters.

Outputs:
- updated student checkpoint,
- trainer metrics,
- latest and best checkpoint records.

Contract:
- only the student weights are updated,
- teacher outputs are consumed as supervision but are never optimized,
- frozen reference updates follow the configured refresh cadence and are explicit in run metadata.

### 8. `rl-eval-harness`

Purpose:
- run fixed held-out evaluations,
- compare checkpoints,
- gate promotion of a checkpoint as the best run artifact.

Inputs:
- held-out task split,
- candidate checkpoint,
- evaluation config.

Outputs:
- held-out metrics,
- checkpoint comparison records,
- best-checkpoint selection.

Contract:
- held-out tasks are never used for training updates,
- the primary pass or fail criteria come from real task outcomes, not teacher scores.

## Student Action Protocol

The student is token-level, but v1 constrains it to a small structured action language so the runtime can execute it safely and deterministically.

At each decision step the student emits exactly one JSON object with one of these action types:

- `read`
- `run`
- `patch`
- `stop`

Required shapes:

```json
{"action":"read","path":"src/app.py"}
{"action":"run","command":"pytest tests/test_app.py -q"}
{"action":"patch","diff":"--- a/src/app.py\n+++ b/src/app.py\n@@ ..."}
{"action":"stop","message":"fix complete"}
```

Rules:

- `read` returns file content and metadata to the observation trace.
- `run` executes a shell command under the episode execution policy and appends stdout, stderr, exit code, and touched files to the trace.
- `patch` applies a unified diff inside the temp workspace and records success or failure.
- `stop` ends the episode immediately and triggers final verification tests.

This protocol keeps the student token-level while avoiding ambiguous free-form tool use. The action language is deliberately small so the benchmark environment stays interpretable in v1.

## Versioned Schemas

### `TaskManifest`

Every benchmark task is described by:

```json
{
  "schema_version": 1,
  "task_id": "bugfix-001",
  "repo_snapshot_id": "bugfix-001@v1",
  "repo_source_path": "experiments/rl-shell-v1/tasks/bugfix-001",
  "split": "train",
  "task_prompt": "Fix the failing tests in the repository.",
  "verification_command": "pytest -q",
  "baseline_failing_tests": ["tests/test_app.py::test_add"],
  "constraints": ["No network", "Do not edit tests"]
}
```

### `ObservationEvent`

Every executed step appends one versioned observation event:

```json
{
  "schema_version": 1,
  "step_index": 2,
  "action": {"action": "run", "command": "pytest -q"},
  "status": "ok",
  "error_code": null,
  "error_message": null,
  "payload": {
    "exit_code": 1,
    "stdout_excerpt": "...",
    "stderr_excerpt": "...",
    "stdout_truncated": false,
    "stderr_truncated": true,
    "files_touched": ["src/app.py"]
  }
}
```

`payload` is action-specific:

- `read`
  - `path`
  - `content_excerpt`
  - `content_truncated`
  - `bytes_read`
- `run`
  - `exit_code`
  - `stdout_excerpt`
  - `stderr_excerpt`
  - `stdout_truncated`
  - `stderr_truncated`
  - `files_touched`
- `patch`
  - `applied`
  - `files_touched`
  - `reject_reason`
  - `diff_excerpt`
- `stop`
  - `message`

`status` is one of:

- `ok`
- `rejected`
- `error`
- `timeout`

## Execution Policy

`rl-temp-runner` receives a fixed execution policy object for the whole run. V1 uses these required fields:

- `max_steps_per_episode`
- `max_command_seconds`
- `max_episode_seconds`
- `max_output_bytes_per_stream`
- `network_access`
- `forbidden_command_patterns`

V1 defaults:

- `max_steps_per_episode = 12`
- `max_command_seconds = 30`
- `max_episode_seconds = 180`
- `max_output_bytes_per_stream = 65536`
- `network_access = false`
- `forbidden_command_patterns` includes at least:
  - `sudo`
  - `ssh`
  - `scp`
  - `curl`
  - `wget`
  - `git push`
  - `git reset --hard`
  - `rm -rf /`

Execution rules:

- commands run from the temp workspace root,
- commands are non-interactive only,
- background processes are rejected,
- network access is disabled,
- `read` and `patch` paths must resolve under the temp workspace root after normalization,
- absolute paths outside the temp workspace root are rejected,
- path traversal that escapes the temp workspace root is rejected,
- `run` commands that reference external absolute filesystem paths or redirect output outside the temp workspace root are rejected before execution,
- stdout and stderr are truncated at the per-stream byte cap and the truncation is recorded in the episode,
- a rejected or timed-out command is recorded as a runtime failure and appended to the observation trace.

## Normative Runtime Definitions

These definitions are fixed for v1:

- `episode success`
  - the final verification command yields terminal reward `+1.0`.
- `irrecoverable runtime failure`
  - the temp workspace becomes unreadable,
  - the episode wall-clock budget is exceeded,
  - the command runner can no longer execute actions safely.
- `continue-on-error behavior`
  - invalid action JSON,
  - rejected commands,
  - non-zero command exits,
  - invalid patch applications
  are appended to the trace and do not end the episode by themselves.
- `task-pool exhaustion`
  - the run exceeds `max_task_sample_attempts` without finding enough valid tasks to continue.

## Episode Lifecycle

Each episode follows this sequence:

1. Sample one training task from `rl-task-registry`.
2. Materialize the task into a fresh temp directory.
3. Re-run baseline failing tests. If the baseline does not reproduce, skip the task and mark it invalid.
4. Initialize the student observation trace with the task prompt, repo manifest, and allowed-action policy.
5. Repeat until termination:
   - ask the student for one action,
   - validate and execute the action through `rl-temp-runner`,
   - append the resulting observation to the trace,
   - stop if the action is `stop`, the step budget is exhausted, the episode wall-clock budget is exhausted, or an irrecoverable runtime failure occurs.
6. Run final verification tests and compute the terminal environment reward.
7. Send the complete episode trace to `rl-teacher-gateway`.
8. Normalize teacher outputs and fuse reward components.
9. Persist the complete episode.
10. Update the student through `rl-trainer`.
11. Periodically run `rl-eval-harness` on held-out tasks.

If task sampling hits task-pool exhaustion, the run terminates with status `insufficient-valid-tasks` and does not qualify for campaign success evaluation.

## Teacher Gateway Semantics

The teacher is part of every rollout in v1.

### Teacher selection

- `primary teacher`: read from persisted run config.
- `fallback teachers`: ordered list from run config, excluding the primary backend.
- ad hoc run creation may infer the initial primary teacher from the current active client before persisting run config.

### Teacher input

The teacher receives the full episode trace:

- task prompt,
- repository manifest or summary,
- all student actions,
- all environment observations,
- final diff,
- final test results,
- runtime errors and stop reason.

### Teacher output

The normalized teacher response contains:

- `critique`: short failure or quality analysis,
- `reference_solution`: either an ordered ideal repair attempt in the same action language or a textual repair recipe that can be normalized into that action language,
- `shaping_score`: scalar in `[-1.0, 1.0]`,
- `confidence`: scalar in `[0.0, 1.0]`,
- `backend_used`,
- `call_status`.

The `critique` is retained for inspection and future hindsight work. The `reference_solution` is the distillation target in v1.

`call_status` is one of:

- `ok`
- `fallback_ok`
- `invalid_response`
- `failed_all_backends`

Teacher-failure defaults are normative:

| Field | `failed_all_backends` or unusable response value |
|---|---|
| `shaping_score` | `0.0` |
| `confidence` | `0.0` |
| `reference_solution` | `null` |
| `critique` | `null` |
| `teacher_term` | `0.0` |
| `distillation_status` | `skipped` |
| `distillation_skip_reason` | `teacher_unavailable` |

## Reward Design

### Verification scope

Every task manifest must provide one canonical verification command. V1 reward uses the result of that full verification command, not a subset of ad hoc checks.

The verification command defines:

- the baseline failing tests,
- the full regression surface used to detect new failures,
- the terminal pass or fail outcome for reward assignment.

### Terminal environment reward

The environment reward is computed only from the final outcome of the episode.

Default scale:

| Final verification outcome | Terminal reward |
|---|---|
| All original failing tests pass and no new failures are introduced | `+1.0` |
| Original failing test count decreases and no new failures are introduced | `+0.25` |
| Original failing test count is unchanged and no new failures are introduced | `0.0` |
| Any new failures are introduced, even if some original failures are fixed | `-1.0` |
| Original failing test count increases | `-1.0` |
| Verification command crashes, times out, or the repository becomes invalid | `-1.0` |

This remains terminal-only reward because it is based solely on the episode end state.

### Teacher shaping reward

The teacher returns `shaping_score` in `[-1.0, 1.0]`. V1 converts it to an additive shaping term in `[-0.2, 0.2]`.

The shaping term is advisory:

- it may increase the reward of a partial-improvement episode,
- it may decrease the reward of a low-quality or wasteful episode,
- it may break ties between otherwise similar terminal outcomes.

Teacher shaping may not reverse the sign of the terminal environment outcome:

- a terminal failure cannot become a net success because of teacher shaping,
- a terminal success cannot become a net failure because of teacher shaping.

### Fused reward

For each episode:

- `teacher_term = clamp(shaping_score * 0.2, -0.2, 0.2)`
- `raw_fused = terminal_reward + teacher_term`
- if `terminal_reward > 0`, then `fused_reward = max(0.05, raw_fused)`
- if `terminal_reward == 0`, then `fused_reward = clamp(raw_fused, -0.2, 0.2)`
- if `terminal_reward < 0`, then `fused_reward = min(-0.05, raw_fused)`

This preserves environment dominance while still allowing teacher shaping to provide useful ranking signal.

## Distillation Design

Teacher distillation in v1 does not depend on teacher logits. CLI backends may not expose them, so the distillation target is the normalized `reference_solution` text or action sequence.

V1 distillation flow:

1. normalize the teacher reference solution into the student action protocol,
2. align that normalized reference against the same task prompt,
3. compute a supervised sequence loss against the student policy on the teacher target,
4. weight that loss as an auxiliary objective beside PPO.

The critique is not part of the primary distillation loss in v1. It is stored for analysis, run summaries, and future hindsight-style objectives.

If the teacher returns a reference solution that cannot be normalized into the student action protocol:

- mark `distillation_status = skipped`,
- record `distillation_skip_reason`,
- set `distill_loss = 0` for that episode,
- continue PPO training from the fused reward without failing the run.

Normalization is deterministic:

1. if `reference_solution` is already a valid ordered sequence of `read` / `run` / `patch` / `stop` action JSON objects, accept it unchanged,
2. if `reference_solution` is textual, convert it only when a deterministic parser can extract a total ordered sequence where every step maps exactly to one allowed action type,
3. if the textual recipe contains ambiguity, branching, or unsupported action types, reject normalization and skip distillation for that episode.

Examples:

- valid action sequence:

```json
[
  {"action":"read","path":"src/app.py"},
  {"action":"patch","diff":"--- a/src/app.py\n+++ b/src/app.py\n@@ ..."},
  {"action":"run","command":"pytest -q"},
  {"action":"stop","message":"done"}
]
```

- valid textual recipe that normalizes:

```text
1. Read src/app.py
2. Apply the attached unified diff to src/app.py
3. Run pytest -q
4. Stop
```

- invalid textual recipe that does not normalize:

```text
Inspect whatever files seem relevant, maybe refactor the parser, and if that does not work try another approach.
```

## Training Objective

The trainer optimizes three components:

1. `rl_loss`
   - PPO objective over the student trajectory using the fused reward.
2. `distill_loss`
   - supervised loss to the normalized teacher reference solution.
3. `kl_loss`
   - KL penalty from the current student policy to a frozen reference policy.

The trainer records each component separately for every update step.

V1 uses this combined objective:

- `total_loss = rl_loss + 0.2 * distill_loss + 0.01 * kl_loss`

Normative trainer defaults:

| Config key | Default |
|---|---|
| `trainer_mode` | `ppo` |
| `ppo_clip_epsilon` | `0.2` |
| `discount_gamma` | `1.0` |
| `gae_lambda` | `1.0` |
| `distill_loss_weight` | `0.2` |
| `kl_loss_weight` | `0.01` |
| `reference_refresh_every_updates` | `100` |

If `distillation_status = skipped`, then:

- `distill_loss = 0`,
- `distill_loss_weight = 0` for that episode,
- `total_loss = rl_loss + 0.01 * kl_loss`.

V1 principle:

- RL remains the primary learning mechanism,
- teacher distillation accelerates learning but must not fully substitute for reward-based improvement,
- KL stabilizes updates for a small student model.

## Episode Record Schema

Each episode record must contain at least:

### Identity and task context

- `episode_id`
- `run_id`
- `task_id`
- `split`
- `repo_snapshot_id`
- `student_model_id`
- `teacher_backend_requested`
- `teacher_backend_used`
- `seed`
- `start_ts`
- `end_ts`
- `status`

### Initial task state

- `task_prompt`
- `constraints`
- `baseline_failing_tests`
- `baseline_reproduced`

### Student trajectory

- ordered list of student steps, each containing:
  - `step_index`
  - `prompt_excerpt`
  - `raw_output_text`
  - `token_ids`
  - `token_logprobs`
  - `parsed_action`
  - `observation_event`

### Runtime evidence

- `commands_executed`
- `files_read`
- `files_touched`
- `patch_apply_results`
- `stdout_summary`
- `stderr_summary`
- `final_diff`
- `tests_before`
- `tests_after`
- `runtime_failures`
- `timeout_flag`
- `stop_reason`

### Teacher outputs

- `teacher_call_status`
- `teacher_latency_ms`
- `teacher_confidence`
- `teacher_critique`
- `teacher_reference_solution`
- `teacher_shaping_score`
- `distillation_status`
- `distillation_skip_reason`

### Trainer metadata

- `terminal_reward`
- `teacher_term`
- `fused_reward`
- `advantage`
- `return`
- `policy_loss`
- `distill_loss`
- `kl_loss`

The episode record must be sufficient to audit reward calculation and trainer behavior without rerunning the task.

Auditability scope in v1 means these values are recomputable from stored artifacts without rerunning the environment:

- terminal reward,
- teacher term,
- fused reward,
- pass or fail metrics,
- episode length,
- fallback usage.

`advantage` and `return` are trainer-side cached scalars for debugging and do not need to be recomputed from raw rollout state alone.

When inline excerpts are truncated, the episode record must also store artifact paths for full captured material:

- `stdout_artifact_path`
- `stderr_artifact_path`
- `final_diff_artifact_path`
- `observation_trace_artifact_path`

## Filesystem Layout

V1 experiment artifacts live outside the normal production memory flow:

```text
experiments/
  rl-shell-v1/
    campaigns/
      <campaign_id>.json
    configs/
    tasks/
    runs/
      <run_id>/
        config.json
        metrics.jsonl
        episodes/
          <episode_id>.json
        checkpoints/
          latest/
          best/
        evals/
          short-<step>.json
          full-<step>.json
```

`ContextDB` receives only run summaries, evaluation summaries, and best-checkpoint references. Raw episode JSON does not become normal session event data in v1.

## Run Orchestration

One run contains:

- one student initialization,
- one primary teacher backend,
- one fallback ordering,
- one benchmark train split,
- one held-out split,
- one fixed reward fusion policy,
- one PPO trainer configuration,
- one fixed run budget,
- one explicit seed.

The orchestrator loop is:

1. initialize run config and checkpoint directories,
2. sample a training task,
3. execute one episode,
4. persist the episode,
5. update the student,
6. record metrics,
7. periodically run short held-out evaluation,
8. periodically run full held-out evaluation and update the best checkpoint,
9. stop when the configured budget is exhausted or a hard trainer failure occurs.

Cross-unit ownership is explicit:

- `rl-run-orchestrator` owns seed propagation, task-sampling attempts, run-status transitions, and campaign aggregation,
- `rl-teacher-gateway` owns teacher retries and backend fallback,
- `rl-temp-runner` owns command execution, path containment, and per-step timeout enforcement,
- `rl-trainer` owns optimizer updates and reference-policy refresh cadence.

V1 run termination is deterministic. There is no adaptive early stop on convergence in v1. Required budget fields are:

- `max_training_episodes`
- `max_optimizer_updates`
- `max_task_sample_attempts`
- `short_eval_every_episodes`
- `full_eval_every_episodes`

Minimum valid-task gates:

- at least `32` valid train tasks must exist before a campaign run starts,
- at least `16` valid held-out tasks must exist before a campaign run starts.

If either minimum gate fails, the campaign must stop before training with status `insufficient-valid-tasks`.

Best checkpoint selection is deterministic. The ordering is:

1. higher full held-out task success rate,
2. higher regression-free fix rate,
3. lower average held-out token count,
4. earlier checkpoint step as the final tie-breaker.

## Failure Handling

### Invalid benchmark task

- if baseline failing tests do not reproduce, mark the task invalid and skip it,
- invalid tasks are excluded from both training and held-out metrics until repaired.

### Student parse failure

- if the student emits invalid action JSON, record a parse failure,
- count the step as a failed action,
- append the parse error to the observation trace,
- allow the episode to continue until `stop`, step budget exhaustion, episode timeout, or irrecoverable runtime failure ends it.

### Runtime failure

- command timeout, invalid patch, or repository corruption still yields a terminal episode result,
- the episode is trainable with negative terminal reward.

### Teacher failure

- attempt the configured fallback order automatically,
- if all teachers fail, keep the episode and train from environment reward only,
- mark the episode clearly so teacher-free episodes can be filtered in subsequent analysis.

### Trainer instability

- if loss becomes non-finite or checkpoint writing fails, stop the run,
- preserve the latest valid checkpoint and all completed episode records,
- write a run-failure summary for diagnosis.

## Evaluation

Evaluation uses held-out synthetic tasks that are never used for gradient updates.

One v1 acceptance result is a `campaign`, not a single run. A campaign contains exactly three independent runs with identical configuration except for seed. The campaign artifact stores:

- `campaign_id`
- `spec_path`
- `seed_list`
- `run_ids`
- `initial_checkpoint_metrics`
- `best_checkpoint_metrics_by_run`
- `campaign_pass`
- `campaign_status`

Primary metrics:

- held-out task success rate,
- held-out test-pass delta,
- regression-free fix rate.

Secondary metrics:

- average reward and fused reward,
- average episode length,
- average token count,
- average runtime duration,
- teacher backend hit rate,
- fallback rate,
- teacher latency,
- policy, distillation, and KL losses.

Negative monitoring metrics:

- reward hacking rate,
- degenerate action rate,
- teacher overdependence gap,
- held-out variance across seeds.

Definitions:

- `reward hacking rate`
  - fraction of episodes where `terminal_reward <= 0` and `teacher_term > 0`.
- `degenerate action rate`
  - fraction of episodes that satisfy at least one condition:
    - the same `run` command repeats three or more times consecutively,
    - more than 25 percent of steps are invalid action JSON,
    - the episode ends with no successful `patch` and no decrease in failing test count.
- `teacher overdependence gap`
  - on full held-out evaluation, run a diagnostic student-only pass and a diagnostic teacher-visible pass where teacher critique is appended to the initial prompt without any training update,
  - compute `teacher_visible_success_rate - student_only_success_rate`,
  - report the gap only as a diagnostic metric and never as a success criterion.

### Success threshold

V1 is successful only if:

1. exactly three campaign seeds are trained and evaluated,
2. at least two of the three best-run checkpoints outperform the initial student on held-out task success rate,
3. the improved success rate does not come with a worse regression-free fix rate,
4. the observed gain is supported by real held-out test results rather than teacher score alone.

## Risks And Controls

### Sparse reward

Risk:
- the student may see too many failures for RL to learn efficiently.

Control:
- start with very small synthetic bugfix tasks,
- keep action budgets small,
- rely on teacher shaping only as a bounded tie-breaker and ranking aid.

### Teacher bias

Risk:
- the student may overfit to teacher style instead of real task completion.

Control:
- keep environment reward dominant,
- record teacher backend and fallback identity for every episode,
- judge success on held-out tests, not teacher scores.

### CPU-bound training cost

Risk:
- local training and rollout speed may be slow.

Control:
- keep the student model small,
- cap context length, action budget, and episode runtime,
- optimize for repeatable improvement on a small benchmark rather than large-scale throughput.

### Environment contamination

Risk:
- stale state could leak between episodes and corrupt reward signals.

Control:
- materialize every episode in a fresh temp directory,
- verify baseline failures before the student acts,
- cleanly discard the temp workspace after the episode ends.

### RL collapsing into imitation

Risk:
- teacher distillation may dominate and make the system an imitation pipeline with RL attached.

Control:
- log RL, distillation, and KL losses separately,
- compare ablations against RL-only and RL-plus-shaping baselines before drawing conclusions.

### Synthetic-to-real transfer gap

Risk:
- success on synthetic tasks may not transfer to real `aios` work.

Control:
- keep the benchmark close to realistic bugfix workflows,
- treat real repository tasks as a later shadow-eval phase, not as v1 training data.

## Integration With Existing AIOS Systems

V1 reuses existing `aios` infrastructure selectively:

- `ContextDB` for run-level summaries and best-checkpoint references,
- existing client-detection and CLI-invocation knowledge for teacher routing,
- current verification patterns for documenting how experiments are validated.

V1 does not reuse the normal production orchestrator as the training loop, and it does not store raw RL episodes as ordinary production session events.

## Integration Contracts

### Client identity resolution

The run orchestrator resolves the primary teacher backend in this order:

1. explicit run config `teacher_backend_requested`,
2. current session client id from harness or `ContextDB` session metadata,
3. fail run initialization if neither source is available.

For acceptance campaigns, `teacher_backend_requested` is mandatory in config. Current-session client detection is allowed only when creating an ad hoc run config before training starts.

Normalized backend ids in v1 are:

- `codex-cli`
- `claude-code`
- `gemini-cli`
- `opencode`

### Teacher adapter contract

Teacher request payload:

- `run_id`
- `episode_id`
- `task_id`
- `task_prompt`
- `student_trace`
- `final_diff`
- `verification_result`
- `execution_policy_summary`

Teacher response payload:

- `backend_used`
- `call_status`
- `latency_ms`
- `critique`
- `reference_solution`
- `shaping_score`
- `confidence`

### ContextDB summary contract

V1 writes run-level summaries only. Each summary record contains at least:

- `run_id`
- `spec_path`
- `student_model_id`
- `primary_teacher`
- `fallback_order`
- `train_split`
- `held_out_split`
- `best_checkpoint_path`
- `best_metrics`
- `seed_results`
- `status`

## Verification Requirements

Before v1 can be considered ready for implementation planning, the written plan must preserve these checks:

1. benchmark tasks reproduce their baseline failures,
2. episode workspaces are isolated per rollout,
3. teacher fallback does not corrupt episode accounting,
4. trainer metrics separate RL, distillation, and KL behavior,
5. held-out evaluation remains independent from training,
6. best-checkpoint selection is based on held-out real outcomes.

## Open Decision Status

This spec intentionally freezes the following v1 decisions:

- environment: shell and coding only,
- benchmark: synthetic bugfix tasks with tests,
- student: local small token-level model,
- teacher: current client by default, with automatic fallback,
- teacher usage: every rollout,
- signal design: environment terminal reward plus teacher shaping plus teacher distillation,
- trainer family: PPO with KL anchor,
- isolation: temp directory per episode,
- success gate: repeatable held-out improvement across seeds.

No further v1 scoping decisions are left open in this document.
