import { createDefaultLearnEvalOptions, normalizeLearnEvalFormat } from './options.mjs';
import { buildLearnEvalReport, renderLearnEvalReport } from '../harness/learn-eval.mjs';
import { persistLearnEvalHindsightEvidence } from '../harness/learn-eval-evidence.mjs';

export function normalizeLearnEvalOptions(rawOptions = {}) {
  const defaults = createDefaultLearnEvalOptions();
  const limit = Number.isFinite(rawOptions.limit)
    ? Math.max(1, Math.floor(rawOptions.limit))
    : defaults.limit;

  return {
    sessionId: String(rawOptions.sessionId || '').trim(),
    limit,
    format: normalizeLearnEvalFormat(rawOptions.format ?? defaults.format),
  };
}

export function planLearnEval(rawOptions = {}) {
  const options = normalizeLearnEvalOptions(rawOptions);
  const args = ['learn-eval'];
  if (options.sessionId) {
    args.push('--session', options.sessionId);
  }
  if (options.limit !== 10) {
    args.push('--limit', String(options.limit));
  }
  if (options.format !== 'text') {
    args.push('--format', options.format);
  }
  return {
    command: 'learn-eval',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runLearnEval(
  rawOptions = {},
  { rootDir, io = console, persistHindsightEvidence = persistLearnEvalHindsightEvidence } = {}
) {
  const { options } = planLearnEval(rawOptions);
  const report = await buildLearnEvalReport(options, { rootDir });
  const hindsightEvidence = await persistHindsightEvidence({ rootDir, report });
  if (hindsightEvidence && typeof hindsightEvidence === 'object') {
    report.hindsightEvidence = hindsightEvidence;
  }

  if (options.format === 'json') {
    io.log(JSON.stringify(report, null, 2));
    return { exitCode: 0, report };
  }

  io.log(renderLearnEvalReport(report));
  return { exitCode: 0, report };
}
