import {
  ENVIRONMENTS,
  COMPARISON_STATUSES,
  EPOCH_OUTCOMES,
  HOLDOUT_VALIDATION_STATUSES,
  RELATIVE_OUTCOMES,
  REPLAY_ROUTES,
  TEACHER_TRIGGER_REASONS,
  TEACHER_CALL_STATUSES,
  UPDATE_RESULT_STATUSES,
} from './contracts.mjs';

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNoUnknownKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown key: ${key}`);
    }
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNullableString(value, label) {
  if (value === null) {
    return;
  }
  assertString(value, label);
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${label} must be an integer >= ${min}`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertNumberInRange(value, label, { min, max }) {
  assertNumber(value, label);
  if (value < min || value > max) {
    throw new Error(`${label} must be in [${min}, ${max}]`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(allowed).join(', ')}`);
  }
}

export function validateCheckpointLineage(raw) {
  assertObject(raw, 'checkpoint lineage');
  assertNoUnknownKeys(
    raw,
    ['active_checkpoint_id', 'pre_update_ref_checkpoint_id', 'last_stable_checkpoint_id'],
    'checkpoint lineage'
  );
  assertString(raw.active_checkpoint_id, 'checkpoint lineage.active_checkpoint_id');
  assertNullableString(raw.pre_update_ref_checkpoint_id, 'checkpoint lineage.pre_update_ref_checkpoint_id');
  assertString(raw.last_stable_checkpoint_id, 'checkpoint lineage.last_stable_checkpoint_id');
  return raw;
}

export function validateComparisonResult(raw) {
  assertObject(raw, 'comparison result');
  assertNoUnknownKeys(raw, ['comparison_status', 'relative_outcome'], 'comparison result');
  assertEnum(raw.comparison_status, COMPARISON_STATUSES, 'comparison result.comparison_status');
  if (raw.comparison_status === 'completed') {
    assertEnum(raw.relative_outcome, RELATIVE_OUTCOMES, 'comparison result.relative_outcome');
  } else if (raw.relative_outcome !== null) {
    throw new Error('comparison result.relative_outcome must be null when comparison_status=comparison_failed');
  }
  return raw;
}

export function validateMixedEpisode(raw) {
  assertObject(raw, 'mixed episode');
  assertNoUnknownKeys(
    raw,
    [
      'schema_version',
      'environment',
      'task_family',
      'teacher_triggered',
      'teacher_trigger_reason',
      'boundary_episode',
      'terminal_reward',
      'comparison_status',
      'relative_outcome',
      'replay_route',
      'safety_violation',
      'safety_violation_reason',
    ],
    'mixed episode'
  );
  assertInteger(raw.schema_version, 'mixed episode.schema_version', { min: 1 });
  if (raw.schema_version !== 1) {
    throw new Error('mixed episode.schema_version must equal 1');
  }
  assertEnum(raw.environment, ENVIRONMENTS, 'mixed episode.environment');
  assertString(raw.task_family, 'mixed episode.task_family');
  assertBoolean(raw.teacher_triggered, 'mixed episode.teacher_triggered');
  if (raw.teacher_trigger_reason === null) {
    if (raw.teacher_triggered) {
      throw new Error('mixed episode.teacher_trigger_reason must be set when teacher_triggered=true');
    }
  } else {
    assertEnum(raw.teacher_trigger_reason, TEACHER_TRIGGER_REASONS, 'mixed episode.teacher_trigger_reason');
  }
  assertBoolean(raw.boundary_episode, 'mixed episode.boundary_episode');
  assertNumberInRange(raw.terminal_reward, 'mixed episode.terminal_reward', { min: -1, max: 1 });
  validateComparisonResult({
    comparison_status: raw.comparison_status,
    relative_outcome: raw.relative_outcome,
  });
  assertEnum(raw.replay_route, REPLAY_ROUTES, 'mixed episode.replay_route');
  if (raw.comparison_status === 'comparison_failed' && raw.replay_route !== 'diagnostic_only') {
    throw new Error('mixed episode.replay_route must be diagnostic_only when comparison_status=comparison_failed');
  }
  assertBoolean(raw.safety_violation, 'mixed episode.safety_violation');
  if (raw.safety_violation) {
    assertString(raw.safety_violation_reason, 'mixed episode.safety_violation_reason');
  } else if (raw.safety_violation_reason !== null) {
    throw new Error('mixed episode.safety_violation_reason must be null when safety_violation=false');
  }
  return raw;
}

export function validateHoldoutValidationResult(raw) {
  assertObject(raw, 'holdout validation result');
  assertNoUnknownKeys(raw, ['environment', 'status', 'episode_count', 'metrics'], 'holdout validation result');
  assertEnum(raw.environment, ENVIRONMENTS, 'holdout validation result.environment');
  assertEnum(raw.status, HOLDOUT_VALIDATION_STATUSES, 'holdout validation result.status');
  assertInteger(raw.episode_count, 'holdout validation result.episode_count', { min: 0 });
  assertObject(raw.metrics, 'holdout validation result.metrics');
  for (const [key, value] of Object.entries(raw.metrics)) {
    assertNumber(value, `holdout validation result.metrics.${key}`);
  }
  if (raw.status !== 'not_requested' && raw.episode_count < 1) {
    throw new Error('holdout validation result.episode_count must be >= 1 when status is requested');
  }
  return raw;
}

export function validateMixedBatchSummary(raw) {
  assertObject(raw, 'mixed batch summary');
  assertNoUnknownKeys(
    raw,
    ['batch_id', 'total_episode_count', 'environment_counts', 'comparison_failed_count', 'outcome'],
    'mixed batch summary'
  );
  assertString(raw.batch_id, 'mixed batch summary.batch_id');
  assertInteger(raw.total_episode_count, 'mixed batch summary.total_episode_count', { min: 0 });
  assertObject(raw.environment_counts, 'mixed batch summary.environment_counts');
  for (const environment of Object.keys(raw.environment_counts)) {
    assertEnum(environment, ENVIRONMENTS, 'mixed batch summary.environment_counts key');
    assertInteger(raw.environment_counts[environment], `mixed batch summary.environment_counts.${environment}`, { min: 0 });
  }
  assertInteger(raw.comparison_failed_count, 'mixed batch summary.comparison_failed_count', { min: 0 });
  assertEnum(raw.outcome, EPOCH_OUTCOMES, 'mixed batch summary.outcome');
  return raw;
}

export function validateCampaignTerminalSummary(raw) {
  assertObject(raw, 'campaign terminal summary');
  assertNoUnknownKeys(raw, ['status', 'idle_polls', 'active_environments'], 'campaign terminal summary');
  assertEnum(raw.status, EPOCH_OUTCOMES, 'campaign terminal summary.status');
  assertInteger(raw.idle_polls, 'campaign terminal summary.idle_polls', { min: 0 });
  if (!Array.isArray(raw.active_environments)) {
    throw new Error('campaign terminal summary.active_environments must be an array');
  }
  for (const [index, environment] of raw.active_environments.entries()) {
    assertEnum(environment, ENVIRONMENTS, `campaign terminal summary.active_environments[${index}]`);
  }
  return raw;
}

export function validateReplayCandidate(raw) {
  assertObject(raw, 'replay candidate');
  assertNoUnknownKeys(raw, ['replay_route', 'training_admission'], 'replay candidate');
  assertEnum(raw.replay_route, REPLAY_ROUTES, 'replay candidate.replay_route');
  assertBoolean(raw.training_admission, 'replay candidate.training_admission');
  if (raw.replay_route === 'diagnostic_only' && raw.training_admission) {
    throw new Error('replay candidate.training_admission must be false when replay_route=diagnostic_only');
  }
  return raw;
}

export function validateTeacherResponse(raw) {
  assertObject(raw, 'teacher response');
  assertNoUnknownKeys(
    raw,
    ['backend_used', 'call_status', 'latency_ms', 'critique', 'reference_solution', 'shaping_score', 'confidence'],
    'teacher response'
  );
  assertString(raw.backend_used, 'teacher response.backend_used');
  assertEnum(raw.call_status, TEACHER_CALL_STATUSES, 'teacher response.call_status');
  assertInteger(raw.latency_ms, 'teacher response.latency_ms', { min: 0 });
  assertNullableString(raw.critique, 'teacher response.critique');
  if (raw.reference_solution !== null && typeof raw.reference_solution !== 'string' && !Array.isArray(raw.reference_solution)) {
    throw new Error('teacher response.reference_solution must be a string, array, or null');
  }
  assertNumber(raw.shaping_score, 'teacher response.shaping_score');
  if (raw.shaping_score < -1 || raw.shaping_score > 1) {
    throw new Error('teacher response.shaping_score must be in [-1, 1]');
  }
  assertNumber(raw.confidence, 'teacher response.confidence');
  if (raw.confidence < 0 || raw.confidence > 1) {
    throw new Error('teacher response.confidence must be in [0, 1]');
  }
  return raw;
}

export function validateOnlineUpdateResult(raw) {
  assertObject(raw, 'online update result');
  assertNoUnknownKeys(
    raw,
    ['status', 'batch_id', 'checkpoint_id', 'next_checkpoint_id', 'error'],
    'online update result'
  );
  assertEnum(raw.status, UPDATE_RESULT_STATUSES, 'online update result.status');
  assertString(raw.batch_id, 'online update result.batch_id');
  assertString(raw.checkpoint_id, 'online update result.checkpoint_id');
  if (raw.status === 'ok') {
    assertString(raw.next_checkpoint_id, 'online update result.next_checkpoint_id');
  } else if (raw.next_checkpoint_id !== undefined && raw.next_checkpoint_id !== null) {
    assertString(raw.next_checkpoint_id, 'online update result.next_checkpoint_id');
  }
  if (raw.error !== undefined && raw.error !== null) {
    assertString(raw.error, 'online update result.error');
  }
  return raw;
}
