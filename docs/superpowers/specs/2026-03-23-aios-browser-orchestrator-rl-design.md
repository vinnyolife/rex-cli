# AIOS Browser And Orchestrator RL Design

Date: 2026-03-23

## Summary

This spec extends the existing `aios` RL roadmap from:

- shared `RL Core`,
- migrated shell RL,

to a system-level mixed-environment RL program that adds:

- browser RL,
- orchestrator RL.

The resulting system uses:

- one shared `student` policy,
- one shared checkpoint lineage,
- one shared `RL Core` control plane,
- one mixed live-batch update path,
- one overall rollback decision.

Browser and orchestrator do not become separate RL systems. They become environment adapters plugged into the same learning loop already used by shell.

## Problem

`RL Core` now exists as a reusable shared layer, and shell RL has already been migrated onto it. The next system-level step is not more shell depth; it is extending the same learning loop to the other two high-value environments:

- browser execution,
- task orchestration and control decisions.

If browser and orchestrator are added as separate, environment-local RL stacks, the repository will immediately lose the reason `RL Core` was created:

1. update and rollback semantics will diverge,
2. comparison results will stop being comparable,
3. checkpoint lineage will fragment by environment,
4. replay pools will become incompatible,
5. teacher behavior and failure handling will fork,
6. later cross-environment learning will become a merge problem instead of a training problem.

The right next step is therefore to add browser and orchestrator as first-class `RL Core` adapters, even though that is more demanding than building them independently.

## Goals

1. Add a browser adapter that performs real online training.
2. Add an orchestrator adapter that performs real online training.
3. Keep one shared `student/checkpoint` across shell, browser, and orchestrator.
4. Allow one `live batch` to mix shell, browser, and orchestrator trajectories.
5. Keep comparison normalization unified as:
   - `better`
   - `same`
   - `worse`
   - `comparison_failed`
6. Keep rollback as one overall decision based on mixed-environment monitoring, not per-environment hard rollback.
7. Restrict browser RL to controlled real business flows rather than open web exploration.
8. Restrict orchestrator RL to high-signal control decisions rather than long-form planning.
9. Use teacher calls for browser and orchestrator only on:
   - failed episodes,
   - near-success boundary episodes.
10. Preserve environment-specific evidence so that mixed-batch degradation remains diagnosable.

## Non-Goals

1. Training separate browser-only or orchestrator-only students.
2. Allowing browser RL to freely explore arbitrary websites.
3. Training orchestrator on unconstrained plan-writing or open-ended reasoning tasks.
4. Making rollback environment-specific in this phase.
5. Switching from the current PPO-style RL spine to a new trainer family.
6. Turning `RL Core` into a browser runner or orchestrator runtime.
7. Replacing human-sensitive protections around browser auth, challenges, or risky outbound actions.

## Position In The Roadmap

The current system-level RL roadmap becomes:

1. `RL Core`
2. `Shell RL`
3. `Browser + Orchestrator Mixed RL`

This spec covers item `3`.

It assumes:

- `RL Core` already exists under `scripts/lib/rl-core/`,
- shell already imports `RL Core`,
- shell remains part of the same shared policy universe.

## Core System Boundary

The system remains split into:

- environment adapters,
- `RL Core`,
- one shared policy/checkpoint layer.

### Environment Adapters

Each adapter remains responsible for:

- task sampling,
- environment execution,
- evidence collection,
- matched comparison setup,
- replay candidate construction,
- environment evidence summaries.

This applies to:

- shell,
- browser,
- orchestrator.

### RL Core

`RL Core` remains responsible only for:

- episode admission,
- live-batch sealing,
- online updates,
- comparison aggregation,
- degradation tracking,
- checkpoint promotion,
- rollback,
- replay routing,
- teacher normalization,
- campaign summaries.

It still does not own:

- DOM execution,
- browser action implementation,
- shell command execution,
- task dispatch internals.

### Shared Policy Layer

There is exactly one active student/checkpoint lineage:

- `active_checkpoint_id`
- `pre_update_ref_checkpoint_id`
- `last_stable_checkpoint_id`

Browser and orchestrator both update this shared lineage.

## Top-Level Architecture

The mixed-environment RL architecture is:

1. shell adapter produces shell episodes,
2. browser adapter produces browser episodes,
3. orchestrator adapter produces orchestrator episodes,
4. `RL Core` admits those episodes into one shared stream,
5. `RL Core` seals mixed live batches,
6. one shared online update modifies the shared student,
7. one shared monitoring epoch judges the post-update checkpoint,
8. one shared rollback decision governs promotion or restoration.

In effect:

- execution is environment-specific,
- learning control is centralized,
- parameters are shared.

## Shared Data Contract Extensions

To support mixed-environment RL, shared episode and batch records must explicitly carry environment metadata.

Every replay-admissible episode must carry:

