import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createDefaultReleaseStatusOptions,
  normalizeReleaseStatusHistoryFormat,
  normalizeReleaseStatusFormat,
} from './options.mjs';
import {
  loadPolicyReleaseState,
  normalizePolicyReleaseConfig,
} from '../rl-orchestrator-v1/policy-release-gate.mjs';

const HISTORY_TREND_FAILURE_DELTA_WARN = 0.05;
const HISTORY_TREND_FALLBACK_DELTA_WARN = 0.03;
const HISTORY_TREND_FAILURE_DELTA_WARN_ENV = 'AIOS_RELEASE_TREND_WOW_FAILURE_DELTA_WARN';
const HISTORY_TREND_FALLBACK_DELTA_WARN_ENV = 'AIOS_RELEASE_TREND_WOW_FALLBACK_DELTA_WARN';
const HISTORY_TREND_FAILURE_DELTA_WARN_ENV_ALIAS = 'AIOS_RELEASE_WOW_FAILURE_RATE_DELTA_WARN';
const HISTORY_TREND_FALLBACK_DELTA_WARN_ENV_ALIAS = 'AIOS_RELEASE_WOW_FALLBACK_RATE_DELTA_WARN';

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function parsePositiveInteger(value, fallback, flagName) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return fallback;
    }
    throw new Error(`${flagName} must be a positive integer`);
  }
  return Math.floor(parsed);
}

function parseRate(value, fallback, flagName) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${flagName} must be a number between 0 and 1`);
  }
  return parsed;
}

function parseRateEnv(rawValue, fallback, envName) {
  const text = String(rawValue ?? '').trim();
  if (!text) return fallback;
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${envName} must be a number between 0 and 1`);
  }
  return parsed;
}

