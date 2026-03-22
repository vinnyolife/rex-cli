import assert from 'node:assert/strict';
import test from 'node:test';

test('rl-core comparison engine normalizes episode comparison results', async () => {
  const mod = await import('../lib/rl-core/comparison-engine.mjs');

  assert.deepEqual(
    mod.normalizeEpisodeComparison({
      episode_id: 'episode-1',
      comparison_status: 'completed',
      relative_outcome: 'better',
    }),
    {
      episode_id: 'episode-1',
      comparison_status: 'completed',
      relative_outcome: 'better',
    }
  );
});

test('rl-core comparison engine tracks degradation streak and ignores comparison_failed rows', async () => {
  const mod = await import('../lib/rl-core/comparison-engine.mjs');

  assert.equal(
    mod.computeDegradationStreak([
      { comparison_status: 'comparison_failed', relative_outcome: null },
      { comparison_status: 'completed', relative_outcome: 'worse' },
      { comparison_status: 'completed', relative_outcome: 'worse' },
      { comparison_status: 'completed', relative_outcome: 'better' },
      { comparison_status: 'completed', relative_outcome: 'worse' },
    ]),
    1
  );
});

test('rl-core comparison engine summarizes comparison counts by outcome', async () => {
  const mod = await import('../lib/rl-core/comparison-engine.mjs');

  assert.deepEqual(
    mod.summarizeComparisonResults([
      { comparison_status: 'comparison_failed', relative_outcome: null },
      { comparison_status: 'completed', relative_outcome: 'better' },
      { comparison_status: 'completed', relative_outcome: 'same' },
      { comparison_status: 'completed', relative_outcome: 'worse' },
    ]),
    {
      comparisonFailedCount: 1,
      betterCount: 1,
      sameCount: 1,
      worseCount: 1,
    }
  );
});
