import { createStudentPolicy } from './student-policy.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureWeightVector(policy, featureKey) {
  if (!policy.weights) {
    policy.weights = {};
  }
  if (!Array.isArray(policy.weights[featureKey])) {
    policy.weights[featureKey] = new Array(policy.vocabulary.length).fill(0);
  }
  if (!policy.vocabularyIndex) {
    policy.vocabularyIndex = Object.fromEntries(policy.vocabulary.map((token, index) => [token, index]));
  }
  return policy.weights[featureKey];
}

function averageAbsoluteDifference(left, right) {
  const size = Math.max(left.length, right.length);
  if (size === 0) return 0;
  let total = 0;
  for (let index = 0; index < size; index += 1) {
    total += Math.abs(Number(left[index] || 0) - Number(right[index] || 0));
  }
  return total / size;
}

export function createTrainerConfig(overrides = {}) {
  return {
    ppo_clip_epsilon: 0.2,
    distill_loss_weight: 0.2,
    kl_loss_weight: 0.01,
    gamma: 1.0,
    lambda: 1.0,
    learning_rate: 0.05,
    reference_refresh_interval: 100,
    ...overrides,
  };
}

export function computeLosses({ rlLoss, distillLoss, klLoss, distillationStatus, config = createTrainerConfig() }) {
  const distillLossWeight = distillationStatus === 'applied' ? config.distill_loss_weight : 0;
  return {
    distillLossWeight,
    totalLoss: rlLoss + distillLossWeight * distillLoss + config.kl_loss_weight * klLoss,
  };
}

export function computeAdvantages({ rewards, config = createTrainerConfig() }) {
  const sequence = Array.isArray(rewards) ? rewards.map((value) => Number(value || 0)) : [];
  const returns = new Array(sequence.length).fill(0);
  let running = 0;
  for (let index = sequence.length - 1; index >= 0; index -= 1) {
    running = sequence[index] + config.gamma * running;
    returns[index] = running;
  }
  return {
    advantages: [...returns],
    returns,
  };
}

