function clamp(value, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return min;
  }
  return Math.min(max, Math.max(min, normalized));
}

function safeProbability(value, fallback = 0) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return fallback;
  }
  return clamp(normalized, 0, 1);
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

function average(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function variance(values = []) {
  if (!Array.isArray(values) || values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  const sum = values.reduce((acc, value) => {
    const diff = Number(value || 0) - mean;
    return acc + (diff * diff);
  }, 0);
  return sum / (values.length - 1);
}

function normalizeDistribution(actionSpace, raw = null) {
  const actions = normalizeActionSpace(actionSpace);
  if (actions.length === 0) {
    return {};
  }
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const weights = actions.map((action) => safeProbability(source[action], 0));
  const sum = weights.reduce((acc, value) => acc + value, 0);
  if (!Number.isFinite(sum) || sum <= 0) {
    const uniform = 1 / actions.length;
    return Object.fromEntries(actions.map((action) => [action, uniform]));
  }
  return Object.fromEntries(actions.map((action, index) => [action, weights[index] / sum]));
}

function buildQEstimateModel(events = []) {
  const model = {
    global: {
      sum: 0,
      count: 0,
      average: 0,
    },
    contexts: {},
  };

  for (const event of events) {
    const contextKey = typeof event.context_key === 'string' && event.context_key.trim().length > 0
      ? event.context_key.trim()
      : 'default';
    const selectedAction = typeof event.selected_action === 'string' ? event.selected_action.trim() : '';
    if (!selectedAction) {
      continue;
    }
    const reward = Number(event.reward || 0);

    if (!model.contexts[contextKey]) {
      model.contexts[contextKey] = {
        sum: 0,
        count: 0,
        average: 0,
        actions: {},
      };
    }
    const contextState = model.contexts[contextKey];
    if (!contextState.actions[selectedAction]) {
      contextState.actions[selectedAction] = {
        sum: 0,
        count: 0,
        average: 0,
      };
    }

    model.global.sum += reward;
    model.global.count += 1;
    contextState.sum += reward;
    contextState.count += 1;
    contextState.actions[selectedAction].sum += reward;
    contextState.actions[selectedAction].count += 1;
  }

  model.global.average = model.global.count > 0 ? model.global.sum / model.global.count : 0;
  for (const contextKey of Object.keys(model.contexts)) {
    const contextState = model.contexts[contextKey];
    contextState.average = contextState.count > 0 ? contextState.sum / contextState.count : model.global.average;
    for (const action of Object.keys(contextState.actions)) {
      const actionState = contextState.actions[action];
      actionState.average = actionState.count > 0 ? actionState.sum / actionState.count : contextState.average;
    }
  }

  return model;
}

function lookupQEstimate(model, contextKey, action) {
  const normalizedContext = typeof contextKey === 'string' && contextKey.trim().length > 0
    ? contextKey.trim()
    : 'default';
  const normalizedAction = typeof action === 'string' && action.trim().length > 0
    ? action.trim()
    : '';
  const contextState = model.contexts[normalizedContext];
  if (!contextState) {
    return model.global.average;
  }
  if (!normalizedAction) {
    return contextState.average;
  }
  const actionState = contextState.actions[normalizedAction];
  if (!actionState) {
    return contextState.average;
  }
  return actionState.average;
}

function normalizeOpeEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const actionSpace = normalizeActionSpace(raw.action_space);
  if (actionSpace.length === 0) {
    return null;
  }
  const selectedAction = typeof raw.selected_action === 'string' ? raw.selected_action.trim() : '';
  if (!selectedAction || !actionSpace.includes(selectedAction)) {
    return null;
  }
  return {
    context_key: typeof raw.context_key === 'string' && raw.context_key.trim().length > 0
      ? raw.context_key.trim()
      : 'default',
    action_space: actionSpace,
    selected_action: selectedAction,
    reward: Number(raw.reward || 0),
    logging_probability: safeProbability(raw.logging_probability, 0),
    logging_action_probabilities: normalizeDistribution(actionSpace, raw.logging_action_probabilities),
  };
}

function confidenceInterval95(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return [0, 0];
  }
  const mean = average(values);
  const stdErr = Math.sqrt(variance(values) / values.length);
  const margin = 1.96 * stdErr;
  return [mean - margin, mean + margin];
}

