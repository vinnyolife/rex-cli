import { runContextDbCli } from '../contextdb-cli.mjs';

const CLARITY_GATE_EVENT_KIND = 'orchestration.human-gate';
const MAX_SIGNAL_SAMPLES = 8;
const CLARITY_NEEDS_INPUT_FAILURE_CATEGORY = 'clarity-needs-input';
const SENSITIVE_COMMAND_PATTERNS = Object.freeze([
  { id: 'sudo', label: 'sudo command', pattern: /\bsudo\s+\S+/i },
  { id: 'rm-rf', label: 'rm -rf command', pattern: /\brm\s+-rf\b/i },
  { id: 'chmod', label: 'chmod command', pattern: /\bchmod\s+\S+/i },
  { id: 'chown', label: 'chown command', pattern: /\bchown\s+\S+/i },
  { id: 'ssh', label: 'ssh command', pattern: /\bssh\s+\S+/i },
  { id: 'scp', label: 'scp command', pattern: /\bscp\s+\S+/i },
  { id: 'docker-push', label: 'docker push', pattern: /\bdocker\s+push\b/i },
  { id: 'npm-publish', label: 'npm publish', pattern: /\bnpm\s+publish\b/i },
  { id: 'git-push', label: 'git push', pattern: /\bgit\s+push\b/i },
  { id: 'kubectl-apply', label: 'kubectl apply', pattern: /\bkubectl\s+apply\b/i },
  { id: 'terraform-apply', label: 'terraform apply', pattern: /\bterraform\s+apply\b/i },
  { id: 'aws-cli', label: 'aws cli', pattern: /\baws\s+\S+/i },
  { id: 'gcloud-cli', label: 'gcloud cli', pattern: /\bgcloud\s+\S+/i },
  { id: 'az-cli', label: 'az cli', pattern: /\baz\s+\S+/i },
]);
const BOUNDARY_PATTERNS = Object.freeze([
  { id: 'auth', label: 'auth boundary', pattern: /\b(auth|authentication|authorize|authorization|login|oauth|token|credential|api[- ]?key|session cookie|secret)\b/i },
  { id: 'payment', label: 'payment boundary', pattern: /\b(payment|billing|invoice|charge|refund|payout|stripe|paypal|card)\b/i },
  { id: 'policy', label: 'policy boundary', pattern: /\b(policy|compliance|privacy|legal|regulation|gdpr|hipaa|soc2|pci)\b/i },
]);

function normalizeText(value) {
  return String(value ?? '').trim();
}

function formatTurnStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.(\d{3})Z$/, '$1Z');
}

function normalizeStringArray(raw = []) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const results = [];
  for (const item of raw) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    results.push(text);
  }
  return results;
}

function normalizePositiveInteger(raw, fallback) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function collectFilesTouched(dispatchRun = null) {
  const touched = new Set();
  for (const jobRun of Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []) {
    const files = Array.isArray(jobRun?.output?.payload?.filesTouched) ? jobRun.output.payload.filesTouched : [];
    for (const filePath of files) {
      const normalized = normalizeText(filePath);
      if (normalized) touched.add(normalized);
    }
  }
  return [...touched];
}

