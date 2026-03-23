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

function buildEvidence({ task, score }) {
  const success = score >= 60;
  const partial = !success && score >= 40;
  const handoffTriggered = task.decision_type === 'handoff' ? score >= 50 : false;
  return validateOrchestratorEvidence(compactRlDecisionEvidence({
    context_state: {
      ...task.context_state,
      score,
    },
    decision_type: task.decision_type,
    decision_payload: {
      expected_executor: task.expected_executor,
      score,
    },
    executor_selected: success ? task.expected_executor : task.available_executors[0] || task.expected_executor,
    preflight_selected: task.decision_type === 'preflight' ? score >= 50 : score % 2 === 0,
    verification_result: success ? 'passed' : partial ? 'partial' : 'failed',
    handoff_triggered: handoffTriggered,
    terminal_outcome: success ? 'success' : partial ? 'partial' : 'failed',
  }));
}

export function createCiFixtureOrchestratorHarness(overrides = {}) {
  const harness = {
    calls: [],
    async executeDecision({ task, checkpointId, attempt = 0, mode = 'episode' }) {
      const normalizedTask = validateOrchestratorTask(task);
      harness.calls.push({
        task_id: normalizedTask.task_id,
        checkpointId,
        attempt,
        mode,
      });
      const score = computeHash(`${checkpointId}:${normalizedTask.task_id}:${attempt}:${mode}`) % 100;
      return buildEvidence({ task: normalizedTask, score });
    },
    ...overrides,
  };
  return harness;
}

