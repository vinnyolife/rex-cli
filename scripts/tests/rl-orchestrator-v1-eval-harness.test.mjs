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

test('orchestrator holdout can run with real harness mode and execution-mode fallback', async () => {
  const evalMod = await import('../lib/rl-orchestrator-v1/eval-harness.mjs');
  const regMod = await import('../lib/rl-orchestrator-v1/task-registry.mjs');

  const executionModes = [];
  const holdout = await evalMod.runOrchestratorHoldout({
    tasks: regMod.loadRealOrchestratorTasks().slice(0, 5),
    checkpointId: 'candidate-real',
    baselineCheckpointId: 'baseline-real',
    harnessMode: 'real',
    harnessOptions: {
      rootDir: process.cwd(),
      executionMode: 'live',
      executeOrchestrate: async (options) => {
        executionModes.push(options.executionMode);
        if (options.executionMode === 'live') {
          return {
            exitCode: 1,
            report: {
              kind: 'guardrail.capability-unknown',
            },
          };
        }
        return {
          exitCode: 0,
          report: {
            dispatchRun: {
              mode: 'dry-run',
              ok: true,
              runtime: { id: 'local-dry-run' },
              executorRegistry: ['local-phase'],
              jobRuns: [{ status: 'simulated' }],
            },
            dispatchPreflight: { results: [] },
          },
        };
      },
    },
  });

  assert.equal(holdout.episode_count, 5);
  assert.equal(holdout.schema_validation_failures, 0);
  assert.equal(holdout.evaluation_harness_mode, 'real');
  assert.equal(executionModes.includes('live'), true);
  assert.equal(executionModes.includes('dry-run'), true);
});
