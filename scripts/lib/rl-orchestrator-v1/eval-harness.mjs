import { validateHoldoutValidationResult } from '../rl-core/schema.mjs';
import { compareOrchestratorAgainstReference, runOrchestratorEpisode } from './adapter.mjs';
import { createCiFixtureOrchestratorHarness } from './decision-runner.mjs';
import { validateOrchestratorHoldoutResult } from './schema.mjs';
import { loadRealOrchestratorTasks } from './task-registry.mjs';

export async function runOrchestratorHoldout({
  tasks = loadRealOrchestratorTasks().slice(0, 20),
  checkpointId,
  baselineCheckpointId = 'orch-baseline',
  harness = createCiFixtureOrchestratorHarness(),
}) {
  const validTasks = loadRealOrchestratorTasks({ tasks });
  let successCount = 0;
  let comparisonFailedCount = 0;
  let missedHandoffCount = 0;
  let schemaValidationFailures = 0;

  for (const task of validTasks) {
    try {
      const episode = await runOrchestratorEpisode({
        task,
        checkpointId,
        harness,
      });
      if (episode.terminal_outcome === 'success') {
        successCount += 1;
      }
      if (episode.decision_type === 'handoff' && !episode.handoff_triggered) {
        missedHandoffCount += 1;
      }
      const comparison = await compareOrchestratorAgainstReference({
        task,
        activeCheckpointId: checkpointId,
        preUpdateRefCheckpointId: baselineCheckpointId,
        harness,
      });
      if (comparison.comparison_status === 'comparison_failed') {
        comparisonFailedCount += 1;
      }
    } catch {
      schemaValidationFailures += 1;
    }
  }

  const result = validateOrchestratorHoldoutResult({
    episode_count: validTasks.length,
    decision_success_rate: validTasks.length === 0 ? 0 : successCount / validTasks.length,
    missed_handoff_rate: validTasks.length === 0 ? 0 : missedHandoffCount / validTasks.length,
    comparison_failed_rate: validTasks.length === 0 ? 0 : comparisonFailedCount / validTasks.length,
    schema_validation_failures: schemaValidationFailures,
  });

  const corePayload = validateHoldoutValidationResult({
    environment: 'orchestrator',
    status: result.comparison_failed_rate <= 0.2 && result.schema_validation_failures === 0 ? 'passed' : 'failed',
    episode_count: result.episode_count,
    metrics: {
      decision_success_rate: result.decision_success_rate,
      missed_handoff_rate: result.missed_handoff_rate,
      comparison_failed_rate: result.comparison_failed_rate,
      schema_validation_failures: result.schema_validation_failures,
    },
  });

  return {
    ...result,
    ...corePayload,
  };
}

