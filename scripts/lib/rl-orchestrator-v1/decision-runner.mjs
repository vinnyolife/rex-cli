import { compactRlDecisionEvidence } from '../harness/orchestrator-evidence.mjs';
import { runOrchestrate } from '../lifecycle/orchestrate.mjs';
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

const DECISION_BLUEPRINT_BY_TYPE = Object.freeze({
  dispatch: 'feature',
  retry: 'bugfix',
  stop: 'refactor',
  handoff: 'security',
  preflight: 'bugfix',
});

function toUniqueStrings(values = []) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function summarizeDispatchRun(dispatchRun = {}) {
  const jobRuns = Array.isArray(dispatchRun.jobRuns) ? dispatchRun.jobRuns : [];
  let blockedCount = 0;
  let completedCount = 0;
  const statuses = [];
  for (const jobRun of jobRuns) {
    const status = String(jobRun?.status || '').trim().toLowerCase();
    if (!status) continue;
    statuses.push(status);
    if (status === 'blocked' || status === 'failed' || status === 'error') {
      blockedCount += 1;
    }
    if (status === 'completed' || status === 'simulated' || status === 'success') {
      completedCount += 1;
    }
  }
  return {
    jobCount: jobRuns.length,
    blockedCount,
    completedCount,
    jobStatuses: toUniqueStrings(statuses),
  };
}

function mapDecisionToBlueprint(decisionType) {
  const normalized = String(decisionType || '').trim().toLowerCase();
  return DECISION_BLUEPRINT_BY_TYPE[normalized] || 'feature';
}

function normalizeExecutionMode(mode = 'dry-run') {
  const normalized = String(mode || 'dry-run').trim().toLowerCase();
  if (normalized !== 'dry-run' && normalized !== 'live') {
    return 'dry-run';
  }
  return normalized;
}

function resolveExecutionModePlan({
  executionMode = 'dry-run',
  fallbackExecutionMode = 'dry-run',
  fallbackOnMissingDispatchRun = true,
} = {}) {
  const primary = normalizeExecutionMode(executionMode);
  if (!fallbackOnMissingDispatchRun) {
    return [primary];
  }
  const fallback = normalizeExecutionMode(fallbackExecutionMode);
  if (fallback === primary) {
    return [primary];
  }
  return [primary, fallback];
}

function buildRealOrchestrateOptions({
  task,
  checkpointId,
  attempt,
  mode,
  dispatchMode = 'local',
  executionMode = 'dry-run',
  sessionId = '',
}) {
  const contextSummary = [
    `checkpoint=${checkpointId}`,
    `decision=${task.decision_type}`,
    `mode=${mode}`,
    `attempt=${attempt}`,
    `snapshot=${task.context_snapshot_id}`,
  ].join(' | ');

  return {
    blueprint: mapDecisionToBlueprint(task.decision_type),
    taskTitle: `RL ${task.task_id}`,
    contextSummary,
    dispatchMode,
    executionMode,
    preflightMode: task.decision_type === 'preflight' ? 'auto' : 'none',
    format: 'json',
    ...(sessionId ? { sessionId } : {}),
  };
}

function createSilentIo() {
  return {
    log() {},
    warn() {},
    error() {},
  };
}

function resolveExecutorSelected({
  task,
  selectedExecutor = null,
  dispatchRun = {},
}) {
  const requestedExecutor = resolveRequestedExecutor({ task, selectedExecutor });
  if (requestedExecutor) {
    return requestedExecutor;
  }
  const runtimeExecutors = toUniqueStrings(dispatchRun.executorRegistry || []);
  return runtimeExecutors[0] || task.expected_executor;
}

