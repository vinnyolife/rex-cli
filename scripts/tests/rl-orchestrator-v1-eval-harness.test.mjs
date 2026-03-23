import assert from 'node:assert/strict';
import test from 'node:test';

test('orchestrator holdout returns gate metrics with zero schema failures on fixture harness', async () => {
  const evalMod = await import('../lib/rl-orchestrator-v1/eval-harness.mjs');
  const regMod = await import('../lib/rl-orchestrator-v1/task-registry.mjs');
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');

  const holdout = await evalMod.runOrchestratorHoldout({
    tasks: regMod.loadRealOrchestratorTasks().slice(0, 20),
    checkpointId: 'candidate',
    harness: runnerMod.createCiFixtureOrchestratorHarness(),
  });

  assert.equal(holdout.episode_count, 20);
  assert.equal(typeof holdout.decision_success_rate, 'number');
  assert.equal(typeof holdout.missed_handoff_rate, 'number');
  assert.equal(typeof holdout.comparison_failed_rate, 'number');
  assert.equal(typeof holdout.schema_validation_failures, 'number');
  assert.equal(holdout.schema_validation_failures, 0);
});

