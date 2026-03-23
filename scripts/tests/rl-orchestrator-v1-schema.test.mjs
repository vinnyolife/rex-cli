import assert from 'node:assert/strict';
import test from 'node:test';

test('orchestrator schema validates task, evidence, and holdout payloads', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/schema.mjs');

  assert.doesNotThrow(() => mod.validateOrchestratorTask({
    task_id: 'orch-dispatch-001',
    decision_type: 'dispatch',
    context_snapshot_id: 'ctx-1',
    expected_executor: 'local-phase',
    hard_verification_evidence: ['verify:dispatch'],
  }));

  assert.doesNotThrow(() => mod.validateOrchestratorEvidence({
    context_state: {},
    decision_type: 'dispatch',
    decision_payload: {},
    executor_selected: 'local-phase',
    preflight_selected: false,
    verification_result: 'passed',
    handoff_triggered: false,
    terminal_outcome: 'success',
  }));

  assert.doesNotThrow(() => mod.validateOrchestratorHoldoutResult({
    episode_count: 20,
    decision_success_rate: 0.7,
    missed_handoff_rate: 0.05,
    comparison_failed_rate: 0.1,
    schema_validation_failures: 0,
  }));
});