function buildRealEvidence({
  task,
  checkpointId,
  attempt,
  mode,
  selectedExecutor = null,
  report = {},
  execution = {},
}) {
  const requestedExecutionMode = normalizeExecutionMode(execution.requestedExecutionMode || 'dry-run');
  const effectiveExecutionMode = normalizeExecutionMode(execution.effectiveExecutionMode || requestedExecutionMode);
  const attemptedExecutionModes = toUniqueStrings(
    Array.isArray(execution.attemptedExecutionModes) ? execution.attemptedExecutionModes : [effectiveExecutionMode]
  );
  const fallbackReason = typeof execution.fallbackReason === 'string' && execution.fallbackReason.trim().length > 0
    ? execution.fallbackReason.trim()
    : null;
  const dispatchRun = report?.dispatchRun && typeof report.dispatchRun === 'object'
    ? report.dispatchRun
    : {};
  const summary = summarizeDispatchRun(dispatchRun);
  const clarityNeedsHuman = report?.clarityGate?.needsHuman === true;
  let terminalOutcome = dispatchRun.ok === true
    ? 'success'
    : summary.completedCount > 0
      ? 'partial'
      : 'failed';
  if (clarityNeedsHuman && terminalOutcome === 'success') {
    terminalOutcome = 'partial';
  }
  const blockedLike = summary.blockedCount > 0 || clarityNeedsHuman;
  const verificationResult = terminalOutcome === 'success'
    ? 'passed'
    : terminalOutcome === 'partial'
      ? (blockedLike ? 'blocked' : 'partial')
      : (blockedLike ? 'blocked' : 'failed');
  const preflightStatuses = Array.isArray(report?.dispatchPreflight?.results)
    ? report.dispatchPreflight.results.map((item) => String(item?.status || 'unknown'))
    : [];
  const preflightSelected = task.decision_type === 'preflight'
    ? preflightStatuses.length > 0 || report?.dispatchPreflight != null
    : preflightStatuses.some((status) => String(status || '').trim().toLowerCase() !== 'skipped');
  const handoffTriggered = task.decision_type === 'handoff'
    ? (dispatchRun.ok !== true || blockedLike)
    : false;
  const executorSelected = resolveExecutorSelected({
    task,
    selectedExecutor,
    dispatchRun,
  });

  return validateOrchestratorEvidence(compactRlDecisionEvidence({
    context_state: {
      ...task.context_state,
      checkpoint_id: checkpointId,
      execution_mode_requested: requestedExecutionMode,
      execution_mode_effective: effectiveExecutionMode,
      execution_modes_attempted: attemptedExecutionModes,
      dispatch_ok: dispatchRun.ok === true,
      blocked_jobs: summary.blockedCount,
      completed_jobs: summary.completedCount,
      job_count: summary.jobCount,
      clarity_needs_human: clarityNeedsHuman,
    },
    decision_type: task.decision_type,
    decision_payload: {
      expected_executor: task.expected_executor,
      requested_executor: resolveRequestedExecutor({ task, selectedExecutor }),
      selected_executor: executorSelected,
      checkpoint_id: checkpointId,
      attempt,
      mode,
      harness_mode: 'real',
      requested_execution_mode: requestedExecutionMode,
      effective_execution_mode: effectiveExecutionMode,
      attempted_execution_modes: attemptedExecutionModes,
      fallback_reason: fallbackReason,
      dispatch_ok: dispatchRun.ok === true,
      dispatch_mode: String(dispatchRun.mode || ''),
      runtime_id: String(dispatchRun?.runtime?.id || ''),
      blocked_jobs: summary.blockedCount,
      completed_jobs: summary.completedCount,
      job_count: summary.jobCount,
      job_statuses: summary.jobStatuses,
      preflight_statuses: preflightStatuses,
    },
    executor_selected: executorSelected,
    preflight_selected: preflightSelected,
    verification_result: verificationResult,
    handoff_triggered: handoffTriggered,
    terminal_outcome: terminalOutcome,
  }));
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

export function createRealOrchestratorHarness({
  rootDir = process.cwd(),
  dispatchMode = 'local',
  executionMode = 'dry-run',
  fallbackExecutionMode = 'dry-run',
  fallbackOnMissingDispatchRun = true,
  sessionId = '',
  io = null,
  env = process.env,
  executeOrchestrate = runOrchestrate,
  fallbackHarness = createCiFixtureOrchestratorHarness(),
  fallbackOnError = true,
} = {}) {
  const resolvedIo = io || createSilentIo();
  const harness = {
    calls: [],
    async executeDecision({ task, checkpointId, attempt = 0, mode = 'episode', selectedExecutor = null }) {
      const normalizedTask = validateOrchestratorTask(task);
      const requestedExecutor = resolveRequestedExecutor({
        task: normalizedTask,
        selectedExecutor,
      });
      const callRecord = {
        task_id: normalizedTask.task_id,
        checkpointId,
        attempt,
        mode,
        requested_executor: requestedExecutor,
        harness_mode: 'real',
        execution_mode_requested: normalizeExecutionMode(executionMode),
        execution_modes_attempted: [],
        execution_mode_effective: null,
        fallback_reason: null,
        fallback_used: false,
      };
      harness.calls.push(callRecord);
      const executionModePlan = resolveExecutionModePlan({
        executionMode,
        fallbackExecutionMode,
        fallbackOnMissingDispatchRun,
      });
      let selectedMode = executionModePlan[0];
      let selectedResult = null;
      let lastError = null;
      let fallbackReason = null;

      for (const currentExecutionMode of executionModePlan) {
        callRecord.execution_modes_attempted.push(currentExecutionMode);
        const options = buildRealOrchestrateOptions({
          task: normalizedTask,
          checkpointId,
          attempt,
          mode,
          dispatchMode,
          executionMode: currentExecutionMode,
          sessionId,
        });

        try {
          const result = await executeOrchestrate(options, {
            rootDir,
            io: resolvedIo,
            env,
          });
          const hasDispatchRun = result?.report?.dispatchRun && typeof result.report.dispatchRun === 'object';
          selectedMode = currentExecutionMode;
          if (hasDispatchRun || currentExecutionMode === executionModePlan[executionModePlan.length - 1]) {
            selectedResult = result;
            break;
          }
          selectedResult = null;
          fallbackReason = `missing dispatchRun in ${currentExecutionMode}`;
        } catch (error) {
          lastError = error;
          if (currentExecutionMode !== executionModePlan[executionModePlan.length - 1]) {
            fallbackReason = `execute failed in ${currentExecutionMode}: ${error?.message || String(error)}`;
            continue;
          }
        }
      }

      try {
        if (!selectedResult && lastError) {
          throw lastError;
        }
        const evidence = buildRealEvidence({
          task: normalizedTask,
          checkpointId,
          attempt,
          mode,
          selectedExecutor: requestedExecutor,
          report: selectedResult?.report || {},
          execution: {
            requestedExecutionMode: callRecord.execution_mode_requested,
            effectiveExecutionMode: selectedMode,
            attemptedExecutionModes: callRecord.execution_modes_attempted,
            fallbackReason,
          },
        });
        callRecord.execution_mode_effective = selectedMode;
        callRecord.fallback_reason = fallbackReason;
        callRecord.dispatch_ok = evidence.decision_payload?.dispatch_ok === true;
        callRecord.runtime_id = String(evidence.decision_payload?.runtime_id || '');
        return evidence;
      } catch (error) {
        callRecord.error = error?.message || String(error);
        if (!fallbackOnError || !fallbackHarness || typeof fallbackHarness.executeDecision !== 'function') {
          throw error;
        }
        callRecord.fallback_used = true;
        const fallbackEvidence = await fallbackHarness.executeDecision({
          task: normalizedTask,
          checkpointId,
          attempt,
          mode,
          selectedExecutor: requestedExecutor,
        });
        const normalizedFallback = validateOrchestratorEvidence(fallbackEvidence);
        return validateOrchestratorEvidence(compactRlDecisionEvidence({
          ...normalizedFallback,
          context_state: {
            ...normalizedFallback.context_state,
            fallback_used: true,
            real_harness_error: callRecord.error,
          },
          decision_payload: {
            ...normalizedFallback.decision_payload,
            harness_mode: 'real',
            requested_execution_mode: callRecord.execution_mode_requested,
            effective_execution_mode: 'fixture',
            attempted_execution_modes: callRecord.execution_modes_attempted,
            fallback_reason: fallbackReason || callRecord.error,
            fallback_used: true,
            fallback_error: callRecord.error,
          },
        }));
      }
    },
  };
  return harness;
}
