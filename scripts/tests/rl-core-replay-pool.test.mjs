import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('rl-core replay pool keeps synthetic and real-shadow lanes separate', async () => {
  const mod = await import('../lib/rl-core/replay-pool.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-replay-'));
  const pool = await mod.createReplayPool({ rootDir, namespace: 'rl-core-test' });

  await mod.addReplayEpisode({
    pool,
    episode: {
      task_source: 'synthetic',
      replay_eligible: true,
      replay_priority: 0.4,
      episode_id: 'synthetic-1',
    },
  });
  await mod.addReplayEpisode({
    pool,
    episode: {
      task_source: 'real_shadow',
      replay_eligible: true,
      replay_priority: 0.6,
      episode_id: 'real-1',
    },
  });

  assert.equal(pool.synthetic.count, 1);
  assert.equal(pool.realShadow.count, 1);
});

test('rl-core replay pool ignores ineligible and diagnostic-only episodes', async () => {
  const mod = await import('../lib/rl-core/replay-pool.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-replay-'));
  const pool = await mod.createReplayPool({ rootDir, namespace: 'rl-core-test' });

  await mod.addReplayEpisode({
    pool,
    episode: {
      task_source: 'synthetic',
      replay_eligible: false,
      replay_priority: 0.9,
      episode_id: 'skip-1',
    },
  });
  await mod.addReplayEpisode({
    pool,
    episode: {
      task_source: 'real_shadow',
      replay_eligible: true,
      replay_priority: 0.7,
      episode_id: 'diag-1',
      comparison_status: 'comparison_failed',
    },
  });

  assert.equal(pool.synthetic.count, 0);
  assert.equal(pool.realShadow.count, 0);
});

test('rl-core replay pool classifies replay routes from comparison and rollback metadata', async () => {
  const mod = await import('../lib/rl-core/replay-pool.mjs');

  assert.equal(
    mod.classifyReplayRoute({
      comparison_status: 'comparison_failed',
      rollback_batch: false,
      training_admission: false,
    }),
    'diagnostic_only'
  );

  assert.equal(
    mod.classifyReplayRoute({
      comparison_status: 'completed',
      relative_outcome: 'same',
      rollback_batch: false,
      admission_status: 'admitted',
    }),
    'neutral'
  );
});
