import assert from 'node:assert/strict';
import test from 'node:test';

test('rl-core trainer computes advantages from multi-step reward sequences', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const { advantages } = mod.computeAdvantages({ rewards: [0, 0.25, 1] });
  assert.deepEqual(advantages, [1.25, 1.25, 1]);
});

test('rl-core trainer computes total loss with rl, distill, and kl components', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 0.5,
    klLoss: 0.1,
    distillationStatus: 'applied',
  });

  assert.equal(result.totalLoss, 0.6 + 0.2 * 0.5 + 0.01 * 0.1);
});

test('rl-core trainer zeros distillation weight when distillation was skipped', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 99,
    klLoss: 0.1,
    distillationStatus: 'skipped',
  });

  assert.equal(result.distillLossWeight, 0);
});

test('rl-core trainer updates policy from multi-step trajectories', async () => {
  const trainerMod = await import('../lib/rl-core/trainer.mjs');
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

test('rl-core trainer applies contextual bandit updates for orchestrator routing', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const policy = { seed: 21 };
  const referencePolicy = mod.createReferencePolicyFrom(policy);

  const update = mod.applyContextualBanditUpdate({
    policy,
    referencePolicy,
    trajectory: {
      updateType: 'contextual_bandit',
      contextKey: 'orchestrator:dispatch:blockers=0:human=0',
      actions: ['local-phase', 'local-control'],
      selectedAction: 'local-phase',
      reward: 1,
      selectionMode: 'exploit',
    },
    config: mod.createTrainerConfig({
      learning_rate: 0.5,
      contextual_bandit_exploration_rate: 0,
    }),
  });

  assert.equal(update.metrics.bandit_reward, 1);
  assert.equal(policy.contextualBandit.updateCount, 1);
  assert.equal(
    policy.contextualBandit.contexts['orchestrator:dispatch:blockers=0:human=0'].actions['local-phase'].preference
      > policy.contextualBandit.contexts['orchestrator:dispatch:blockers=0:human=0'].actions['local-control'].preference,
    true
  );

  const greedyPick = mod.selectContextualBanditAction({
    policy,
    contextKey: 'orchestrator:dispatch:blockers=0:human=0',
    actions: ['local-phase', 'local-control'],
    config: mod.createTrainerConfig({ contextual_bandit_exploration_rate: 0 }),
    evaluationMode: true,
  });
  assert.equal(greedyPick.selectedAction, 'local-phase');
});

test('rl-core trainer refreshes the frozen reference policy every configured interval', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
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

test('rl-core trainer prefers qualified real-shadow samples in mixed replay batches', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const batch = mod.buildMixedReplayBatch({
    pool: {
      realShadow: {
        episodes: [
          { episode_id: 'real-1', replay_priority: 0.9 },
          { episode_id: 'real-2', replay_priority: 0.8 },
          { episode_id: 'real-3', replay_priority: 0.7 },
        ],
      },
      synthetic: {
        episodes: [
          { episode_id: 'synthetic-1', replay_priority: 0.6 },
          { episode_id: 'synthetic-2', replay_priority: 0.5 },
          { episode_id: 'synthetic-3', replay_priority: 0.4 },
        ],
      },
    },
    batchSize: 5,
  });

  assert.equal(batch.realShadow.length, 3);
  assert.equal(batch.synthetic.length, 2);
});

test('rl-core trainer backs off toward synthetic when real-shadow replay is too duplicated', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const batch = mod.buildMixedReplayBatch({
    pool: {
      realShadow: {
        episodes: [
          { episode_id: 'real-1', replay_priority: 0.9 },
          { episode_id: 'real-1', replay_priority: 0.8 },
          { episode_id: 'real-1', replay_priority: 0.7 },
        ],
      },
      synthetic: {
        episodes: [
          { episode_id: 'synthetic-1', replay_priority: 0.6 },
          { episode_id: 'synthetic-2', replay_priority: 0.5 },
          { episode_id: 'synthetic-3', replay_priority: 0.4 },
          { episode_id: 'synthetic-4', replay_priority: 0.3 },
        ],
      },
    },
    batchSize: 5,
    duplicationBackoffThreshold: 0.5,
  });

  assert.equal(batch.realShadow.length, 1);
  assert.equal(batch.synthetic.length, 4);
});

test('rl-core trainer returns validated online update metadata', async () => {
  const trainerMod = await import('../lib/rl-core/trainer.mjs');
  const policyMod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const schemaMod = await import('../lib/rl-core/schema.mjs');
  const policy = policyMod.createStudentPolicy({ seed: 9 });
  const referencePolicy = trainerMod.createReferencePolicyFrom(policy);

  const result = trainerMod.runOnlineUpdateBatch({
    batchId: 'batch-001',
    checkpointId: 'ckpt-a',
    policy,
    referencePolicy,
    trajectories: [
      {
        stepFeatureKeys: ['step-1'],
        stepTokenIds: [[5]],
        rewards: [1],
        distillationStatus: 'skipped',
        teacherTokenIds: [],
      },
    ],
  });

  schemaMod.validateOnlineUpdateResult({
    status: result.status,
    batch_id: result.batchId,
    checkpoint_id: result.checkpointId,
    next_checkpoint_id: result.nextCheckpointId,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.batchId, 'batch-001');
  assert.equal(result.nextCheckpointId, 'ckpt-a-u1');
});

test('rl-core trainer routes mixed trajectories through applyTrajectoryUpdate', async () => {
  const mod = await import('../lib/rl-core/trainer.mjs');
  const policy = { seed: 5 };
  const referencePolicy = mod.createReferencePolicyFrom(policy);

  const result = mod.runOnlineUpdateBatch({
    batchId: 'batch-bandit-001',
    checkpointId: 'ckpt-bandit-a',
    policy,
    referencePolicy,
    applyUpdate: mod.applyTrajectoryUpdate,
    trajectories: [
      {
        updateType: 'contextual_bandit',
        contextKey: 'orchestrator:dispatch:blockers=0:human=0',
        actions: ['local-phase', 'local-control'],
        selectedAction: 'local-phase',
        reward: 1,
        selectionMode: 'exploit',
      },
    ],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.nextCheckpointId, 'ckpt-bandit-a-u1');
  assert.equal(result.metrics.trajectory_count, 1);
  assert.equal(result.policy.contextualBandit.updateCount, 1);
});

test('rl-core trainer surfaces update failures without mutating checkpoint ids', async () => {
  const trainerMod = await import('../lib/rl-core/trainer.mjs');
  const result = trainerMod.runOnlineUpdateBatch({
    batchId: 'batch-002',
    checkpointId: 'ckpt-a',
    applyUpdate: () => {
      throw new Error('numerical instability');
    },
    trajectories: [],
  });

  assert.equal(result.status, 'update_failed');
  assert.equal(result.batchId, 'batch-002');
  assert.equal(result.checkpointId, 'ckpt-a');
});
