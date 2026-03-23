import assert from 'node:assert/strict';
import test from 'node:test';

test('validateMixedEpisode accepts environment-tagged replay-addressable episodes', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');

  assert.doesNotThrow(() => mod.validateMixedEpisode({
    schema_version: 1,
    environment: 'browser',
    task_family: 'publish-flow',
    teacher_triggered: false,
    teacher_trigger_reason: null,
    boundary_episode: false,
    terminal_reward: 1,
    comparison_status: 'completed',
    relative_outcome: 'better',
    replay_route: 'positive',
    safety_violation: false,
    safety_violation_reason: null,
  }));
});

test('validateMixedEpisode forces comparison_failed episodes into diagnostic_only routing', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');

  assert.throws(
    () => mod.validateMixedEpisode({
      schema_version: 1,
      environment: 'orchestrator',
      task_family: 'handoff',
      teacher_triggered: true,
      teacher_trigger_reason: 'failure',
      boundary_episode: false,
      terminal_reward: -1,
      comparison_status: 'comparison_failed',
      relative_outcome: null,
      replay_route: 'neutral',
      safety_violation: false,
      safety_violation_reason: null,
    }),
    /diagnostic_only/i
  );
});

test('validateHoldoutValidationResult accepts normalized mixed holdout payloads', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');

  assert.doesNotThrow(() => mod.validateHoldoutValidationResult({
    environment: 'browser',
    status: 'passed',
    episode_count: 20,
    metrics: {
      success_rate: 0.65,
      comparison_failed_rate: 0.1,
      schema_validation_failures: 0,
    },
  }));
});
