import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('computeEpochOutcome returns replay_only when active-environment coverage is insufficient', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');

  const outcome = mod.computeEpochOutcome({
    activeEnvironments: ['shell', 'browser', 'orchestrator'],
    betterCount: 1,
    worseCount: 0,
    comparisonFailedCount: 0,
    coverageSatisfied: false,
    shellSafetyGatePassed: true,
    degradationStreak: 0,
  });

  assert.equal(outcome.outcome, 'replay_only');
});

test('computeEpochOutcome does not evaluate shell safety gate unless promotion is otherwise eligible', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  let gateCalled = false;

  const outcome = mod.computeEpochOutcome({
    activeEnvironments: ['shell', 'browser'],
    betterCount: 0,
    worseCount: 0,
    comparisonFailedCount: 1,
    coverageSatisfied: true,
    degradationStreak: 0,
    shellSafetyGate: () => {
      gateCalled = true;
      return true;
    },
  });

  assert.equal(outcome.outcome, 'replay_only');
  assert.equal(gateCalled, false);
});

test('reduceDegradationStreak triggers rollback after three ordered degradations', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');

  const outcome = mod.reduceDegradationStreak([
    { comparison_status: 'completed', relative_outcome: 'worse' },
    { comparison_status: 'completed', relative_outcome: 'same' },
    { comparison_status: 'comparison_failed', relative_outcome: null },
    { comparison_status: 'completed', relative_outcome: 'worse' },
  ]);

  assert.equal(outcome.degradationStreak, 3);
  assert.equal(outcome.shouldRollback, true);
});

test('computeEpochOutcome gives rollback precedence over coverage and shell-safety replay_only paths', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');

  const outcome = mod.computeEpochOutcome({
    activeEnvironments: ['shell', 'browser'],
    betterCount: 0,
    worseCount: 0,
    comparisonFailedCount: 0,
    coverageSatisfied: false,
    shellSafetyGatePassed: false,
    degradationStreak: 3,
  });

  assert.equal(outcome.outcome, 'rollback');
});

test('runOnlineCampaign exits no_work_available after exhausting the idle backoff budget', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-idle-'));

  const result = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      initialCheckpointId: 'ckpt-a',
      activeEnvironments: ['browser'],
      idleBackoffBudget: 2,
      maxTasks: 5,
    },
    deps: {
      sampleTask: async () => null,
      holdoutValidator: async () => ({ status: 'not_requested' }),
    },
  });

  assert.equal(result.status, 'no_work_available');
});
