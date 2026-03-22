import assert from 'node:assert/strict';
import test from 'node:test';

test('trainer computes advantages from multi-step reward sequences', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const { advantages } = mod.computeAdvantages({ rewards: [0, 0.25, 1] });
  assert.deepEqual(advantages, [1.25, 1.25, 1]);
});

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

test('trainer updates policy from multi-step trajectories', async () => {
  const trainerMod = await import('../lib/rl-shell-v1/trainer.mjs');
  const policyMod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const policy = policyMod.createStudentPolicy({ seed: 7 });
  const referencePolicy = trainerMod.createReferencePolicyFrom(policy);

  const result = trainerMod.applyPpoUpdate({
    policy,
    referencePolicy,
    trajectory: {
      stepFeatureKeys: ['step-1', 'step-2', 'step-3'],
      stepTokenIds: [[5], [6], [8]],
      rewards: [0, 0.25, 1],
      distillationStatus: 'skipped',
      teacherTokenIds: [],
    },
    config: trainerMod.createTrainerConfig({ learning_rate: 0.5 }),
  });

  assert.equal(result.metrics.step_count, 3);
  assert.deepEqual(result.metrics.step_advantages, [1.25, 1.25, 1]);
  assert.equal(result.metrics.return, 1.25);
  assert.equal(policy.weights['step-1'][5] > 0, true);
  assert.equal(policy.weights['step-2'][6] > 0, true);
  assert.equal(policy.weights['step-3'][8] > 0, true);
});

test('trainer refreshes the frozen reference policy every 100 updates', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const policy = { weights: { feature: [1, 2, 3] } };
  const reference = { weights: { feature: [0, 0, 0] } };

  const refreshed = mod.maybeRefreshReferencePolicy({
    policy,
    referencePolicy: reference,
    updateCount: 100,
    config: mod.createTrainerConfig(),
  });

  assert.notEqual(refreshed, reference);
  assert.deepEqual(refreshed.weights, policy.weights);
});
