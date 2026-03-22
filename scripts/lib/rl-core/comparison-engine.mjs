import { validateComparisonResult } from './schema.mjs';

export function normalizeEpisodeComparison(episode) {
  const normalized = {
    episode_id: episode?.episode_id,
    comparison_status: episode?.comparison_status || 'comparison_failed',
    relative_outcome: episode?.relative_outcome ?? null,
  };
  validateComparisonResult({
    comparison_status: normalized.comparison_status,
    relative_outcome: normalized.relative_outcome,
  });
  return normalized;
}

export function computeDegradationStreak(results = []) {
  let streak = 0;
  for (const result of results) {
    if (result.comparison_status !== 'completed') {
      continue;
    }
    if (result.relative_outcome === 'better') {
      streak = 0;
      continue;
    }
    if (result.relative_outcome === 'worse') {
      streak += 1;
    }
  }
  return streak;
}

export function summarizeComparisonResults(results = []) {
  return results.reduce((summary, result) => {
    if (result.comparison_status === 'comparison_failed') {
      summary.comparisonFailedCount += 1;
    } else if (result.relative_outcome === 'better') {
      summary.betterCount += 1;
    } else if (result.relative_outcome === 'same') {
      summary.sameCount += 1;
    } else if (result.relative_outcome === 'worse') {
      summary.worseCount += 1;
    }
    return summary;
  }, {
    comparisonFailedCount: 0,
    betterCount: 0,
    sameCount: 0,
    worseCount: 0,
  });
}
