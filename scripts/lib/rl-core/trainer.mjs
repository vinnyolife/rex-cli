function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function computeHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state) {
  let seed = Number(state.rngState || 0) >>> 0;
  if (seed === 0) {
    seed = computeHash('rl-bandit-seed');
  }
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  state.rngState = seed >>> 0;
  return (state.rngState >>> 0) / 0x100000000;
}

function clampNumber(value, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return min;
  }
  return Math.min(max, Math.max(min, normalized));
}

function createEmptyPolicy() {
  return {
    seed: 0,
    vocabulary: [],
    vocabularyIndex: {},
    weights: {},
    updateCount: 0,
    onlineUpdateCount: 0,
  };
}

function ensureWeightVector(policy, featureKey) {
  if (!policy.weights) {
    policy.weights = {};
  }
  if (!Array.isArray(policy.vocabulary)) {
    policy.vocabulary = [];
  }
  if (!policy.vocabularyIndex || typeof policy.vocabularyIndex !== 'object') {
    policy.vocabularyIndex = Object.fromEntries(policy.vocabulary.map((token, index) => [token, index]));
  }
  if (!Array.isArray(policy.weights[featureKey])) {
    policy.weights[featureKey] = new Array(policy.vocabulary.length).fill(0);
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

function normalizeActionSpace(actions = []) {
  const unique = [];
  const seen = new Set();
  for (const action of actions) {
    const normalized = typeof action === 'string' ? action.trim() : '';
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function ensureContextualBanditState(policy) {
  if (!policy.contextualBandit || typeof policy.contextualBandit !== 'object' || Array.isArray(policy.contextualBandit)) {
    policy.contextualBandit = {};
  }
  const bandit = policy.contextualBandit;
  if (!bandit.contexts || typeof bandit.contexts !== 'object' || Array.isArray(bandit.contexts)) {
    bandit.contexts = {};
  }
  if (!Number.isInteger(bandit.updateCount) || bandit.updateCount < 0) {
    bandit.updateCount = 0;
  }
  if (!Number.isInteger(bandit.rngState)) {
    bandit.rngState = computeHash(`bandit:${policy.seed || 0}`);
  }
  return bandit;
}

function ensureBanditContext({ banditState, contextKey, actionSpace }) {
  const normalizedContextKey = typeof contextKey === 'string' && contextKey.trim().length > 0
    ? contextKey.trim()
    : 'default';
  const normalizedActions = normalizeActionSpace(actionSpace);
  if (!banditState.contexts[normalizedContextKey] || typeof banditState.contexts[normalizedContextKey] !== 'object') {
    banditState.contexts[normalizedContextKey] = {
      pull_count: 0,
      reward_sum: 0,
      average_reward: 0,
      actions: {},
    };
  }
  const contextState = banditState.contexts[normalizedContextKey];
  if (!contextState.actions || typeof contextState.actions !== 'object' || Array.isArray(contextState.actions)) {
    contextState.actions = {};
  }
  if (!Number.isInteger(contextState.pull_count) || contextState.pull_count < 0) {
    contextState.pull_count = 0;
  }
  if (!Number.isFinite(contextState.reward_sum)) {
    contextState.reward_sum = 0;
  }
  if (!Number.isFinite(contextState.average_reward)) {
    contextState.average_reward = 0;
  }

  for (const action of normalizedActions) {
    if (!contextState.actions[action] || typeof contextState.actions[action] !== 'object') {
      contextState.actions[action] = {
        preference: 0,
        pull_count: 0,
        reward_sum: 0,
      };
      continue;
    }
    if (!Number.isFinite(contextState.actions[action].preference)) {
      contextState.actions[action].preference = 0;
    }
    if (!Number.isInteger(contextState.actions[action].pull_count) || contextState.actions[action].pull_count < 0) {
      contextState.actions[action].pull_count = 0;
    }
    if (!Number.isFinite(contextState.actions[action].reward_sum)) {
      contextState.actions[action].reward_sum = 0;
    }
  }

  return {
    contextKey: normalizedContextKey,
    actionSpace: normalizedActions,
    contextState,
  };
}

function computeSoftmaxProbabilities(scores, temperature) {
  if (!Array.isArray(scores) || scores.length === 0) {
    return [];
  }
  const normalizedTemperature = Number.isFinite(Number(temperature)) && Number(temperature) > 0
    ? Number(temperature)
    : 1;
  const maxScore = Math.max(...scores);
  const exps = scores.map((score) => Math.exp((Number(score || 0) - maxScore) / normalizedTemperature));
  const total = exps.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return new Array(scores.length).fill(1 / scores.length);
  }
  return exps.map((value) => value / total);
}

function sampleIndexFromProbabilities(probabilities, rngValue) {
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += Number(probabilities[index] || 0);
    if (rngValue <= cumulative || index === probabilities.length - 1) {
      return index;
    }
  }
  return 0;
}

export function selectContextualBanditAction({
  policy,
  contextKey,
  actions = [],
  config = createTrainerConfig(),
  evaluationMode = false,
}) {
  const activePolicy = policy && typeof policy === 'object' ? policy : createEmptyPolicy();
  const banditState = ensureContextualBanditState(activePolicy);
  const ensured = ensureBanditContext({
    banditState,
    contextKey,
    actionSpace: actions,
  });
  if (ensured.actionSpace.length === 0) {
    throw new Error('contextual bandit requires at least one action');
  }
  const scores = ensured.actionSpace.map((action) => Number(ensured.contextState.actions[action]?.preference || 0));
  const probabilities = computeSoftmaxProbabilities(scores, config.contextual_bandit_temperature);

  let selectionMode = 'exploit';
  let selectedIndex = 0;
  if (evaluationMode) {
    selectionMode = 'evaluation';
    selectedIndex = scores.reduce((bestIndex, score, index) => (score > scores[bestIndex] ? index : bestIndex), 0);
  } else {
    const explorationRate = clampNumber(config.contextual_bandit_exploration_rate, 0, 1);
    const explorationRoll = nextRandom(banditState);
    if (explorationRoll < explorationRate) {
      selectionMode = 'explore';
      selectedIndex = Math.min(
        ensured.actionSpace.length - 1,
        Math.floor(nextRandom(banditState) * ensured.actionSpace.length)
      );
    } else {
      selectedIndex = sampleIndexFromProbabilities(probabilities, nextRandom(banditState));
    }
  }

  const actionProbability = Number(probabilities[selectedIndex] || (1 / ensured.actionSpace.length));
  return {
    contextKey: ensured.contextKey,
    actionSpace: ensured.actionSpace,
    selectedAction: ensured.actionSpace[selectedIndex],
    selectedIndex,
    actionProbability,
    actionProbabilities: Object.fromEntries(
      ensured.actionSpace.map((action, index) => [action, Number(probabilities[index] || 0)])
    ),
    selectionMode,
  };
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
    contextual_bandit_exploration_rate: 0.15,
    contextual_bandit_temperature: 1.0,
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

export function applyContextualBanditUpdate({ policy, referencePolicy, trajectory, config = createTrainerConfig() }) {
  const activePolicy = policy && typeof policy === 'object' ? policy : createEmptyPolicy();
  const banditState = ensureContextualBanditState(activePolicy);
  const selectedAction = typeof trajectory?.selectedAction === 'string' && trajectory.selectedAction.trim().length > 0
    ? trajectory.selectedAction.trim()
    : '';
  const candidateActions = normalizeActionSpace([
    ...(Array.isArray(trajectory?.actions) ? trajectory.actions : []),
    ...(selectedAction ? [selectedAction] : []),
  ]);
  const ensured = ensureBanditContext({
    banditState,
    contextKey: trajectory?.contextKey || trajectory?.featureKey || 'default',
    actionSpace: candidateActions,
  });
  if (ensured.actionSpace.length === 0) {
    throw new Error('contextual bandit update requires non-empty actions');
  }

  const resolvedSelectedAction = ensured.actionSpace.includes(selectedAction)
    ? selectedAction
    : ensured.actionSpace[0];
  const selectedIndex = ensured.actionSpace.indexOf(resolvedSelectedAction);
  const preferenceVectorBefore = ensured.actionSpace.map((action) =>
    Number(ensured.contextState.actions[action]?.preference || 0)
  );
  const probabilities = computeSoftmaxProbabilities(preferenceVectorBefore, config.contextual_bandit_temperature);
  const selectedProbability = Number(
    probabilities[selectedIndex >= 0 ? selectedIndex : 0] || (1 / ensured.actionSpace.length)
  );
  const reward = Number(trajectory?.reward ?? trajectory?.fusedReward ?? trajectory?.terminalReward ?? 0);
  const baseline = Number(ensured.contextState.average_reward || 0);
  const advantage = reward - baseline;
  const learningRate = Number(config.learning_rate || 0);

  for (let index = 0; index < ensured.actionSpace.length; index += 1) {
    const action = ensured.actionSpace[index];
    const actionState = ensured.contextState.actions[action];
    const probability = Number(probabilities[index] || 0);
    const gradient = index === selectedIndex ? (1 - probability) : -probability;
    actionState.preference = Number(actionState.preference || 0) + (learningRate * advantage * gradient);
  }

  const selectedState = ensured.contextState.actions[resolvedSelectedAction];
  selectedState.pull_count = Number(selectedState.pull_count || 0) + 1;
  selectedState.reward_sum = Number(selectedState.reward_sum || 0) + reward;

  ensured.contextState.pull_count = Number(ensured.contextState.pull_count || 0) + 1;
  ensured.contextState.reward_sum = Number(ensured.contextState.reward_sum || 0) + reward;
  ensured.contextState.average_reward = ensured.contextState.pull_count === 0
    ? 0
    : ensured.contextState.reward_sum / ensured.contextState.pull_count;

  banditState.updateCount = Number(banditState.updateCount || 0) + 1;
  activePolicy.updateCount = Number(activePolicy.updateCount || 0) + 1;

  const policyVector = ensured.actionSpace.map((action) => Number(ensured.contextState.actions[action]?.preference || 0));
  const referenceVector = ensured.actionSpace.map((action) =>
    Number(referencePolicy?.contextualBandit?.contexts?.[ensured.contextKey]?.actions?.[action]?.preference || 0)
  );
  const klLoss = averageAbsoluteDifference(policyVector, referenceVector);
  const rlLoss = Math.max(0, -advantage);
  const losses = computeLosses({
    rlLoss,
    distillLoss: 0,
    klLoss,
    distillationStatus: 'skipped',
    config,
  });

  return {
    policy: activePolicy,
    metrics: {
      policy_loss: rlLoss,
      distill_loss: 0,
      kl_loss: klLoss,
      total_loss: losses.totalLoss,
      distill_loss_weight: 0,
      advantage,
      return: reward,
      step_count: 1,
      step_advantages: [advantage],
      bandit_context_key: ensured.contextKey,
      bandit_action: resolvedSelectedAction,
      bandit_reward: reward,
      bandit_baseline: baseline,
      bandit_action_probability: selectedProbability,
      bandit_selection_mode: trajectory?.selectionMode || 'unknown',
    },
  };
}

export function applyTrajectoryUpdate({ policy, referencePolicy, trajectory, config = createTrainerConfig() }) {
  if (trajectory?.updateType === 'contextual_bandit') {
    return applyContextualBanditUpdate({
      policy,
      referencePolicy,
      trajectory,
      config,
    });
  }
  return applyPpoUpdate({
    policy,
    referencePolicy,
    trajectory,
    config,
  });
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
  return clone(policy);
}

function summarizeBatchMetrics(metricsRows) {
  if (!Array.isArray(metricsRows) || metricsRows.length === 0) {
    return {
      policy_loss: 0,
      distill_loss: 0,
      kl_loss: 0,
      total_loss: 0,
      trajectory_count: 0,
    };
  }

  const totals = metricsRows.reduce((acc, row) => ({
    policy_loss: acc.policy_loss + Number(row.policy_loss || 0),
    distill_loss: acc.distill_loss + Number(row.distill_loss || 0),
    kl_loss: acc.kl_loss + Number(row.kl_loss || 0),
    total_loss: acc.total_loss + Number(row.total_loss || 0),
  }), {
    policy_loss: 0,
    distill_loss: 0,
    kl_loss: 0,
    total_loss: 0,
  });

  return {
    policy_loss: totals.policy_loss / metricsRows.length,
    distill_loss: totals.distill_loss / metricsRows.length,
    kl_loss: totals.kl_loss / metricsRows.length,
    total_loss: totals.total_loss / metricsRows.length,
    trajectory_count: metricsRows.length,
  };
}

export function runOnlineUpdateBatch({
  batchId,
  checkpointId,
  policy,
  referencePolicy,
  trajectories = [],
  applyUpdate = applyPpoUpdate,
  config = createTrainerConfig(),
}) {
  if (typeof batchId !== 'string' || batchId.trim().length === 0) {
    throw new Error('batchId is required');
  }
  if (typeof checkpointId !== 'string' || checkpointId.trim().length === 0) {
    throw new Error('checkpointId is required');
  }
  const activePolicy = policy && typeof policy === 'object' ? policy : createEmptyPolicy();

  let nextReferencePolicy = referencePolicy || createReferencePolicyFrom(activePolicy);
  const metricsRows = [];
  const injectFallbackTrajectory = applyUpdate !== applyPpoUpdate && applyUpdate !== applyTrajectoryUpdate;
  const trajectoriesToApply = Array.isArray(trajectories) && trajectories.length > 0
    ? trajectories
    : injectFallbackTrajectory
      ? [{}]
      : [];

  try {
    for (const trajectory of trajectoriesToApply) {
      const result = applyUpdate({
        policy: activePolicy,
        referencePolicy: nextReferencePolicy,
        trajectory,
        config,
      });
      metricsRows.push(result.metrics || {});
      nextReferencePolicy = maybeRefreshReferencePolicy({
        policy: activePolicy,
        referencePolicy: nextReferencePolicy,
        updateCount: Number(activePolicy.updateCount || 0),
        config,
      });
    }

    const updateNumber = Number(activePolicy.onlineUpdateCount || 0) + 1;
    activePolicy.onlineUpdateCount = updateNumber;

    return {
      status: 'ok',
      batchId,
      checkpointId,
      nextCheckpointId: `${checkpointId}-u${updateNumber}`,
      policy: activePolicy,
      referencePolicy: nextReferencePolicy,
      metrics: summarizeBatchMetrics(metricsRows),
    };
  } catch (error) {
    return {
      status: 'update_failed',
      batchId,
      checkpointId,
      error: error.message,
    };
  }
}