- `environment`
  - `shell`
  - `browser`
  - `orchestrator`
- `task_family`
- `teacher_triggered`
- `terminal_reward`
- `comparison_status`
- `relative_outcome`
- `replay_route`

Every live batch summary must carry:

- total batch size,
- per-environment counts,
- per-environment reward summary,
- per-environment `better/same/worse/comparison_failed`,
- overall aggregated comparison signal.

The point is not only to mix environments, but to keep mixed updates debuggable.

## Mixed Live Batch Rules

One `live batch` may contain trajectories from:

- shell,
- browser,
- orchestrator.

Batch sealing does not require homogeneous environment membership.

However, the batch must preserve:

- environment labels,
- environment counts,
- environment-specific comparison outcomes,
- environment-specific replay routing evidence.

This means one update may be influenced by:

- a shell repair episode,
- a browser flow-completion episode,
- an orchestrator dispatch decision episode,

inside the same batch.

That is intentional.

## Comparison And Rollback Semantics

### Per-Environment Comparison

Each environment adapter performs its own matched comparison with environment-native evidence.

Examples:

- shell compares repository repair outcomes,
- browser compares flow completion and error incidence,
- orchestrator compares control-decision quality and downstream outcomes.

Each adapter must convert its comparison result into the shared normalized contract:

- `better`
- `same`
- `worse`
- `comparison_failed`

### Overall Rollback

Rollback is based on overall mixed-environment monitoring, not per-environment hard failure.

The first implementation should compute one aggregate monitoring signal from:

- normalized `better/same/worse`,
- `comparison_failed`,
- environment coverage sufficiency.

That aggregate signal decides:

- continue monitoring,
- close epoch as replay-only,
- close epoch as promotion-eligible,
- roll back.

### Diagnostic Requirement

Even though rollback is overall, every monitoring summary must preserve per-environment evidence.

Otherwise the system would know that an update failed overall but not whether:

- browser poisoned orchestrator,
- orchestrator poisoned browser,
- shell stabilized the batch,
- one environment had no meaningful comparison coverage.

## Browser Adapter Design

### Browser Task Scope

The browser adapter only trains on controlled, high-signal real flows.

Allowed task classes:

- known target-site, known target-path flow completion,
- authenticated form fill / submit / publish sequences,
- flows with explicit success pages or explicit success UI states,
- flows with explicit auth-wall, challenge, forbidden, or validation-error failure modes.

Disallowed in this phase:

- open-ended browsing,
- broad web exploration,
- unconstrained website search behavior,
- unsafe autonomous outbound behavior without explicit flow constraints.

### Browser Episode Shape

`runEpisode()` must return structured multi-step evidence rather than raw full-page dumps.

Required evidence categories:

- visited page kinds,
- key selector presence/absence,
- user-facing form state,
- action taken,
- navigation result,
- validation errors,
- auth/challenge detection,
- terminal UI state,
- sensitive action flags.

Recommended normalized step fields:

- `page_kind`
- `key_selectors_present`
- `action_taken`
- `navigation_result`
- `form_error`
- `sensitive_action_flag`
- `terminal_status`

### Browser Terminal Reward

Browser reward must remain hard and environment-grounded.

Examples:

- explicit success state reached: positive reward,
- blocked by auth or challenge: negative reward,
- validation error or terminal error page: zero or negative reward,
- timeout, dead-end, or repeated no-progress: negative reward.

### Browser Comparison

Matched comparison runs the same flow and initial conditions against:

- current active checkpoint,
- `pre_update_ref`.

Comparison dimensions:

- success-state reachability,
- challenge/auth avoidance,
- validation-error incidence,
- action efficiency,
- no-progress reduction.

The output is then normalized into the shared comparison contract.

### Browser Teacher Policy

Teacher is not called on every browser episode.

Teacher is called only for:

- failed browser episodes,
- near-success browser episodes that did not cross the success boundary.

Boundary examples:

- reached the final step but failed submission,
- passed auth but failed final validation,
- reached the right page but took the wrong final action order.

## Orchestrator Adapter Design

### Orchestrator Task Scope

The orchestrator adapter trains only on high-value control decisions.

Allowed decision classes:

- `dispatch`
- `retry`
- `stop`
- `handoff`
- `preflight`

Disallowed in this phase:

- unconstrained long-form planning generation,
- free-form strategy writing as the primary training target,
- control episodes with no hard downstream verification.

### Orchestrator Episode Shape

An orchestrator episode represents one control round rather than a page flow.

Required evidence categories:

- current task context,
- current blockers and risks,
- available evidence,
- decision type,
- decision payload,
- selected executor,
- preflight choice,
- verification result,
- handoff trigger,
- terminal task outcome.

Recommended normalized step fields:

- `context_state`
- `decision_type`
- `decision_payload`
- `executor_selected`
- `preflight_selected`
- `verification_result`
- `handoff_triggered`
- `terminal_outcome`

