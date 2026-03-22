import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('rl-core campaign controller opens first collection epoch and triggers update after four admitted trajectories', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-campaign-'));
  const result = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 4,
      initialCheckpointId: 'ckpt-a',
    },
    deps: {
      nextEpisode: async ({ taskIndex }) => ({
        episode_id: `episode-${taskIndex + 1}`,
        admission_status: 'admitted',
      }),
      runOnlineUpdateBatch: async ({ checkpointId }) => ({
        status: 'ok',
        checkpointId,
        nextCheckpointId: 'ckpt-b',
      }),
    },
  });

  assert.equal(result.updatesCompleted, 1);
  assert.equal(result.currentEpoch.phase, 'monitoring');
  assert.equal(result.activeCheckpointId, 'ckpt-b');
});

test('rl-core campaign controller reopens monitoring after replay_only without promoting a new batch', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-campaign-'));
  let counter = 0;
  const result = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 8,
      initialCheckpointId: 'ckpt-a',
    },
    deps: {
      nextEpisode: async () => {
        counter += 1;
        if (counter <= 4) {
          return {
            episode_id: `collect-${counter}`,
            admission_status: 'admitted',
          };
        }
        return {
          episode_id: `monitor-${counter}`,
          admission_status: 'admitted',
          comparison_status: counter === 6 ? 'comparison_failed' : 'completed',
          relative_outcome: counter === 6 ? null : 'better',
        };
      },
      runOnlineUpdateBatch: async ({ checkpointId }) => ({
        status: 'ok',
        checkpointId,
        nextCheckpointId: 'ckpt-b',
      }),
    },
  });

  assert.equal(result.updatesCompleted, 1);
  assert.equal(result.replayOnlyEpochs, 1);
  assert.equal(result.currentEpoch.phase, 'monitoring');
  assert.equal(result.activeCheckpointId, 'ckpt-b');
});

test('rl-core campaign controller auto-rolls back after three worse outcomes without an intervening better', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-campaign-'));
  let counter = 0;
  const result = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 7,
      initialCheckpointId: 'ckpt-a',
    },
    deps: {
      nextEpisode: async () => {
        counter += 1;
        if (counter <= 4) {
          return {
            episode_id: `collect-${counter}`,
            admission_status: 'admitted',
          };
        }
        return {
          episode_id: `monitor-${counter}`,
          admission_status: 'admitted',
          comparison_status: 'completed',
          relative_outcome: 'worse',
        };
      },
      runOnlineUpdateBatch: async ({ checkpointId }) => ({
        status: 'ok',
        checkpointId,
        nextCheckpointId: 'ckpt-b',
      }),
    },
  });

  assert.equal(result.rollbacksCompleted, 1);
  assert.equal(result.activeCheckpointId, result.lastStableCheckpointId);
});

test('rl-core campaign controller resumes from persisted control snapshot without reapplying duplicate events', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-campaign-'));
  let counter = 0;
  const deps = {
    nextEpisode: async () => {
      counter += 1;
      if (counter <= 4) {
        return {
          episode_id: `collect-${counter}`,
          admission_status: 'admitted',
        };
      }
      return {
        episode_id: `monitor-${counter}`,
        admission_status: 'admitted',
        comparison_status: 'completed',
        relative_outcome: 'same',
      };
    },
    runOnlineUpdateBatch: async ({ checkpointId }) => ({
      status: 'ok',
      checkpointId,
      nextCheckpointId: 'ckpt-b',
    }),
  };

  const first = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 4,
      initialCheckpointId: 'ckpt-a',
    },
    deps,
  });
  const resumed = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 1,
      initialCheckpointId: 'ckpt-a',
      resume: true,
    },
    deps,
  });

  assert.equal(first.activeCheckpointId, 'ckpt-b');
  assert.equal(resumed.activeCheckpointId, 'ckpt-b');
  assert.equal(resumed.duplicateEventApplications, 0);
});

test('rl-core campaign controller enters frozen_failure mode when rollback fails and blocks further updates', async () => {
  const mod = await import('../lib/rl-core/campaign-controller.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-campaign-'));
  let counter = 0;
  const result = await mod.runOnlineCampaign({
    config: {
      rootDir,
      namespace: 'rl-core-test',
      maxTasks: 10,
      initialCheckpointId: 'ckpt-a',
    },
    deps: {
      nextEpisode: async () => {
        counter += 1;
        if (counter <= 4) {
          return {
            episode_id: `collect-${counter}`,
            admission_status: 'admitted',
          };
        }
        return {
          episode_id: `monitor-${counter}`,
          admission_status: 'admitted',
          comparison_status: 'completed',
          relative_outcome: 'worse',
        };
      },
      runOnlineUpdateBatch: async ({ checkpointId }) => ({
        status: 'ok',
        checkpointId,
        nextCheckpointId: 'ckpt-b',
      }),
      performRollback: async () => {
        throw new Error('restore failed');
      },
    },
  });

  assert.equal(result.controlState.mode, 'frozen_failure');
  assert.equal(result.updatesAfterFreeze, 0);
});
