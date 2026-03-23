import { validateOrchestratorTask } from './schema.mjs';

const DECISION_ORDER = ['dispatch', 'retry', 'stop', 'handoff', 'preflight'];

function buildTask(decisionType, index) {
  return validateOrchestratorTask({
    task_id: `orch-${decisionType}-${String(index + 1).padStart(3, '0')}`,
    decision_type: decisionType,
    context_snapshot_id: `ctx-${decisionType}-${index + 1}`,
    expected_executor: decisionType === 'dispatch' ? 'local-phase' : 'local-control',
    hard_verification_evidence: [`evidence:${decisionType}:${index + 1}`],
    plan_writing_task: false,
    available_executors: ['local-phase', 'local-control'],
    available_preflight_actions: ['auth-check', 'doctor'],
    context_state: {
      blocker_count: index % 2,
      requiresHuman: decisionType === 'handoff',
    },
  });
}

export function isAdmissibleOrchestratorTask(task) {
  const normalized = validateOrchestratorTask(task);
  if (normalized.plan_writing_task) {
    return false;
  }
  if (normalized.hard_verification_evidence.length === 0) {
    return false;
  }
  return true;
}

export function loadRealOrchestratorTasks({ tasks, countPerType = 5 } = {}) {
  const source = Array.isArray(tasks) && tasks.length > 0
    ? tasks
    : DECISION_ORDER.flatMap((decisionType) => Array.from({ length: countPerType }, (_, index) => buildTask(decisionType, index)));
  return source.map((task) => validateOrchestratorTask(task));
}

export function sampleOrchestratorTask({ seed = 0, attempt = 0, tasks = [] }) {
  const admissible = loadRealOrchestratorTasks({ tasks }).filter(isAdmissibleOrchestratorTask);
  if (admissible.length === 0) {
    return null;
  }
  return admissible[attempt % admissible.length];
}

