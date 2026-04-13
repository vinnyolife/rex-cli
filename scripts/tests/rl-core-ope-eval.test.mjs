import assert from 'node:assert/strict';
import test from 'node:test';

test('rl-core ope eval returns IPS and DR close to logged reward when target matches logging policy', async () => {
  const mod = await import('../lib/rl-core/ope-eval.mjs');
  const events = [
    {
      context_key: 'ctx-a',
      action_space: ['left', 'right'],
      selected_action: 'left',
      reward: 1,
      logging_probability: 0.5,
      logging_action_probabilities: { left: 0.5, right: 0.5 },
    },
    {
      context_key: 'ctx-a',
      action_space: ['left', 'right'],
      selected_action: 'right',
      reward: -1,
      logging_probability: 0.5,
      logging_action_probabilities: { left: 0.5, right: 0.5 },
    },
    {
      context_key: 'ctx-b',
      action_space: ['left', 'right'],
      selected_action: 'left',
      reward: 1,
      logging_probability: 0.6,
      logging_action_probabilities: { left: 0.6, right: 0.4 },
    },
    {
      context_key: 'ctx-b',
      action_space: ['left', 'right'],
      selected_action: 'right',
      reward: 0,
      logging_probability: 0.4,
      logging_action_probabilities: { left: 0.6, right: 0.4 },
    },
  ];

  const result = mod.evaluateContextualBanditOpe({
    events,
    policyDistributionResolver: (event) => event.logging_action_probabilities,
  });

  assert.equal(result.sample_count, 4);
  assert.equal(Number(result.avg_logged_reward.toFixed(3)), 0.25);
  assert.equal(Number(result.ips.toFixed(3)), 0.25);
  assert.equal(Number(result.self_normalized_ips.toFixed(3)), 0.25);
  assert.equal(Number(result.dr.toFixed(3)), 0.3);
});

test('rl-core ope eval reflects higher estimated value for a better target policy', async () => {
  const mod = await import('../lib/rl-core/ope-eval.mjs');
  const events = [];
  for (let index = 0; index < 200; index += 1) {
    const selected = index % 2 === 0 ? 'exec-a' : 'exec-b';
    events.push({
      context_key: 'ctx-routing',
      action_space: ['exec-a', 'exec-b'],
      selected_action: selected,
      reward: selected === 'exec-a' ? 1 : -1,
      logging_probability: 0.5,
      logging_action_probabilities: { 'exec-a': 0.5, 'exec-b': 0.5 },
    });
  }

  const result = mod.evaluateContextualBanditOpe({
    events,
    policyDistributionResolver: () => ({ 'exec-a': 0.9, 'exec-b': 0.1 }),
  });

  assert.equal(result.sample_count, 200);
  assert.equal(Number(result.ips.toFixed(2)), 0.8);
  assert.equal(Number(result.dr.toFixed(2)), 0.8);
  assert.equal(result.self_normalized_ips > 0.6, true);
  assert.equal(result.effective_sample_size > 100, true);
});

test('rl-core policy distribution computes softmax from contextual bandit preferences', async () => {
  const mod = await import('../lib/rl-core/ope-eval.mjs');
  const policy = {
    contextualBandit: {
      contexts: {
        'ctx-routing': {
          actions: {
            'exec-a': { preference: 2 },
            'exec-b': { preference: 0 },
          },
        },
      },
    },
  };

  const distribution = mod.computeContextualBanditPolicyDistribution({
    policy,
    contextKey: 'ctx-routing',
    actionSpace: ['exec-a', 'exec-b'],
    temperature: 1,
  });

  assert.equal(distribution['exec-a'] > distribution['exec-b'], true);
  assert.equal(Number((distribution['exec-a'] + distribution['exec-b']).toFixed(6)), 1);
});
