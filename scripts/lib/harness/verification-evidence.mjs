import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runContextDbCli } from '../contextdb-cli.mjs';

export const QUALITY_GATE_VERIFICATION_KIND = 'verification.quality-gate';

function formatArtifactTimestamp(ts = new Date()) {
  return ts.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildArtifactPath(sessionId, stamp) {
  return path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', `quality-gate-${stamp}.json`);
}

function summarizeChecks(results = []) {
  return results.map((item) => `${item.label}:${item.status}`).join(', ');
}

function buildCheckpointSummary(report) {
  const failedChecks = Array.isArray(report.failedChecks)
    ? report.failedChecks
    : Array.isArray(report.results)
      ? report.results.filter((item) => item.status === 'FAIL').map((item) => item.label)
      : [];
  const statusLabel = report.ok ? 'passed' : 'failed';
  const failedSummary = failedChecks.length > 0 ? ` failed=${failedChecks.join(',')}` : '';
  return `Recorded quality-gate ${report.mode} ${statusLabel}; checks=${Array.isArray(report.results) ? report.results.length : 0}.${failedSummary}`;
}

function buildNextActions(report, artifactPath) {
  const failedChecks = Array.isArray(report.failedChecks)
    ? report.failedChecks
    : Array.isArray(report.results)
      ? report.results.filter((item) => item.status === 'FAIL').map((item) => item.label)
      : [];

  if (failedChecks.length === 0) {
    return [
      `Review verification artifact ${artifactPath}`,
      'Continue with the next local orchestration step',
    ];
  }

  return [
    `Inspect failed quality checks (${failedChecks.join(', ')}) in ${artifactPath}`,
    'Address the failing local verification checks before rerunning preflight',
  ];
}

async function writeArtifact(absPath, payload) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function persistQualityGateEvidence({ rootDir, sessionId, report, elapsedMs = 0 } = {}) {
  if (!sessionId) {
    return { persisted: false, reason: 'session-required' };
  }
  if (!report) {
    return { persisted: false, reason: 'report-required' };
  }

  const stamp = formatArtifactTimestamp();
  const artifactPath = buildArtifactPath(sessionId, stamp);
  const artifactAbsPath = path.join(rootDir, artifactPath);
  const artifactPayload = {
    schemaVersion: 1,
    kind: QUALITY_GATE_VERIFICATION_KIND,
    sessionId,
    persistedAt: new Date().toISOString(),
    ok: Boolean(report.ok),
    mode: String(report.mode || 'full'),
    profile: String(report.profile || 'standard'),
    failedChecks: Array.isArray(report.failedChecks) ? report.failedChecks : [],
    failureCategory: report.failureCategory || null,
    results: Array.isArray(report.results) ? report.results : [],
  };

  await writeArtifact(artifactAbsPath, artifactPayload);

  try {
    const checkpointStatus = report.ok ? 'done' : 'blocked';
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
      report.ok ? 'passed' : 'failed',
      '--verify-evidence',
      `mode=${report.mode || 'full'}; profile=${report.profile || 'standard'}; verificationArtifact=${artifactPath}; checks=${summarizeChecks(report.results)}`,
      '--retry-count',
      '0',
      '--elapsed-ms',
      String(Math.max(0, Math.floor(elapsedMs || 0))),
      '--cost-total-tokens',
      '0',
      '--cost-usd',
      '0',
    ];

    if (report.failureCategory) {
      checkpointArgs.push('--failure-category', report.failureCategory);
    }

    const checkpoint = runContextDbCli(checkpointArgs);

    return {
      persisted: true,
      mode: 'contextdb',
      artifactPath,
      checkpointId: `${sessionId}#C${checkpoint.seq}`,
      checkpointStatus,
    };
  } catch (error) {
    return {
      persisted: false,
      mode: 'contextdb',
      artifactPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
