import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runContextDbCli } from '../contextdb-cli.mjs';

export const ORCHESTRATION_DISPATCH_EVENT_KIND = 'orchestration.dispatch-run';

function formatArtifactTimestamp(ts = new Date()) {
  return ts.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildArtifactPath(sessionId, stamp) {
  return path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', `dispatch-run-${stamp}.json`);
}

function buildDispatchHeadline(report) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [], executorRegistry: [] };
  const blockedCount = dispatchRun.jobRuns.filter((jobRun) => jobRun.status === 'blocked').length;
  const executorSummary = dispatchRun.executorRegistry.length > 0
    ? dispatchRun.executorRegistry.join(',')
    : 'none';

  return dispatchRun.ok
    ? `orchestrate dry-run ready: blueprint=${report.blueprint} jobs=${dispatchRun.jobRuns.length} executors=${executorSummary}`
    : `orchestrate dry-run blocked: blueprint=${report.blueprint} jobs=${dispatchRun.jobRuns.length} blocked=${blockedCount} executors=${executorSummary}`;
}

function buildEventText(report, artifactPath) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [] };
  const finalOutputs = Array.isArray(dispatchRun.finalOutputs) ? dispatchRun.finalOutputs.length : 0;
  return [
    buildDispatchHeadline(report),
    `task=${report.taskTitle}`,
    `artifact=${artifactPath}`,
    `finalOutputs=${finalOutputs}`,
  ].join(' | ');
}

function buildCheckpointSummary(report) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [] };
  const blockedCount = dispatchRun.jobRuns.filter((jobRun) => jobRun.status === 'blocked').length;
  const statusLabel = dispatchRun.ok ? 'ready' : 'blocked';
  return `Recorded orchestrate dry-run ${statusLabel} for ${report.taskTitle}; jobs=${dispatchRun.jobRuns.length}; blocked=${blockedCount}.`;
}

function buildNextActions(report, artifactPath) {
  const dispatchRun = report.dispatchRun || { ok: false };
  if (dispatchRun.ok) {
    return [
      `Review dry-run artifact ${artifactPath}`,
      'Attach a real executor runtime when available',
    ];
  }

  return [
    `Inspect blocked handoffs in ${artifactPath}`,
    'Resolve merge-gate conflicts before rerunning orchestration',
  ];
}

async function writeArtifact(absPath, payload) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function persistDispatchEvidence({ rootDir, sessionId, report, elapsedMs } = {}) {
  if (!report?.dispatchRun) {
    return { persisted: false, reason: 'dispatch-run-missing' };
  }

  const mode = String(report.dispatchRun.mode || '').trim() || null;
  if (mode && mode !== 'dry-run') {
    return { persisted: false, reason: 'mode-unsupported', mode };
  }

  if (!sessionId) {
    return { persisted: false, reason: 'session-required', mode: 'contextdb' };
  }

  const stamp = formatArtifactTimestamp();
  const artifactPath = buildArtifactPath(sessionId, stamp);
  const artifactAbsPath = path.join(rootDir, artifactPath);
  const artifactPayload = {
    schemaVersion: 1,
    kind: ORCHESTRATION_DISPATCH_EVENT_KIND,
    sessionId,
    persistedAt: new Date().toISOString(),
    blueprint: report.blueprint,
    taskTitle: report.taskTitle,
    contextSummary: report.contextSummary,
    learnEvalOverlay: report.learnEvalOverlay || null,
    dispatchPlan: report.dispatchPlan || null,
    dispatchRun: report.dispatchRun || null,
  };

  await writeArtifact(artifactAbsPath, artifactPayload);

  try {
    const event = runContextDbCli([
      'event:add',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--role',
      'assistant',
      '--kind',
      ORCHESTRATION_DISPATCH_EVENT_KIND,
      '--text',
      buildEventText(report, artifactPath),
      '--refs',
      artifactPath,
    ]);
    const eventId = `${sessionId}#${event.seq}`;

    const checkpointStatus = report.dispatchRun.ok ? 'running' : 'blocked';
    const checkpointArgs = [
      'checkpoint',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--summary',
      buildCheckpointSummary(report),
      '--status',
      checkpointStatus,
      '--artifacts',
      artifactPath,
      '--next',
      buildNextActions(report, artifactPath).join('|'),
      '--verify-result',
      report.dispatchRun.ok ? 'partial' : 'failed',
      '--verify-evidence',
      `event=${eventId}; artifact=${artifactPath}`,
      '--retry-count',
      '0',
      '--elapsed-ms',
      String(Math.max(0, Math.floor(elapsedMs || 0))),
      '--cost-total-tokens',
      '0',
      '--cost-usd',
      '0',
    ];

    if (!report.dispatchRun.ok) {
      checkpointArgs.push('--failure-category', 'merge-gate-blocked');
    }

    const checkpoint = runContextDbCli(checkpointArgs);
    const checkpointId = `${sessionId}#C${checkpoint.seq}`;
    const evidence = {
      persisted: true,
      mode: 'contextdb',
      artifactPath,
      eventKind: ORCHESTRATION_DISPATCH_EVENT_KIND,
      eventId,
      checkpointId,
      checkpointStatus,
    };

    await writeArtifact(artifactAbsPath, {
      ...artifactPayload,
      dispatchEvidence: evidence,
    });

    return evidence;
  } catch (error) {
    return {
      persisted: false,
      mode: 'contextdb',
      artifactPath,
      eventKind: ORCHESTRATION_DISPATCH_EVENT_KIND,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
