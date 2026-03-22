import { parseStudentAction } from './action-protocol.mjs';
import { sampleNextToken } from './student-policy.mjs';

function summarizeEvent(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }
  if (event.observation_event) {
    const observation = event.observation_event;
    const actionType = observation.action?.action || 'unknown';
    const payload = observation.payload || {};
    if (actionType === 'read') {
      const excerpt = String(payload.content_excerpt || '').replace(/\s+/g, ' ').trim();
      return `read:${observation.status}:path=${payload.path || 'unknown'}:content_excerpt=${excerpt.slice(0, 80) || 'none'}`;
    }
    if (actionType === 'run') {
      const stderr = String(payload.stderr_excerpt || '').replace(/\s+/g, ' ').trim();
      return `run:${observation.status}:stderr=${stderr.slice(0, 80) || 'none'}`;
    }
    if (actionType === 'patch') {
      return `patch:${observation.status}:applied=${payload.applied === true ? 'true' : 'false'}`;
    }
    return `${actionType}:${observation.status}:message=${String(payload.message || '').slice(0, 80)}`;
  }
  if (event.action && event.status) {
    return `${event.action}:${event.status}`;
  }
  if (event.payload && typeof event.payload === 'object') {
    return Object.keys(event.payload).slice(0, 2).join(',');
  }
  return '';
}

function compressTraceEntries(trace) {
  const compressed = [];
  for (const entry of Array.isArray(trace) ? trace : []) {
    const summary = summarizeEvent(entry);
    if (!summary) {
      compressed.push({ summary: '', count: 1, entry });
      continue;
    }
    const last = compressed[compressed.length - 1];
    if (last && last.summary === summary) {
      last.count += 1;
      last.entry = entry;
      continue;
    }
    compressed.push({ summary, count: 1, entry });
  }
  return compressed;
}

export function truncateTraceForPrompt(trace, maxEvents = 12) {
  if (!Array.isArray(trace)) {
    return [];
  }
  return compressTraceEntries(trace).slice(Math.max(0, compressTraceEntries(trace).length - maxEvents));
}

function formatTraceEntry(entry) {
  const summary = entry.summary || summarizeEvent(entry.entry);
  if (!summary) {
    return null;
  }
  if (entry.count > 1) {
    return `${summary} x${entry.count}`;
  }
  return summary;
}

export function buildStudentStepPrompt({ trace, budget, maxEvents = 12 }) {
  const truncatedTrace = truncateTraceForPrompt(trace, maxEvents);
  const promptSource = [...(Array.isArray(trace) ? trace : [])]
    .reverse()
    .find((entry) => entry?.task_prompt || entry?.taskPrompt || entry?.prompt);
  const failSource = [...(Array.isArray(trace) ? trace : [])]
    .reverse()
    .find((entry) => Array.isArray(entry?.baseline_failing_tests) || Array.isArray(entry?.failingTests) || Array.isArray(entry?.tests_after));
  const prompt = promptSource?.task_prompt || promptSource?.taskPrompt || promptSource?.prompt || 'none';
  const failingTests = failSource?.baseline_failing_tests || failSource?.failingTests || failSource?.tests_after || [];
  const remainingSteps = Number(budget?.remainingSteps || 0);

  const lines = [
    `Task: ${String(prompt).slice(0, 240)}`,
    `Failing tests: ${failingTests.join(' | ') || 'none'}`,
    `Remaining steps: ${remainingSteps}`,
    'Recent trace:',
  ];

  for (const entry of truncatedTrace) {
    const formatted = formatTraceEntry(entry);
    if (formatted) {
      lines.push(`- ${formatted}`);
    }
  }

  if (lines[lines.length - 1] === 'Recent trace:') {
    lines.push('- none');
  }

  return lines.join('\n');
}

export function buildStudentFeatureKey({ trace }) {
  const boundedTrace = truncateTraceForPrompt(trace);
  const promptSource = [...trace].reverse().find((entry) => entry?.task_prompt || entry?.taskPrompt || entry?.prompt);
  const failSource = [...trace]
    .reverse()
    .find((entry) => Array.isArray(entry?.baseline_failing_tests) || Array.isArray(entry?.failingTests) || Array.isArray(entry?.tests_after));
  const recentEvents = boundedTrace
    .slice(Math.max(0, boundedTrace.length - 3))
    .map(formatTraceEntry)
    .filter(Boolean)
    .join(',');

  const prompt = promptSource?.task_prompt || promptSource?.taskPrompt || promptSource?.prompt || 'none';
  const failingTests = failSource?.baseline_failing_tests || failSource?.failingTests || failSource?.tests_after || [];

  return `prompt=${String(prompt).slice(0, 120)}|fail=${failingTests.join(';').slice(0, 120) || 'none'}|obs=${recentEvents || 'none'}`;
}

export async function requestStudentAction({ policy, trace, budget, evaluationMode = false }) {
  if (!budget || Number(budget.remainingSteps || 0) <= 0) {
    return {
      promptExcerpt: '',
      rawOutputText: '',
      tokenIds: [],
      tokenLogprobs: [],
      parsedAction: null,
      stopReason: 'budget_exhausted',
    };
  }

  const promptExcerpt = buildStudentStepPrompt({ trace, budget });
  const featureKey = buildStudentFeatureKey({ trace });
  const contextTokens = [];
  const tokenIds = [];
  const tokenLogprobs = [];

  for (let index = 0; index < 16; index += 1) {
    const sampled = sampleNextToken(policy, { contextTokens, featureKey, evaluationMode });
    if (!sampled) {
      break;
    }
    contextTokens.push(sampled.token);
    tokenIds.push(sampled.tokenId);
    tokenLogprobs.push(sampled.logprob);
    if (sampled.token === '}') {
      break;
    }
  }

  const rawOutputText = contextTokens.join('');
  let parsedAction = null;
  let stopReason = 'parse_failed';

  try {
    parsedAction = parseStudentAction(rawOutputText);
    stopReason = parsedAction.action === 'stop' ? 'student_stop' : 'action_emitted';
  } catch {
    parsedAction = null;
  }

  return {
    promptExcerpt,
    rawOutputText,
    tokenIds,
    tokenLogprobs,
    parsedAction,
    stopReason,
    featureKey,
  };
}
