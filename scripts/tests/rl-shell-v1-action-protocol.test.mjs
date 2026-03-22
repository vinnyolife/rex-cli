import assert from 'node:assert/strict';
import test from 'node:test';

test('parseStudentAction accepts read/run/patch/stop and rejects unsupported actions', async () => {
  const mod = await import('../lib/rl-shell-v1/action-protocol.mjs');

  assert.deepEqual(mod.parseStudentAction('{"action":"read","path":"src/math.mjs"}'), {
    action: 'read',
    path: 'src/math.mjs',
  });

  assert.deepEqual(mod.parseStudentAction('{"action":"run","command":"node --test"}'), {
    action: 'run',
    command: 'node --test',
  });

  assert.deepEqual(mod.parseStudentAction('{"action":"patch","diff":"--- a/src/math.mjs\\n+++ b/src/math.mjs\\n"}'), {
    action: 'patch',
    diff: '--- a/src/math.mjs\n+++ b/src/math.mjs\n',
  });

  assert.deepEqual(mod.parseStudentAction('{"action":"stop","message":"done"}'), {
    action: 'stop',
    message: 'done',
  });

  assert.throws(
    () => mod.parseStudentAction('{"action":"delete","path":"src/math.mjs"}'),
    /unsupported action/i
  );
});

test('normalizePatchDiff normalizes line endings and validateStudentAction enforces required fields', async () => {
  const mod = await import('../lib/rl-shell-v1/action-protocol.mjs');

  assert.equal(
    mod.normalizePatchDiff('--- a/src/math.mjs\r\n+++ b/src/math.mjs'),
    '--- a/src/math.mjs\n+++ b/src/math.mjs\n'
  );

  assert.doesNotThrow(() => mod.validateStudentAction({ action: 'patch', diff: '--- a/file\n+++ b/file\n' }));
  assert.throws(() => mod.validateStudentAction({ action: 'run' }), /command/i);
});