export function computeContextualBanditPolicyDistribution({
  policy,
  contextKey,
  actionSpace = [],
  temperature = 1,
} = {}) {
  const actions = normalizeActionSpace(actionSpace);
  if (actions.length === 0) {
    return {};
  }
  const normalizedTemperature = Number.isFinite(Number(temperature)) && Number(temperature) > 0
    ? Number(temperature)
    : 1;
  const contextState = policy?.contextualBandit?.contexts?.[contextKey] || {};
  const scores = actions.map((action) => Number(contextState?.actions?.[action]?.preference || 0));
  const maxScore = Math.max(...scores);
  const exps = scores.map((score) => Math.exp((score - maxScore) / normalizedTemperature));
  const total = exps.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    const uniform = 1 / actions.length;
    return Object.fromEntries(actions.map((action) => [action, uniform]));
  }
  return Object.fromEntries(actions.map((action, index) => [action, exps[index] / total]));
}

export function evaluateContextualBanditOpe({
  events = [],
  policyDistributionResolver = null,
  minLoggingProbability = 1e-4,
  clipWeight = 20,
} = {}) {
  const normalizedEvents = events
    .map((event) => normalizeOpeEvent(event))
    .filter(Boolean);

  if (normalizedEvents.length === 0) {
    return {
      sample_count: 0,
      ips: 0,
      self_normalized_ips: 0,
      dr: 0,
      avg_logged_reward: 0,
      effective_sample_size: 0,
      max_importance_weight: 0,
      clip_weight: clipWeight,
      min_logging_probability: minLoggingProbability,
      ips_ci95: [0, 0],
      dr_ci95: [0, 0],
    };
  }

  const rewardModel = buildQEstimateModel(normalizedEvents);
  const ipsContrib = [];
  const drContrib = [];
  let sumWeights = 0;
  let sumWeightsSquared = 0;
  let weightedRewardSum = 0;
  let maxWeight = 0;

  for (const event of normalizedEvents) {
    const loggingProbability = clamp(
      Number(event.logging_probability || 0),
      Math.max(Number(minLoggingProbability || 1e-4), 1e-9),
      1
    );
    const policyDistribution = typeof policyDistributionResolver === 'function'
      ? normalizeDistribution(event.action_space, policyDistributionResolver(event))
      : event.logging_action_probabilities;
    const targetActionProbability = clamp(
      Number(policyDistribution[event.selected_action] || 0),
      0,
      1
    );
    const reward = Number(event.reward || 0);
    const importanceWeightRaw = targetActionProbability / loggingProbability;
    const importanceWeight = clamp(importanceWeightRaw, 0, Number(clipWeight || 20));
    const ipsRow = importanceWeight * reward;

    const qSelected = lookupQEstimate(rewardModel, event.context_key, event.selected_action);
    const qExpected = event.action_space.reduce((sum, action) => {
      const probability = Number(policyDistribution[action] || 0);
      return sum + (probability * lookupQEstimate(rewardModel, event.context_key, action));
    }, 0);
    const drRow = qExpected + (importanceWeight * (reward - qSelected));

    ipsContrib.push(ipsRow);
    drContrib.push(drRow);
    weightedRewardSum += ipsRow;
    sumWeights += importanceWeight;
    sumWeightsSquared += importanceWeight * importanceWeight;
    maxWeight = Math.max(maxWeight, importanceWeight);
  }

  const ips = average(ipsContrib);
  const snips = sumWeights > 0 ? weightedRewardSum / sumWeights : 0;
  const dr = average(drContrib);
  const effectiveSampleSize = sumWeightsSquared > 0
    ? (sumWeights * sumWeights) / sumWeightsSquared
    : 0;

  return {
    sample_count: normalizedEvents.length,
    ips,
    self_normalized_ips: snips,
    dr,
    avg_logged_reward: average(normalizedEvents.map((event) => Number(event.reward || 0))),
    effective_sample_size: effectiveSampleSize,
    max_importance_weight: maxWeight,
    clip_weight: Number(clipWeight || 20),
    min_logging_probability: Math.max(Number(minLoggingProbability || 1e-4), 1e-9),
    ips_ci95: confidenceInterval95(ipsContrib),
    dr_ci95: confidenceInterval95(drContrib),
  };
}
