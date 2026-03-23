import assert from 'node:assert/strict';
import test from 'node:test';

test('orchestrator task registry keeps only hard-verifiable control tasks and samples deterministically', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/task-registry.mjs');

  const tasks = mod.loadRealOrchestratorTasks({ countPerType: 1 });
  assert.deepEqual(
    tasks.map((task) => task.decision_type).sort(),
    ['dispatch', 'handoff', 'preflight', 'retry', 'stop']
  );
  assert.equal(mod.sampleOrchestratorTask({ seed: 29, attempt: 0, tasks }).decision_type, 'dispatch');
  assert.equal(mod.sampleOrchestratorTask({ seed: 29, attempt: 1, tasks }).decision_type, 'retry');

  assert.equal(mod.isAdmissibleOrchestratorTask({
    task_id: 'reject-plan',
    decision_type: 'dispatch',
    context_snapshot_id: 'ctx-plan',
    expected_executor: 'local-phase',
    hard_verification_evidence: ['verify'],
    plan_writing_task: true,
  }), false);

  assert.equal(mod.isAdmissibleOrchestratorTask({
    task_id: 'reject-soft',
    decision_type: 'dispatch',
    context_snapshot_id: 'ctx-soft',
    expected_executor: 'local-phase',
    hard_verification_evidence: [],
  }), false);
});