function normalizeSnippet(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clipSnippet(value, maxLength = 160) {
  const text = normalizeSnippet(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function collectPayloadSnippets(dispatchRun = null) {
  const snippets = [];
  for (const jobRun of Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []) {
    const payload = jobRun?.output?.payload;
    const candidates = [
      payload?.taskTitle,
      payload?.contextSummary,
      ...(Array.isArray(payload?.findings) ? payload.findings : []),
      ...(Array.isArray(payload?.openQuestions) ? payload.openQuestions : []),
      ...(Array.isArray(payload?.recommendations) ? payload.recommendations : []),
      jobRun?.output?.error,
    ];
    for (const item of candidates) {
      const normalized = normalizeSnippet(item);
      if (normalized) {
        snippets.push(normalized);
      }
    }
  }
  return snippets;
}

function collectBoundarySnippets(dispatchRun = null) {
  const snippets = [];
  for (const jobRun of Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []) {
    const payload = jobRun?.output?.payload;
    const candidates = [
      payload?.taskTitle,
      ...(Array.isArray(payload?.openQuestions) ? payload.openQuestions : []),
      jobRun?.output?.error,
    ];
    for (const item of candidates) {
      const normalized = normalizeSnippet(item);
      if (normalized) {
        snippets.push(normalized);
      }
    }
  }
  return snippets;
}

function collectDispatchTurnIds(dispatchRun = null) {
  return normalizeStringArray(
    (Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []).map((jobRun) => jobRun?.turnId)
  );
}

function collectDispatchWorkItemRefs(dispatchRun = null) {
  const refs = [];
  for (const jobRun of Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []) {
    const items = Array.isArray(jobRun?.workItemRefs) ? jobRun.workItemRefs : [];
    refs.push(...items);
  }
  return normalizeStringArray(refs);
}

function getFailureCategoryCount(learnEvalReport = null, category = '') {
  const target = normalizeText(category).toLowerCase();
  if (!target) {
    return 0;
  }
  const failureTop = Array.isArray(learnEvalReport?.signals?.failures?.top) ? learnEvalReport.signals.failures.top : [];
  for (const item of failureTop) {
    const failureCategory = normalizeText(item?.category).toLowerCase();
    if (failureCategory !== target) {
      continue;
    }
    const count = Number(item?.count);
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  }
  return 0;
}

function resolveBlockedCheckpointMetrics(learnEvalReport = null) {
  const blockedCheckpointsTotal = Number(learnEvalReport?.status?.counts?.blocked || 0);
  const clarityExcludedRaw = getFailureCategoryCount(learnEvalReport, CLARITY_NEEDS_INPUT_FAILURE_CATEGORY);
  const blockedCheckpointsExcluded = Math.max(0, Math.min(blockedCheckpointsTotal, clarityExcludedRaw));
  const blockedCheckpoints = Math.max(0, blockedCheckpointsTotal - blockedCheckpointsExcluded);
  return {
    blockedCheckpoints,
    blockedCheckpointsTotal,
    blockedCheckpointsExcluded,
  };
}

function collectPatternSignals(snippets = [], patterns = []) {
  const signals = [];
  const seen = new Set();
  for (const snippet of snippets) {
    for (const descriptor of patterns) {
      if (!descriptor.pattern.test(snippet)) {
        continue;
      }
      if (seen.has(descriptor.id)) {
        continue;
      }
      seen.add(descriptor.id);
      signals.push({
        id: descriptor.id,
        label: descriptor.label,
        sample: clipSnippet(snippet),
      });
      if (signals.length >= MAX_SIGNAL_SAMPLES) {
        return signals;
      }
    }
  }
  return signals;
}

function isLikelyExternalWritePath(filePath = '') {
  const value = normalizeText(filePath).replace(/\\/g, '/');
  if (!value) return false;
  if (/^[A-Za-z]:\//.test(value)) return true;
  if (value.startsWith('/') || value.startsWith('~')) return true;
  if (value.startsWith('../') || value.includes('/../')) return true;
  return false;
}

function collectExternalWriteSignals(filesTouchedList = []) {
  const signals = [];
  for (const filePath of filesTouchedList) {
    if (!isLikelyExternalWritePath(filePath)) {
      continue;
    }
    signals.push({
      id: 'path-outside-repo',
      label: 'outside-repo write target',
      sample: clipSnippet(filePath),
    });
    if (signals.length >= MAX_SIGNAL_SAMPLES) {
      break;
    }
  }
  return signals;
}

function buildClaritySummary(gate) {
  if (!gate?.needsHuman) {
    return `Clarity gate clear for session ${gate?.sessionId || '(unknown)'}: automation can continue.`;
  }
  return `Clarity gate requires human input for session ${gate.sessionId}: ${gate.reasons.join('; ')}`;
}

function buildNextActions(gate) {
  if (!gate?.needsHuman) {
    return ['Continue automation'];
  }
  return [
    'Review clarity-gate reasons and decide whether to continue automation',
    'If safe, rerun orchestrate live after resolving unclear signals',
    'If risky, perform manual triage and checkpoint findings',
  ];
}

function buildEvidenceText(gate, eventId = '') {
  const parts = [];
  if (eventId) {
    parts.push(`event=${eventId}`);
  }
  parts.push(`needsHuman=${gate.needsHuman ? 'true' : 'false'}`);
  parts.push(`blockedCheckpoints=${gate.metrics.blockedCheckpoints}`);
  parts.push(`blockedCheckpointsTotal=${gate.metrics.blockedCheckpointsTotal}`);
  parts.push(`blockedCheckpointsExcluded=${gate.metrics.blockedCheckpointsExcluded}`);
  parts.push(`conflictingRecommendations=${gate.metrics.conflictingRecommendations ? 'true' : 'false'}`);
  parts.push(`filesTouched=${gate.metrics.filesTouched}`);
  parts.push(`riskSignals=${gate.metrics.riskSignalCount || 0}`);
  parts.push(`sensitiveCommands=${gate.metrics.sensitiveCommandSignals?.length || 0}`);
  parts.push(`externalWrites=${gate.metrics.externalWriteSignals?.length || 0}`);
  parts.push(`boundaries=${gate.metrics.boundaryCrossingSignals?.length || 0}`);
  return parts.join('; ');
}

export function evaluateClarityGate(
  {
    sessionId = '',
    learnEvalReport = null,
    dispatchRun = null,
  } = {},
  {
    blockedCheckpointThreshold = 2,
    maxFilesTouched = 25,
  } = {}
) {
  const blockedThreshold = normalizePositiveInteger(blockedCheckpointThreshold, 2);
  const fileThreshold = normalizePositiveInteger(maxFilesTouched, 25);
  const blockedCheckpointMetrics = resolveBlockedCheckpointMetrics(learnEvalReport);
  const blockedCheckpoints = blockedCheckpointMetrics.blockedCheckpoints;
  const fixRecommendations = Array.isArray(learnEvalReport?.recommendations?.fix) ? learnEvalReport.recommendations.fix.length : 0;
  const promoteRecommendations = Array.isArray(learnEvalReport?.recommendations?.promote) ? learnEvalReport.recommendations.promote.length : 0;
  const conflictingRecommendations = fixRecommendations > 0 && promoteRecommendations > 0;
  const filesTouchedList = collectFilesTouched(dispatchRun);
  const filesTouched = filesTouchedList.length;
  const payloadSnippets = collectPayloadSnippets(dispatchRun);
  const boundarySnippets = collectBoundarySnippets(dispatchRun);
  const sensitiveCommandSignals = collectPatternSignals(payloadSnippets, SENSITIVE_COMMAND_PATTERNS);
  const externalWriteSignals = collectExternalWriteSignals(filesTouchedList);
  const boundaryCrossingSignals = collectPatternSignals(boundarySnippets, BOUNDARY_PATTERNS);
  const dispatchTurnIds = collectDispatchTurnIds(dispatchRun);
  const dispatchWorkItemRefs = collectDispatchWorkItemRefs(dispatchRun);
  const reasons = [];

  if (blockedCheckpoints >= blockedThreshold) {
    const blockedReasonSuffix = blockedCheckpointMetrics.blockedCheckpointsExcluded > 0
      ? ` after excluding clarity checkpoints (${blockedCheckpointMetrics.blockedCheckpointsExcluded})`
      : '';
    reasons.push(`blocked checkpoints (${blockedCheckpoints}) reached threshold (${blockedThreshold})${blockedReasonSuffix}`);
  }
  if (conflictingRecommendations) {
    reasons.push(`learn-eval has conflicting fix (${fixRecommendations}) and promote (${promoteRecommendations}) recommendations`);
  }
  if (filesTouched > fileThreshold) {
    reasons.push(`files touched (${filesTouched}) exceed safety threshold (${fileThreshold})`);
  }
  if (sensitiveCommandSignals.length > 0) {
    reasons.push(`sensitive command signals detected (${sensitiveCommandSignals.length})`);
  }
  if (externalWriteSignals.length > 0) {
    reasons.push(`external write signals detected (${externalWriteSignals.length})`);
  }
  if (boundaryCrossingSignals.length > 0) {
    reasons.push(`auth/payment/policy boundary signals detected (${boundaryCrossingSignals.length})`);
  }

  const needsHuman = reasons.length > 0;
  return {
    sessionId: normalizeText(sessionId),
    needsHuman,
    status: needsHuman ? 'needs-input' : 'clear',
    reasons,
    metrics: {
      blockedCheckpoints,
      blockedCheckpointsTotal: blockedCheckpointMetrics.blockedCheckpointsTotal,
      blockedCheckpointsExcluded: blockedCheckpointMetrics.blockedCheckpointsExcluded,
      conflictingRecommendations,
      fixRecommendations,
      promoteRecommendations,
      filesTouched,
      filesTouchedList,
      blockedCheckpointThreshold: blockedThreshold,
      maxFilesTouched: fileThreshold,
      payloadSnippetCount: payloadSnippets.length,
      boundarySnippetCount: boundarySnippets.length,
      sensitiveCommandSignals,
      externalWriteSignals,
      boundaryCrossingSignals,
      riskSignalCount: sensitiveCommandSignals.length + externalWriteSignals.length + boundaryCrossingSignals.length,
      dispatchTurnIds,
      dispatchWorkItemRefs,
    },
    nextActions: buildNextActions({ needsHuman }),
  };
}

export function persistClarityGateDecision(
  {
    rootDir,
    sessionId,
    gate,
  } = {}
) {
  if (!gate?.needsHuman) {
    return { persisted: false, reason: 'not-required' };
  }
  if (!normalizeText(sessionId)) {
    return { persisted: false, reason: 'session-required' };
  }

  try {
    const summary = buildClaritySummary({ ...gate, sessionId });
    const dispatchTurnIds = normalizeStringArray(gate?.metrics?.dispatchTurnIds);
    const dispatchWorkItemRefs = normalizeStringArray(gate?.metrics?.dispatchWorkItemRefs);
    const turnId = `clarity:${formatTurnStamp()}:summary`;
    const eventArgs = [
      'event:add',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--role',
      'assistant',
      '--kind',
      CLARITY_GATE_EVENT_KIND,
      '--text',
      summary,
      '--turn-id',
      turnId,
      '--turn-type',
      'verification',
      '--environment',
      'orchestrate',
      '--hindsight-status',
      'evaluated',
      '--outcome',
      'ambiguous',
    ];
    if (dispatchTurnIds.length > 0) {
      eventArgs.push('--parent-turn-id', dispatchTurnIds[0]);
    }
    if (dispatchWorkItemRefs.length > 0) {
      eventArgs.push('--work-item-refs', dispatchWorkItemRefs.join(','));
    }
    const event = runContextDbCli(eventArgs);
    const eventId = `${sessionId}#${event.seq}`;
    const checkpoint = runContextDbCli([
      'checkpoint',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--summary',
      summary,
      '--status',
      'blocked',
      '--next',
      gate.nextActions.join('|'),
      '--verify-result',
      'partial',
      '--verify-evidence',
      buildEvidenceText(gate, eventId),
      '--retry-count',
      '0',
      '--elapsed-ms',
      '0',
      '--failure-category',
      'clarity-needs-input',
    ]);

    return {
      persisted: true,
      mode: 'contextdb',
      eventKind: CLARITY_GATE_EVENT_KIND,
      eventId,
      checkpointId: `${sessionId}#C${checkpoint.seq}`,
      checkpointStatus: 'blocked',
    };
  } catch (error) {
    return {
      persisted: false,
      mode: 'contextdb',
      eventKind: CLARITY_GATE_EVENT_KIND,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