export function applyPpoUpdate({ policy, referencePolicy, trajectory, config = createTrainerConfig() }) {
  const featureKey = trajectory.featureKey || 'default';
  const rewardSequence = Array.isArray(trajectory.rewards) && trajectory.rewards.length > 0
    ? trajectory.rewards.map((value) => Number(value || 0))
    : [Number(trajectory.fusedReward ?? trajectory.reward ?? 0)];
  const { advantages, returns } = computeAdvantages({ rewards: rewardSequence, config });
  const stepFeatureKeys = Array.isArray(trajectory.stepFeatureKeys) && trajectory.stepFeatureKeys.length > 0
    ? trajectory.stepFeatureKeys
    : rewardSequence.map(() => featureKey);
  const stepTokenIds = Array.isArray(trajectory.stepTokenIds) && trajectory.stepTokenIds.length > 0
    ? trajectory.stepTokenIds
    : [Array.isArray(trajectory.tokenIds) ? trajectory.tokenIds : []];
  const tokenIds = Array.isArray(trajectory.tokenIds)
    ? trajectory.tokenIds
    : stepTokenIds.flatMap((tokens) => (Array.isArray(tokens) ? tokens : []));
  const teacherTokenIds = Array.isArray(trajectory.teacherTokenIds) ? trajectory.teacherTokenIds : [];
  const advantage = Number(trajectory.advantage ?? returns[0] ?? rewardSequence[0] ?? 0);

  for (let stepIndex = 0; stepIndex < stepTokenIds.length; stepIndex += 1) {
    const currentFeatureKey = stepFeatureKeys[stepIndex] || featureKey;
    const policyVector = ensureWeightVector(policy, currentFeatureKey);
    const stepAdvantage = Number(advantages[Math.min(stepIndex, advantages.length - 1)] ?? advantage);
    for (const tokenId of stepTokenIds[stepIndex] || []) {
      if (Number.isInteger(tokenId) && tokenId >= 0 && tokenId < policyVector.length) {
        policyVector[tokenId] += config.learning_rate * stepAdvantage;
      }
    }
  }

  if (trajectory.distillationStatus === 'applied') {
    const distillFeatureKey = stepFeatureKeys[stepFeatureKeys.length - 1] || featureKey;
    const policyVector = ensureWeightVector(policy, distillFeatureKey);
    for (const tokenId of teacherTokenIds) {
      if (Number.isInteger(tokenId) && tokenId >= 0 && tokenId < policyVector.length) {
        policyVector[tokenId] += config.learning_rate * config.distill_loss_weight;
      }
    }
  }

  const mismatchCount = teacherTokenIds.length === 0
    ? 0
    : teacherTokenIds.reduce((count, tokenId, index) => count + (tokenIds[index] === tokenId ? 0 : 1), 0);

  const rlLoss = Math.max(0, -advantage);
  const distillLoss = teacherTokenIds.length === 0 ? 0 : mismatchCount / teacherTokenIds.length;
  const referenceVector = ensureWeightVector(referencePolicy, stepFeatureKeys[stepFeatureKeys.length - 1] || featureKey);
  const policyVector = ensureWeightVector(policy, stepFeatureKeys[stepFeatureKeys.length - 1] || featureKey);
  const klLoss = averageAbsoluteDifference(policyVector, referenceVector);
  const losses = computeLosses({
    rlLoss,
    distillLoss,
    klLoss,
    distillationStatus: trajectory.distillationStatus || 'skipped',
    config,
  });

  policy.updateCount = Number(policy.updateCount || 0) + 1;

  return {
    policy,
    metrics: {
      policy_loss: rlLoss,
      distill_loss: distillLoss,
      kl_loss: klLoss,
      total_loss: losses.totalLoss,
      distill_loss_weight: losses.distillLossWeight,
      advantage,
      return: returns[0] ?? advantage,
      step_count: stepTokenIds.length,
      step_advantages: advantages,
    },
  };
}

export function maybeRefreshReferencePolicy({ policy, referencePolicy, updateCount, config = createTrainerConfig() }) {
  if (updateCount > 0 && updateCount % config.reference_refresh_interval === 0) {
    return clone(policy);
  }
  return referencePolicy;
}

export function buildMixedReplayBatch({
  pool,
  batchSize = 5,
  targetRealRatio = 0.6,
  duplicationBackoffThreshold = 0.5,
}) {
  const realEpisodes = Array.isArray(pool?.realShadow?.episodes) ? pool.realShadow.episodes : [];
  const syntheticEpisodes = Array.isArray(pool?.synthetic?.episodes) ? pool.synthetic.episodes : [];
  const desiredReal = Math.min(realEpisodes.length, Math.round(batchSize * targetRealRatio));
  const realUniqueRatio = realEpisodes.length === 0
    ? 1
    : new Set(realEpisodes.map((episode) => episode.episode_id)).size / realEpisodes.length;
  const dedupeReal = realUniqueRatio < duplicationBackoffThreshold;
  const realShadow = [];
  const seenReal = new Set();

  for (const episode of realEpisodes) {
    if (realShadow.length >= desiredReal) {
      break;
    }
    if (dedupeReal && seenReal.has(episode.episode_id)) {
      continue;
    }
    realShadow.push(episode);
    seenReal.add(episode.episode_id);
  }

  const synthetic = syntheticEpisodes.slice(0, Math.max(0, batchSize - realShadow.length));
  return {
    realShadow,
    synthetic,
    effectiveRealRatio: batchSize === 0 ? 0 : realShadow.length / batchSize,
  };
}

export function createReferencePolicyFrom(policy) {
  return createStudentPolicy({
    seed: policy.seed,
    vocabulary: policy.vocabulary,
    weights: clone(policy.weights),
  });
}
