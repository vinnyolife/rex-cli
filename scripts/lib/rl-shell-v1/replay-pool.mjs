import {
  addReplayEpisode,
  classifyReplayRoute,
  createReplayPool as createCoreReplayPool,
  loadReplayPool as loadCoreReplayPool,
  sampleReplayBatch,
} from '../rl-core/replay-pool.mjs';

export { addReplayEpisode, classifyReplayRoute, sampleReplayBatch };

export async function createReplayPool({ rootDir }) {
  return createCoreReplayPool({ rootDir, namespace: 'rl-shell-v1' });
}

export async function loadReplayPool({ rootDir }) {
  return loadCoreReplayPool({ rootDir, namespace: 'rl-shell-v1' });
}
