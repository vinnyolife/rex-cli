import { compactRlDecisionEvidence } from '../harness/orchestrator-evidence.mjs';
import { validateOrchestratorEvidence, validateOrchestratorTask } from './schema.mjs';

function computeHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveRequestedExecutor({ task, selectedExecutor }) {
  const normalized = typeof selectedExecutor === 'string' ? selectedExecutor.trim() : '';
  if (!normalized) {
    return null;
  }
  return task.available_executors.includes(normalized) ? normalized : null;
}

function buildEvidence({ task, score, selectedExecutor = null }) {
  const requestedExecutor = resolveRequestedExecutor({ task, selectedExecutor });
  const adjustedScore = requestedExecutor
    ? Math.max(0, Math.min(99, score + (requestedExecutor === task.expected_executor ? 10 : -10)))
    : score;
  const success = adjustedScore >= 60;
  const partial = !success && adjustedScore >= 40;
  const handoffTriggered = task.decision_type === 'handoff' ? adjustedScore >= 50 : false;
  const fallbackExecutor = success ? task.expected_executor : task.available_executors[0] || task.expected_executor;
  const executorSelected = requestedExecutor || fallbackExecutor;
  return validateOrchestratorEvidence(compactRlDecisionEvidence({
    context_state: {
      ...task.context_state,
      score: adjustedScore,
    },
    decision_type: task.decision_type,
    decision_payload: {
      expected_executor: task.expected_executor,
      score: adjustedScore,
      requested_executor: requestedExecutor,
    },
    executor_selected: executorSelected,
    preflight_selected: task.decision_type === 'preflight' ? adjustedScore >= 50 : adjustedScore % 2 === 0,
    verification_result: success ? 'passed' : partial ? 'partial' : 'failed',
    handoff_triggered: handoffTriggered,
    terminal_outcome: success ? 'success' : partial ? 'partial' : 'failed',
  }));
}

export function createCiFixtureOrchestratorHarness(overrides = {}) {
  const harness = {
    calls: [],
    async executeDecision({ task, checkpointId, attempt = 0, mode = 'episode', selectedExecutor = null }) {
      const normalizedTask = validateOrchestratorTask(task);
      const requestedExecutor = resolveRequestedExecutor({
        task: normalizedTask,
        selectedExecutor,
      });
      harness.calls.push({
        task_id: normalizedTask.task_id,
        checkpointId,
        attempt,
        mode,
        requested_executor: requestedExecutor,
      });
      const score = computeHash(`${checkpointId}:${normalizedTask.task_id}:${attempt}:${mode}:${requestedExecutor || ''}`) % 100;
      return buildEvidence({
        task: normalizedTask,
        score,
        selectedExecutor: requestedExecutor,
      });
    },
    ...overrides,
  };
  return harness;
}
