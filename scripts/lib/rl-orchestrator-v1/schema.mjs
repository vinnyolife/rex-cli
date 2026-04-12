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

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertProbability(value, label) {
  assertNumber(value, label);
  if (value < 0 || value > 1) {
    throw new Error(`${label} must be in [0, 1]`);
  }
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${label} must be an integer >= ${min}`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function assertStringArray(value, label) {
  assertArray(value, label);
  for (const [index, item] of value.entries()) {
    assertString(item, `${label}[${index}]`);
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(allowed).join(', ')}`);
  }
}

const DECISION_TYPES = new Set(['dispatch', 'retry', 'stop', 'handoff', 'preflight']);
const VERIFICATION_RESULTS = new Set(['passed', 'failed', 'partial', 'blocked']);
const TERMINAL_OUTCOMES = new Set(['success', 'partial', 'failed']);
const BANDIT_ALGORITHMS = new Set(['contextual_bandit']);
const BANDIT_SELECTION_MODES = new Set(['exploit', 'explore', 'evaluation']);

export { DECISION_TYPES };

export function validateOrchestratorTask(raw) {
  assertObject(raw, 'orchestrator task');
  assertNoUnknownKeys(
    raw,
    [
      'task_id',
      'decision_type',
      'context_snapshot_id',
      'expected_executor',
      'hard_verification_evidence',
      'plan_writing_task',
      'available_executors',
      'available_preflight_actions',
      'context_state',
      'boundary_hint',
      'forceComparisonFailure',
    ],
    'orchestrator task'
  );
  assertString(raw.task_id, 'orchestrator task.task_id');
  assertEnum(raw.decision_type, DECISION_TYPES, 'orchestrator task.decision_type');
  assertString(raw.context_snapshot_id, 'orchestrator task.context_snapshot_id');
  assertString(raw.expected_executor, 'orchestrator task.expected_executor');
  assertStringArray(raw.hard_verification_evidence || [], 'orchestrator task.hard_verification_evidence');
  assertBoolean(Boolean(raw.plan_writing_task), 'orchestrator task.plan_writing_task');
  assertStringArray(raw.available_executors || [], 'orchestrator task.available_executors');
  assertStringArray(raw.available_preflight_actions || [], 'orchestrator task.available_preflight_actions');
  assertObject(raw.context_state || {}, 'orchestrator task.context_state');
  assertBoolean(Boolean(raw.boundary_hint), 'orchestrator task.boundary_hint');
  assertBoolean(Boolean(raw.forceComparisonFailure), 'orchestrator task.forceComparisonFailure');
  return {
    ...raw,
    hard_verification_evidence: raw.hard_verification_evidence || [],
    plan_writing_task: Boolean(raw.plan_writing_task),
    available_executors: raw.available_executors || [],
    available_preflight_actions: raw.available_preflight_actions || [],
    context_state: raw.context_state || {},
    boundary_hint: Boolean(raw.boundary_hint),
    forceComparisonFailure: Boolean(raw.forceComparisonFailure),
  };
}

export function validateOrchestratorEvidence(raw) {
  assertObject(raw, 'orchestrator evidence');
  assertNoUnknownKeys(
    raw,
    [
      'context_state',
      'decision_type',
      'decision_payload',
      'executor_selected',
      'preflight_selected',
      'verification_result',
      'handoff_triggered',
      'terminal_outcome',
    ],
    'orchestrator evidence'
  );
  assertObject(raw.context_state, 'orchestrator evidence.context_state');
  assertEnum(raw.decision_type, DECISION_TYPES, 'orchestrator evidence.decision_type');
  assertObject(raw.decision_payload, 'orchestrator evidence.decision_payload');
  assertString(raw.executor_selected, 'orchestrator evidence.executor_selected');
  assertBoolean(raw.preflight_selected, 'orchestrator evidence.preflight_selected');
  assertEnum(raw.verification_result, VERIFICATION_RESULTS, 'orchestrator evidence.verification_result');
  assertBoolean(raw.handoff_triggered, 'orchestrator evidence.handoff_triggered');
  assertEnum(raw.terminal_outcome, TERMINAL_OUTCOMES, 'orchestrator evidence.terminal_outcome');
  return raw;
}

export function validateOrchestratorBanditTrace(raw) {
  assertObject(raw, 'orchestrator bandit trace');
  assertNoUnknownKeys(
    raw,
    [
      'algorithm',
      'context_key',
      'action_space',
      'selected_action',
      'action_probability',
      'action_probabilities',
      'selection_mode',
    ],
    'orchestrator bandit trace'
  );
  assertEnum(raw.algorithm, BANDIT_ALGORITHMS, 'orchestrator bandit trace.algorithm');
  assertString(raw.context_key, 'orchestrator bandit trace.context_key');
  assertStringArray(raw.action_space, 'orchestrator bandit trace.action_space');
  if (raw.action_space.length === 0) {
    throw new Error('orchestrator bandit trace.action_space must not be empty');
  }
  assertString(raw.selected_action, 'orchestrator bandit trace.selected_action');
  if (!raw.action_space.includes(raw.selected_action)) {
    throw new Error('orchestrator bandit trace.selected_action must exist in action_space');
  }
  assertProbability(raw.action_probability, 'orchestrator bandit trace.action_probability');
  assertObject(raw.action_probabilities, 'orchestrator bandit trace.action_probabilities');
  for (const action of raw.action_space) {
    assertProbability(raw.action_probabilities[action], `orchestrator bandit trace.action_probabilities.${action}`);
  }
  assertEnum(raw.selection_mode, BANDIT_SELECTION_MODES, 'orchestrator bandit trace.selection_mode');
  return raw;
}

export function validateOrchestratorHoldoutResult(raw) {
  assertObject(raw, 'orchestrator holdout result');
  assertNoUnknownKeys(
    raw,
    ['episode_count', 'decision_success_rate', 'missed_handoff_rate', 'comparison_failed_rate', 'schema_validation_failures'],
    'orchestrator holdout result'
  );
  assertInteger(raw.episode_count, 'orchestrator holdout result.episode_count', { min: 0 });
  assertNumber(raw.decision_success_rate, 'orchestrator holdout result.decision_success_rate');
  assertNumber(raw.missed_handoff_rate, 'orchestrator holdout result.missed_handoff_rate');
  assertNumber(raw.comparison_failed_rate, 'orchestrator holdout result.comparison_failed_rate');
  assertInteger(raw.schema_validation_failures, 'orchestrator holdout result.schema_validation_failures', { min: 0 });
  return raw;
}