function toPosixPath(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function formatRate(value, digits = 2) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedRate(value, digits = 2) {
  if (!Number.isFinite(value)) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function normalizeStatePath(statePath, rootDir, fallback) {
  const normalized = normalizeText(statePath);
  if (!normalized) {
    return path.resolve(fallback);
  }
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  return path.resolve(rootDir, normalized);
}

function normalizeOutputPath(outputPath, rootDir) {
  const normalized = normalizeText(outputPath);
  if (!normalized) return '';
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  return path.resolve(rootDir, normalized);
}

function toTrendToken(entry = {}) {
  if (entry.policy_applied !== true) return 'B';
  if (entry.policy_fallback === true) return 'PF';
  if (entry.failed === true) return 'F';
  if (entry.success === true) return 'S';
  return 'P';
}

function buildRecentSummary(entries = []) {
  const summary = {
    total: entries.length,
    policyApplied: 0,
    policyFallback: 0,
    success: 0,
    failed: 0,
    successRate: null,
    failureRate: null,
    fallbackRate: null,
    policyApplyRate: null,
    trend: [],
  };

  for (const entry of entries) {
    if (entry?.policy_applied === true) summary.policyApplied += 1;
    if (entry?.policy_fallback === true) summary.policyFallback += 1;
    if (entry?.success === true) summary.success += 1;
    if (entry?.failed === true) summary.failed += 1;
    summary.trend.push(toTrendToken(entry));
  }

  const outcomes = summary.success + summary.failed;
  if (outcomes > 0) {
    summary.successRate = summary.success / outcomes;
    summary.failureRate = summary.failed / outcomes;
  }
  if (summary.total > 0) {
    summary.fallbackRate = summary.policyFallback / summary.total;
    summary.policyApplyRate = summary.policyApplied / summary.total;
  }

  return summary;
}

function toDayKey(rawTimestamp = '') {
  const normalized = normalizeText(rawTimestamp);
  if (!normalized) return '';
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function shiftDayKey(dayKey = '', offsetDays = 0) {
  const normalized = normalizeText(dayKey);
  if (!normalized) return '';
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return '';
  parsed.setUTCDate(parsed.getUTCDate() + offsetDays);
  return parsed.toISOString().slice(0, 10);
}

function buildDailyHistory(entries = [], historyDays = 14) {
  const dayMap = new Map();
  for (const entry of entries) {
    const day = toDayKey(entry?.timestamp);
    if (!day) continue;

    const current = dayMap.get(day) || {
      date: day,
      samples: 0,
      policyApplied: 0,
      policyFallback: 0,
      success: 0,
      failed: 0,
      successRate: null,
      failureRate: null,
      fallbackRate: null,
      policyApplyRate: null,
    };
    current.samples += 1;
    if (entry?.policy_applied === true) current.policyApplied += 1;
    if (entry?.policy_fallback === true) current.policyFallback += 1;
    if (entry?.success === true) current.success += 1;
    if (entry?.failed === true) current.failed += 1;
    dayMap.set(day, current);
  }

  let days = [...dayMap.values()].sort((left, right) => left.date.localeCompare(right.date));
  if (historyDays > 0 && days.length > historyDays) {
    days = days.slice(-historyDays);
  }

  for (const day of days) {
    const outcomes = day.success + day.failed;
    if (outcomes > 0) {
      day.successRate = day.success / outcomes;
      day.failureRate = day.failed / outcomes;
    }
    if (day.samples > 0) {
      day.fallbackRate = day.policyFallback / day.samples;
      day.policyApplyRate = day.policyApplied / day.samples;
    }
  }

  const dayByDate = new Map(days.map((item) => [item.date, item]));
  for (const day of days) {
    const prevWeek = dayByDate.get(shiftDayKey(day.date, -7));
    day.wowSamplesDelta = prevWeek ? (day.samples - prevWeek.samples) : null;
    day.wowFailureRateDelta = prevWeek && Number.isFinite(day.failureRate) && Number.isFinite(prevWeek.failureRate)
      ? (day.failureRate - prevWeek.failureRate)
      : null;
    day.wowFallbackRateDelta = prevWeek && Number.isFinite(day.fallbackRate) && Number.isFinite(prevWeek.fallbackRate)
      ? (day.fallbackRate - prevWeek.fallbackRate)
      : null;
  }

  return {
    daysRequested: historyDays,
    totalDays: days.length,
    entries: days,
  };
}

function buildHistorySignals({
  historyDaily = {},
  maxFailureRate = 0.2,
  maxFallbackRate = 0.1,
  failureDeltaWarn = HISTORY_TREND_FAILURE_DELTA_WARN,
  fallbackDeltaWarn = HISTORY_TREND_FALLBACK_DELTA_WARN,
} = {}) {
  const entries = Array.isArray(historyDaily.entries) ? historyDaily.entries : [];
  const latest = entries.at(-1) || null;
  const previousWeekDate = latest ? shiftDayKey(latest.date, -7) : '';
  const previousWeek = previousWeekDate
    ? entries.find((item) => item.date === previousWeekDate) || null
    : null;
  const alerts = [];

  if (latest && Number.isFinite(latest.failureRate) && latest.failureRate > maxFailureRate) {
    alerts.push(`latest_failure_rate_exceeded(${latest.failureRate.toFixed(4)}>${maxFailureRate.toFixed(4)})`);
  }
  if (latest && Number.isFinite(latest.fallbackRate) && latest.fallbackRate > maxFallbackRate) {
    alerts.push(`latest_fallback_rate_exceeded(${latest.fallbackRate.toFixed(4)}>${maxFallbackRate.toFixed(4)})`);
  }
  if (latest && Number.isFinite(latest.wowFailureRateDelta) && latest.wowFailureRateDelta > failureDeltaWarn) {
    alerts.push(`wow_failure_rate_delta_exceeded(${latest.wowFailureRateDelta.toFixed(4)}>${failureDeltaWarn.toFixed(4)})`);
  }
  if (latest && Number.isFinite(latest.wowFallbackRateDelta) && latest.wowFallbackRateDelta > fallbackDeltaWarn) {
    alerts.push(`wow_fallback_rate_delta_exceeded(${latest.wowFallbackRateDelta.toFixed(4)}>${fallbackDeltaWarn.toFixed(4)})`);
  }

  return {
    latestDate: latest?.date || null,
    previousWeekDate: previousWeek?.date || null,
    hasAlert: alerts.length > 0,
    alerts,
    thresholds: {
      maxFailureRate,
      maxFallbackRate,
      wowFailureRateDeltaWarn: failureDeltaWarn,
      wowFallbackRateDeltaWarn: fallbackDeltaWarn,
    },
    metrics: {
      latestSamples: latest?.samples ?? null,
      latestFailureRate: Number.isFinite(latest?.failureRate) ? latest.failureRate : null,
      latestFallbackRate: Number.isFinite(latest?.fallbackRate) ? latest.fallbackRate : null,
      wowSamplesDelta: Number.isFinite(latest?.wowSamplesDelta) ? latest.wowSamplesDelta : null,
      wowFailureRateDelta: Number.isFinite(latest?.wowFailureRateDelta) ? latest.wowFailureRateDelta : null,
      wowFallbackRateDelta: Number.isFinite(latest?.wowFallbackRateDelta) ? latest.wowFallbackRateDelta : null,
    },
  };
}

function formatRateValue(value, digits = 6) {
  if (!Number.isFinite(value)) return '';
  return Number(value).toFixed(digits);
}

function renderHistoryCsv(history = {}) {
  const lines = [
    'date,samples,policy_applied,policy_fallback,success,failed,success_rate,failure_rate,fallback_rate,policy_apply_rate,wow_samples_delta,wow_failure_rate_delta,wow_fallback_rate_delta',
  ];
  for (const entry of Array.isArray(history.entries) ? history.entries : []) {
    lines.push([
      entry.date,
      entry.samples,
      entry.policyApplied,
      entry.policyFallback,
      entry.success,
      entry.failed,
      formatRateValue(entry.successRate),
      formatRateValue(entry.failureRate),
      formatRateValue(entry.fallbackRate),
      formatRateValue(entry.policyApplyRate),
      Number.isFinite(entry.wowSamplesDelta) ? String(entry.wowSamplesDelta) : '',
      formatRateValue(entry.wowFailureRateDelta),
      formatRateValue(entry.wowFallbackRateDelta),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

function renderHistoryNdjson(history = {}) {
  const lines = [];
  for (const entry of Array.isArray(history.entries) ? history.entries : []) {
    lines.push(JSON.stringify(entry));
  }
  return `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}

function renderHistoryExport(history = {}, format = 'csv') {
  return format === 'ndjson' ? renderHistoryNdjson(history) : renderHistoryCsv(history);
}

function buildHealthSummary({
  recentWindow = {},
  minSamples = 8,
  maxFailureRate = 0.2,
  maxFallbackRate = 0.1,
} = {}) {
  const reasons = [];
  const sampleCount = Number(recentWindow.total || 0);
  const failureRate = Number.isFinite(recentWindow.failureRate) ? recentWindow.failureRate : null;
  const fallbackRate = Number.isFinite(recentWindow.fallbackRate) ? recentWindow.fallbackRate : null;

  if (sampleCount < minSamples) {
    reasons.push(`insufficient_samples(${sampleCount}/${minSamples})`);
  }
  if (!Number.isFinite(failureRate)) {
    reasons.push('failure_rate_unavailable');
  } else if (failureRate > maxFailureRate) {
    reasons.push(`failure_rate_exceeded(${failureRate.toFixed(4)}>${maxFailureRate.toFixed(4)})`);
  }
  if (!Number.isFinite(fallbackRate)) {
    reasons.push('fallback_rate_unavailable');
  } else if (fallbackRate > maxFallbackRate) {
    reasons.push(`fallback_rate_exceeded(${fallbackRate.toFixed(4)}>${maxFallbackRate.toFixed(4)})`);
  }

  const gatePassed = reasons.length === 0;
  let status = 'healthy';
  if (!gatePassed) {
    const failureSevere = Number.isFinite(failureRate) && failureRate > (maxFailureRate * 1.5);
    const fallbackSevere = Number.isFinite(fallbackRate) && fallbackRate > (maxFallbackRate * 1.5);
    status = (failureSevere || fallbackSevere) ? 'critical' : 'warning';
  }

  return {
    status,
    gatePassed,
    reasons,
    thresholds: {
      minSamples,
      maxFailureRate,
      maxFallbackRate,
    },
    metrics: {
      samples: sampleCount,
      failureRate,
      fallbackRate,
    },
  };
}

function buildFailureResult(error, options, statePath) {
  return {
    ok: false,
    exitCode: 1,
    error: normalizeText(error),
    format: options.format,
    statePath,
    recent: options.recent,
    strict: options.strict === true,
    outputPath: options.outputPath || '',
    historyOutputPath: options.historyOutputPath || '',
    historyFormat: options.historyFormat || 'csv',
    historyDays: options.historyDays || 14,
  };
}

function renderReleaseStatusText(report = {}) {
  if (!report.ok) {
    return [
      'Release gate status: unavailable',
      `- state_path: ${report.statePath || '(unknown)'}`,
      `- error: ${report.error || 'unknown error'}`,
      '',
    ].join('\n');
  }

  const counters = report.counters || {};
  const recentWindow = report.recentWindow || {};
  const health = report.health || {};
  const historySignals = report.historySignals || {};
  const trend = Array.isArray(recentWindow.trend) ? recentWindow.trend.join(' ') : '';

  const lines = [
    'Release gate status',
    `- state_path: ${report.statePath}`,
    `- updated_at: ${report.updatedAt || '(unknown)'}`,
    `- effective_mode: ${report.effectiveMode}`,
    `- effective_rollout_rate: ${Number(report.effectiveRolloutRate || 0).toFixed(4)} (${formatRate(report.effectiveRolloutRate)})`,
    `- counters: total=${counters.total || 0} policy_applied=${counters.policy_applied || 0} baseline_routed=${counters.baseline_routed || 0} policy_fallback=${counters.policy_fallback || 0} policy_success=${counters.policy_success || 0} policy_failure=${counters.policy_failure || 0}`,
    `- transitions: downgrades=${counters.downgrades || 0} promotions=${counters.promotions || 0}`,
    `- streaks: consecutive_policy_success=${counters.consecutive_policy_success || 0} consecutive_policy_failures=${counters.consecutive_policy_failures || 0}`,
    `- reasons: last_downgrade=${report.lastDowngradeReason || '(none)'} last_promotion=${report.lastPromotionReason || '(none)'}`,
    `- recent(${recentWindow.limit || 0}): samples=${recentWindow.total || 0} policy_applied=${recentWindow.policyApplied || 0} fallback=${recentWindow.policyFallback || 0} success=${recentWindow.success || 0} failed=${recentWindow.failed || 0} success_rate=${formatRate(recentWindow.successRate)} failure_rate=${formatRate(recentWindow.failureRate)} fallback_rate=${formatRate(recentWindow.fallbackRate)}`,
    `- health: status=${health.status || 'unknown'} gate_passed=${health.gatePassed === true ? 'yes' : 'no'} strict=${report.strict === true ? 'on' : 'off'}`,
    `- health thresholds: min_samples=${health.thresholds?.minSamples ?? 0} max_failure_rate=${health.thresholds?.maxFailureRate ?? 0} max_fallback_rate=${health.thresholds?.maxFallbackRate ?? 0}`,
    `- history: days=${report.historyDaily?.totalDays ?? 0}/${report.historyDays ?? 0} format=${report.historyFormat || 'csv'} output=${report.historyOutputPath || '(none)'}`,
    `- history trend: latest=${historySignals.latestDate || '(none)'} prev_week=${historySignals.previousWeekDate || '(none)'} wow_failure_delta=${formatSignedRate(historySignals.metrics?.wowFailureRateDelta)} wow_fallback_delta=${formatSignedRate(historySignals.metrics?.wowFallbackRateDelta)} alerts=${historySignals.hasAlert === true ? 'yes' : 'no'}`,
  ];
  if (Array.isArray(health.reasons) && health.reasons.length > 0) {
    lines.push(`- health reasons: ${health.reasons.join(', ')}`);
  }
  if (trend) {
    lines.push(`- trend: ${trend}`);
    lines.push('- trend legend: B=baseline PF=policy_fallback F=policy_failed S=policy_success');
  }
  if (Array.isArray(historySignals.alerts) && historySignals.alerts.length > 0) {
    lines.push(`- history alerts: ${historySignals.alerts.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function normalizeReleaseStatusOptions(rawOptions = {}, { rootDir = process.cwd(), env = process.env } = {}) {
  const defaults = createDefaultReleaseStatusOptions();
  const defaultConfig = normalizePolicyReleaseConfig({ rootDir });
  const statePath = normalizeStatePath(
    rawOptions.statePath ?? defaults.statePath,
    rootDir,
    defaultConfig.state_path
  );
  const format = normalizeReleaseStatusFormat(rawOptions.format ?? defaults.format);
  const recent = parsePositiveInteger(rawOptions.recent, defaults.recent, '--recent');
  const strict = rawOptions.strict === true;
  const minSamples = parsePositiveInteger(rawOptions.minSamples, defaults.minSamples, '--min-samples');
  const maxFailureRate = parseRate(rawOptions.maxFailureRate, defaults.maxFailureRate, '--max-failure-rate');
  const maxFallbackRate = parseRate(rawOptions.maxFallbackRate, defaults.maxFallbackRate, '--max-fallback-rate');
  const wowFailureRateDeltaWarn = rawOptions.wowFailureRateDeltaWarn === undefined
    ? parseRateEnv(
      env?.[HISTORY_TREND_FAILURE_DELTA_WARN_ENV] ?? env?.[HISTORY_TREND_FAILURE_DELTA_WARN_ENV_ALIAS],
      defaults.wowFailureRateDeltaWarn,
      HISTORY_TREND_FAILURE_DELTA_WARN_ENV
    )
    : parseRate(rawOptions.wowFailureRateDeltaWarn, defaults.wowFailureRateDeltaWarn, '--wow-failure-rate-delta-warn');
  const wowFallbackRateDeltaWarn = rawOptions.wowFallbackRateDeltaWarn === undefined
    ? parseRateEnv(
      env?.[HISTORY_TREND_FALLBACK_DELTA_WARN_ENV] ?? env?.[HISTORY_TREND_FALLBACK_DELTA_WARN_ENV_ALIAS],
      defaults.wowFallbackRateDeltaWarn,
      HISTORY_TREND_FALLBACK_DELTA_WARN_ENV
    )
    : parseRate(rawOptions.wowFallbackRateDeltaWarn, defaults.wowFallbackRateDeltaWarn, '--wow-fallback-rate-delta-warn');
  const outputPath = normalizeOutputPath(rawOptions.outputPath ?? defaults.outputPath, rootDir);
  const historyOutputPath = normalizeOutputPath(rawOptions.historyOutputPath ?? defaults.historyOutputPath, rootDir);
  const historyFormat = normalizeReleaseStatusHistoryFormat(rawOptions.historyFormat ?? defaults.historyFormat);
  const historyDays = parsePositiveInteger(rawOptions.historyDays, defaults.historyDays, '--history-days');

  return {
    statePath,
    format,
    recent,
    strict,
    minSamples,
    maxFailureRate,
    maxFallbackRate,
    wowFailureRateDeltaWarn,
    wowFallbackRateDeltaWarn,
    outputPath,
    historyOutputPath,
    historyFormat,
    historyDays,
  };
}

export function planReleaseStatus(rawOptions = {}, { rootDir = process.cwd(), env = process.env } = {}) {
  const options = normalizeReleaseStatusOptions(rawOptions, { rootDir, env });
  const defaultConfig = normalizePolicyReleaseConfig({ rootDir });
  const args = ['release-status'];
  if (path.resolve(options.statePath) !== path.resolve(defaultConfig.state_path)) {
    args.push('--state-path', toPosixPath(path.relative(rootDir, options.statePath) || options.statePath));
  }
  if (options.recent !== 10) {
    args.push('--recent', String(options.recent));
  }
  if (options.format !== 'text') {
    args.push('--format', options.format);
  }
  if (options.strict) {
    args.push('--strict');
  }
  if (options.minSamples !== 8) {
    args.push('--min-samples', String(options.minSamples));
  }
  if (options.maxFailureRate !== 0.2) {
    args.push('--max-failure-rate', String(options.maxFailureRate));
  }
  if (options.maxFallbackRate !== 0.1) {
    args.push('--max-fallback-rate', String(options.maxFallbackRate));
  }
  if (options.outputPath) {
    args.push('--output', toPosixPath(path.relative(rootDir, options.outputPath) || options.outputPath));
  }
  if (options.historyOutputPath) {
    args.push('--history-output', toPosixPath(path.relative(rootDir, options.historyOutputPath) || options.historyOutputPath));
  }
  if (options.historyFormat !== 'csv') {
    args.push('--history-format', options.historyFormat);
  }
  if (options.historyDays !== 14) {
    args.push('--history-days', String(options.historyDays));
  }

  return {
    command: 'release-status',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runReleaseStatus(rawOptions = {}, { rootDir, io = console, env = process.env } = {}) {
  const { options } = planReleaseStatus(rawOptions, { rootDir, env });
  const statePath = toPosixPath(path.relative(rootDir, options.statePath) || options.statePath);
  const outputPath = options.outputPath
    ? toPosixPath(path.relative(rootDir, options.outputPath) || options.outputPath)
    : '';
  const historyOutputPath = options.historyOutputPath
    ? toPosixPath(path.relative(rootDir, options.historyOutputPath) || options.historyOutputPath)
    : '';

  const emitResult = async (result) => {
    const rendered = options.format === 'json'
      ? JSON.stringify(result, null, 2)
      : renderReleaseStatusText(result);
    io.log(rendered);
    if (options.outputPath) {
      await mkdir(path.dirname(options.outputPath), { recursive: true });
      await writeFile(options.outputPath, `${rendered.trimEnd()}\n`, 'utf8');
    }
  };

  const emitHistory = async (history) => {
    if (!options.historyOutputPath) return;
    const rendered = renderHistoryExport(history, options.historyFormat);
    await mkdir(path.dirname(options.historyOutputPath), { recursive: true });
    await writeFile(options.historyOutputPath, rendered, 'utf8');
  };

  try {
    await access(options.statePath);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      const result = {
        ...buildFailureResult(`state file not found: ${statePath}`, options, statePath),
        outputPath,
        historyOutputPath,
      };
      await emitResult(result);
      return result;
    }
    throw error;
  }

  const releaseConfig = normalizePolicyReleaseConfig({
    rootDir,
    policyRelease: {
      mode: 'canary',
      statePath: options.statePath,
    },
  });
  const state = await loadPolicyReleaseState(releaseConfig);
  const recentEntries = Array.isArray(state.recent)
    ? state.recent.slice(-options.recent)
    : [];
  const historyEntries = Array.isArray(state.recent) ? state.recent : [];
  const recentWindow = buildRecentSummary(recentEntries);
  const historyDaily = buildDailyHistory(historyEntries, options.historyDays);
  const historySignals = buildHistorySignals({
    historyDaily,
    maxFailureRate: options.maxFailureRate,
    maxFallbackRate: options.maxFallbackRate,
    failureDeltaWarn: options.wowFailureRateDeltaWarn,
    fallbackDeltaWarn: options.wowFallbackRateDeltaWarn,
  });
  const health = buildHealthSummary({
    recentWindow,
    minSamples: options.minSamples,
    maxFailureRate: options.maxFailureRate,
    maxFallbackRate: options.maxFallbackRate,
  });
  const strictFailed = options.strict && !health.gatePassed;
  const result = {
    ok: true,
    exitCode: strictFailed ? 1 : 0,
    format: options.format,
    statePath,
    outputPath,
    historyOutputPath,
    historyFormat: options.historyFormat,
    historyDays: options.historyDays,
    strict: options.strict,
    updatedAt: state.updated_at || null,
    effectiveMode: state.effective_mode,
    effectiveRolloutRate: Number(state.effective_rollout_rate || 0),
    counters: {
      ...(state.counters || {}),
    },
    lastDowngradeReason: state.last_downgrade_reason || null,
    lastPromotionReason: state.last_promotion_reason || null,
    recentWindow: {
      ...recentWindow,
      limit: options.recent,
    },
    historyDaily,
    historySignals,
    health,
    strictFailed,
    state,
  };

  await emitHistory(historyDaily);
  await emitResult(result);
  return result;
}