### Orchestrator Terminal Reward

Reward must stay hard and consequence-based.

Examples:

- correct dispatch that advances completion: positive reward,
- failure to trigger needed human handoff: negative reward,
- invalid or repeated retry loops: negative reward,
- over-conservative preflight that stalls work: zero or negative reward,
- correct blocking of risky actions: positive reward.

### Orchestrator Comparison

Matched comparison runs the same control context through:

- current active checkpoint,
- `pre_update_ref`.

Comparison dimensions:

- fewer invalid retries,
- faster arrival at the correct executor,
- fewer missed human gates,
- less unsafe automation under bad state,
- stronger task-completion progression.

Output is normalized into:

- `better`
- `same`
- `worse`
- `comparison_failed`

### Orchestrator Teacher Policy

Teacher is also sparse-triggered.

Teacher is called only for:

- clearly failed control decisions,
- near-success control episodes that missed the right final decision.

Typical cases:

- the system should have handed off but continued,
- the system should have run preflight but executed directly,
- the system almost completed but chose the wrong final retry/stop/dispatch action.

## Teacher Policy Across Browser And Orchestrator

Teacher policy for this phase is deliberately more conservative than shell’s stronger intervention path.

For browser and orchestrator:

- no teacher call on clearly successful episodes,
- teacher call on failed episodes,
- teacher call on near-success boundary episodes.

Teacher outputs remain the same normalized structure:

- critique,
- reference,
- shaping,
- confidence.

The difference is when teacher is invoked, not what the normalized teacher contract looks like.

## RL Core Changes Required

`RL Core` must be extended to support mixed-environment campaigns without becoming environment-aware in the execution sense.

Required changes:

1. episode and replay contracts must carry `environment`,
2. campaign summaries must track per-environment breakdowns,
3. mixed batches must preserve environment composition,
4. comparison aggregation must consume normalized environment-tagged comparison inputs,
5. rollback diagnostics must preserve environment and task-family evidence,
6. replay routing must remain shared while preserving environment metadata.

`RL Core` should not grow browser-specific or orchestrator-specific execution assumptions.

## Failure Semantics

The failure model remains shared.

Existing failure classes still apply:

- `update_failed`
- `comparison_failed`
- `rollback_failed`
- `frozen_failure`
- `diagnostic_only`

New environments do not get custom rollback semantics.

Important rules:

1. Browser and orchestrator failures still normalize into shared replay and comparison outcomes.
2. `comparison_failed` contributes to overall instability even if it does not directly force rollback.
3. `rollback_failed` still drives `frozen_failure`.
4. Mixed campaigns must never lose environment attribution on failed evidence.

## Acceptance Criteria

Acceptance is split into three layers.

### 1. Adapter Correctness

Browser adapter must:

- produce structured browser episodes,
- produce normalized comparison results,
- produce replay candidates and evidence summaries.

Orchestrator adapter must:

- produce structured control-decision episodes,
- produce normalized comparison results,
- produce replay candidates and evidence summaries.

### 2. Mixed-Campaign Correctness

The system must prove:

- one live batch can contain browser and orchestrator trajectories together,
- online update works on mixed batches,
- mixed monitoring epochs aggregate normalized comparisons correctly,
- rollback triggers from overall mixed-environment performance rather than per-environment hard gates,
- rollback diagnostics preserve environment-level evidence.

### 3. Behavioral Improvement

The mixed-environment system must show:

- browser task performance improves versus baseline,
- orchestrator control quality improves versus baseline,
- mixed training does not degrade overall behavior below the relevant single-environment baselines.

## Implementation Order

This is one project, but not one giant code drop.

Recommended delivery order:

1. extend `RL Core` contracts and campaign summaries for mixed environments,
2. add browser adapter,
3. add orchestrator adapter,
4. add mixed-campaign entrypoints and aggregate rollback metrics,
5. run mixed-environment validation.

This keeps the shared semantics stable before the higher-risk adapters land.

## Risks

The main risks are:

1. shared-parameter interference between browser and orchestrator,
2. mixed-batch updates hiding which environment caused degradation,
3. overall rollback masking single-environment instability,
4. under-triggered teacher calls starving hard environments of guidance,
5. over-broad browser scope or over-broad orchestrator scope making reward too noisy.

The design addresses these risks by:

- constraining browser to controlled real flows,
- constraining orchestrator to hard control decisions,
- requiring per-environment batch and epoch breakdowns,
- keeping teacher sparse but targeted,
- keeping rollback overall while preserving environment evidence.

## Final Position

This phase does not create two more RL stacks.

It creates two more environment adapters on top of one shared system-level RL control plane.

That is the intended end-state for `aios`:

- shared learning core,
- shared checkpoint lineage,
- shared online updates,
- environment-specific execution,
- environment-specific evidence,
- system-level improvement and rollback.
