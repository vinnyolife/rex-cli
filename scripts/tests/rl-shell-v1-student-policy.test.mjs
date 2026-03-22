import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('student policy returns deterministic logits and token sampling under a fixed seed', async () => {
  const mod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const policy = mod.createStudentPolicy({ seed: 7 });

  const first = mod.sampleNextToken(policy, {
    contextTokens: ['{', '"action"', ':'],
    featureKey: 'prompt=math|fail=not ok|obs=none',
  });
  const second = mod.sampleNextToken(mod.createStudentPolicy({ seed: 7 }), {
    contextTokens: ['{', '"action"', ':'],
    featureKey: 'prompt=math|fail=not ok|obs=none',
  });

  assert.deepEqual(first, second);
  assert.equal(typeof mod.scoreNextToken(policy, {
    contextTokens: ['{', '"action"', ':'],
    featureKey: 'prompt=math|fail=not ok|obs=none',
  })[0].score, 'number');
});

test('student policy checkpoints round-trip through json files', async () => {
  const mod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const checkpointDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-v1-policy-'));
  const checkpointPath = path.join(checkpointDir, 'policy.json');
  const policy = mod.createStudentPolicy({
    seed: 9,
    weights: {
      'prompt=math|fail=not ok|obs=none': [0, 0, 0, 0, 0, 2],
    },
  });

  await mod.savePolicyCheckpoint(checkpointPath, policy);
  const restored = await mod.loadPolicyCheckpoint(checkpointPath);
  const raw = JSON.parse(await readFile(checkpointPath, 'utf8'));

  assert.equal(raw.seed, 9);
  assert.deepEqual(restored.vocabulary, policy.vocabulary);
  assert.deepEqual(restored.weights, policy.weights);
});

test('student runner emits stop_reason=budget_exhausted when no steps remain', async () => {
  const mod = await import('../lib/rl-shell-v1/student-runner.mjs');
  const result = await mod.requestStudentAction({
    policy: { seed: 1 },
    trace: [],
    budget: { remainingSteps: 0 },
  });

  assert.equal(result.parsedAction, null);
  assert.equal(result.stopReason, 'budget_exhausted');
  assert.deepEqual(result.tokenIds, []);
});

test('student runner builds a bounded step prompt from the latest observation trace', async () => {
  const mod = await import('../lib/rl-shell-v1/student-runner.mjs');
  const prompt = mod.buildStudentStepPrompt({
    trace: [
      {
        task_prompt: 'Fix the math helper in src/math.mjs',
        baseline_failing_tests: ['not ok 1 - addition returns the sum'],
      },
      {
        observation_event: {
          action: { action: 'read', path: 'src/math.mjs' },
          status: 'ok',
          payload: {
            path: 'src/math.mjs',
            content_excerpt: 'return a - b;',
          },
        },
      },
      {
        observation_event: {
          action: { action: 'read', path: 'src/math.mjs' },
          status: 'ok',
          payload: {
            path: 'src/math.mjs',
            content_excerpt: 'return a - b;',
          },
        },
      },
      {
        observation_event: {
          action: { action: 'run', command: 'node --test' },
          status: 'error',
          payload: {
            stderr_excerpt: 'not ok 1 - addition returns the sum',
          },
        },
      },
    ],
    budget: { remainingSteps: 2 },
    maxEvents: 3,
  });

  assert.match(prompt, /Fix the math helper/i);
  assert.match(prompt, /return a - b;/i);
  assert.match(prompt, /x2/i);
  assert.match(prompt, /remaining steps: 2/i);
});

test('student runner emits one valid json action with token ids and logprobs', async () => {
  const policyMod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const runnerMod = await import('../lib/rl-shell-v1/student-runner.mjs');
  const policy = policyMod.createStudentPolicy({ seed: 5 });

  const result = await runnerMod.requestStudentAction({
    policy,
    trace: [
      {
        task_prompt: 'Fix the math helper in src/math.mjs',
        baseline_failing_tests: ['not ok 1 - addition returns the sum'],
      },
    ],
    budget: { remainingSteps: 1 },
  });

  assert.equal(typeof result.rawOutputText, 'string');
  assert.equal(result.rawOutputText.startsWith('{'), true);
  assert.equal(result.tokenIds.length > 0, true);
  assert.equal(result.tokenIds.length, result.tokenLogprobs.length);
  assert.notEqual(result.parsedAction, null);
  assert.equal(typeof result.parsedAction.action, 'string');
  assert.match(result.stopReason, /action_emitted|student_stop/);
});

test('student runner uses latest observation trace when generating the next action', async () => {
  const policyMod = await import('../lib/rl-shell-v1/student-policy.mjs');
  const runnerMod = await import('../lib/rl-shell-v1/student-runner.mjs');

  const initial = await runnerMod.requestStudentAction({
    policy: policyMod.createStudentPolicy({ seed: 5 }),
    trace: [
      {
        task_prompt: 'Fix src/math.mjs',
        baseline_failing_tests: ['not ok 1 - addition returns the sum'],
      },
    ],
    budget: { remainingSteps: 2 },
    evaluationMode: true,
  });

  const next = await runnerMod.requestStudentAction({
    policy: policyMod.createStudentPolicy({ seed: 5 }),
    trace: [
      {
        task_prompt: 'Fix src/math.mjs',
        baseline_failing_tests: ['not ok 1 - addition returns the sum'],
      },
      {
        observation_event: {
          action: { action: 'read', path: 'src/math.mjs' },
          status: 'ok',
          payload: {
            path: 'src/math.mjs',
            content_excerpt: 'return a - b;',
          },
        },
      },
    ],
    budget: { remainingSteps: 2 },
    evaluationMode: true,
  });

  assert.equal(initial.parsedAction.action, 'read');
  assert.equal(next.parsedAction.action, 'run');
  assert.notEqual(next.featureKey, initial.featureKey);
});
