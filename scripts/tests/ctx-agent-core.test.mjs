import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildWorkspaceMemoryOverlay,
  classifyOneShotFailure,
  isBetterSqlite3AbiMismatch,
  shouldAutoRebuildNative,
} from '../ctx-agent-core.mjs';
import { runContextDbCli } from '../lib/contextdb-cli.mjs';

async function createFakeCliCommand(commandName, marker) {
  const binDir = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-bin-'));
  const markerLiteral = JSON.stringify(marker);

  if (process.platform === 'win32') {
    const script = path.join(binDir, `${commandName}-fake.mjs`);
    await writeFile(
      script,
      `process.stdout.write(JSON.stringify({ marker: ${markerLiteral}, argv: process.argv.slice(2) }) + "\\n");\n`,
      'utf8'
    );
    const shim = path.join(binDir, `${commandName}.cmd`);
    await writeFile(shim, `@echo off\r\nnode "${script}" %*\r\n`, 'utf8');
    return binDir;
  }

  const file = path.join(binDir, commandName);
  await writeFile(
    file,
    `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ marker: ${markerLiteral}, argv: process.argv.slice(2) }) + "\\n");\n`,
    'utf8'
  );
  await chmod(file, 0o755);
  return binDir;
}

async function createFakeCodexCommand(marker = 'FAKE_CODEX_OK') {
  return createFakeCliCommand('codex', marker);
}

async function createFakeClaudeCommand(marker = 'FAKE_CLAUDE_OK') {
  return createFakeCliCommand('claude', marker);
}

async function createFakeOpenCodeCommand(marker = 'FAKE_OPENCODE_OK') {
  return createFakeCliCommand('opencode', marker);
}

function parseLastJsonPayload(stdout) {
  const line = String(stdout || '').trim().split(/\r?\n/).at(-1) || '{}';
  return JSON.parse(line);
}

test('detects better-sqlite3 Node ABI mismatch errors', () => {
  const detail = [
    'contextdb init failed: dlopen(/tmp/better_sqlite3.node, 0x0001):',
    'The module was compiled against a different Node.js version using',
    'NODE_MODULE_VERSION 115.',
    'This version of Node.js requires NODE_MODULE_VERSION 127.',
  ].join('\n');

  assert.equal(isBetterSqlite3AbiMismatch(detail), true);
});

test('does not treat unrelated native addon errors as better-sqlite3 ABI mismatch', () => {
  const detail = 'Error: Cannot find module "playwright"';
  assert.equal(isBetterSqlite3AbiMismatch(detail), false);
});

test('auto-rebuild env defaults to enabled', () => {
  assert.equal(shouldAutoRebuildNative({}), true);
});

test('auto-rebuild env accepts explicit off values', () => {
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: '0' }), false);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'false' }), false);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'off' }), false);
});

test('auto-rebuild env accepts explicit on values', () => {
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: '1' }), true);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'true' }), true);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'on' }), true);
});

test('classifyOneShotFailure recognizes timeout-like failures', () => {
  assert.equal(classifyOneShotFailure('Request timed out after 30s'), 'timeout');
});

test('classifyOneShotFailure falls back to tool for generic failures', () => {
  assert.equal(classifyOneShotFailure('Unhandled exit=1'), 'tool');
});

test('buildWorkspaceMemoryOverlay reads pinned and recent memos', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-workspace-memory-'));

  try {
    const sessionId = 'workspace-memory--acc-1';
    const sessionRoot = path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId);
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(path.join(sessionRoot, 'meta.json'), '{}\n', 'utf8');
    await writeFile(path.join(sessionRoot, 'pinned.md'), 'Pinned note\n', 'utf8');

    const events = [
      { ts: '2026-03-11T00:00:00.000Z', role: 'user', kind: 'memo', text: 'first memo', refs: [] },
      { ts: '2026-03-11T01:00:00.000Z', role: 'user', kind: 'memo', text: 'second memo', refs: ['hot'] },
      { ts: '2026-03-11T02:00:00.000Z', role: 'assistant', kind: 'memo', text: 'ignore assistant memo', refs: [] },
      { ts: '2026-03-11T03:00:00.000Z', role: 'user', kind: 'prompt', text: 'ignore prompt', refs: [] },
      { ts: '2026-03-11T04:00:00.000Z', role: 'user', kind: 'memo', text: 'third memo', refs: [] },
    ];
    await writeFile(
      path.join(sessionRoot, 'l2-events.jsonl'),
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8'
    );

    const overlay = await buildWorkspaceMemoryOverlay(workspaceRoot, {
      CTXDB_WORKSPACE_MEMORY: '1',
      WORKSPACE_MEMORY_SPACE: 'acc-1',
      WORKSPACE_MEMORY_RECENT_LIMIT: '2',
      WORKSPACE_MEMORY_MAX_CHARS: '4000',
    });

    assert.match(overlay, /## Workspace Memory/);
    assert.match(overlay, /Space: acc-1/);
    assert.match(overlay, /### Pinned/);
    assert.match(overlay, /Pinned note/);
    assert.match(overlay, /third memo/);
    assert.match(overlay, /second memo/);
    assert.match(overlay, /#hot/);
    assert.doesNotMatch(overlay, /first memo/);
    assert.doesNotMatch(overlay, /ignore assistant memo/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('buildWorkspaceMemoryOverlay enforces max chars limit', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-workspace-memory-trunc-'));

  try {
    const sessionId = 'workspace-memory--default';
    const sessionRoot = path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId);
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(path.join(sessionRoot, 'meta.json'), '{}\n', 'utf8');
    await writeFile(path.join(sessionRoot, 'pinned.md'), 'x'.repeat(10_000), 'utf8');

    const overlay = await buildWorkspaceMemoryOverlay(workspaceRoot, {
      CTXDB_WORKSPACE_MEMORY: '1',
      WORKSPACE_MEMORY_SPACE: 'default',
      WORKSPACE_MEMORY_MAX_CHARS: '512',
      WORKSPACE_MEMORY_RECENT_LIMIT: '0',
    });

    assert.equal(overlay.length <= 512, true);
    assert.match(overlay, /truncated/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent tolerates context:pack failures by running without a context packet', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-pack-fail-'));
  const sessionId = 'ctx-pack-failure';

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'codex-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify ctx-agent pack fail-open',
      '--session-id',
      sessionId,
    ]);

    // Remove the L0 summary so context:pack fails on the first attempt.
    await rm(
      path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'),
      { force: true }
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'codex-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--prompt',
        'smoke',
        '--dry-run',
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CTXDB_PACK_STRICT: '0',
        },
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[dry-run\]/);
    assert.match(result.stderr, /contextdb context:pack failed/i);

    // The checkpoint path recreates the summary, so a later pack should succeed and write the export.
    await stat(path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'));
    await stat(path.join(workspaceRoot, 'memory', 'context-db', 'exports', `${sessionId}-context.md`));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent tolerates context:pack failures in interactive mode by still invoking the CLI', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-pack-interactive-'));
  const sessionId = 'ctx-pack-failure-interactive';
  const fakeBin = await createFakeCodexCommand();

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'codex-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify ctx-agent interactive pack fail-open',
      '--session-id',
      sessionId,
    ]);

    // Remove the L0 summary so context:pack fails on the first attempt.
    await rm(
      path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'),
      { force: true }
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'codex-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--no-bootstrap',
        '--',
        '--version',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CTXDB_PACK_STRICT: '0',
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /FAKE_CODEX_OK/);
    assert.match(result.stderr, /contextdb context:pack failed/i);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent interactive Claude mode injects context packet as system prompt', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-claude-interactive-'));
  const sessionId = 'ctx-claude-interactive';
  const fakeBin = await createFakeClaudeCommand();

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'claude-code',
      '--project',
      'tmp-project',
      '--goal',
      'Verify claude interactive context injection',
      '--session-id',
      sessionId,
    ]);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'claude-code',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    const lines = result.stdout.trim().split('\n');
    const payload = JSON.parse(lines.at(-1) || '{}');
    assert.equal(payload.marker, 'FAKE_CLAUDE_OK');
    assert.equal(payload.argv.includes('--append-system-prompt'), true);
    assert.equal(payload.argv.length, 3);
    assert.equal(
      payload.argv.at(-1),
      'Continue from this state. Preserve constraints, avoid repeating completed work, and update the next checkpoint when done.'
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent interactive Claude mode sends auto prompt when CTXDB_AUTO_PROMPT is set', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-claude-auto-prompt-'));
  const sessionId = 'ctx-claude-auto-prompt';
  const fakeBin = await createFakeClaudeCommand();
  const autoPrompt = 'Continue from this state. Preserve constraints, avoid repeating completed work, and update the next checkpoint when done.';

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'claude-code',
      '--project',
      'tmp-project',
      '--goal',
      'Verify claude auto prompt injection',
      '--session-id',
      sessionId,
    ]);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'claude-code',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CTXDB_AUTO_PROMPT: autoPrompt,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    const lines = result.stdout.trim().split('\n');
    const payload = JSON.parse(lines.at(-1) || '{}');
    assert.equal(payload.marker, 'FAKE_CLAUDE_OK');
    assert.equal(payload.argv.includes('--append-system-prompt'), true);
    assert.equal(payload.argv.length, 3);
    assert.equal(payload.argv.at(-1), autoPrompt);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent one-shot OpenCode mode uses file-backed context handoff', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-opencode-one-shot-'));
  const sessionId = 'ctx-opencode-one-shot';
  const fakeBin = await createFakeOpenCodeCommand();

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'opencode-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify opencode one-shot context handoff',
      '--session-id',
      sessionId,
    ]);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'opencode-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--prompt',
        'Summarize the current status.',
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    const payload = parseLastJsonPayload(result.stdout);
    assert.equal(payload.marker, 'FAKE_OPENCODE_OK');
    assert.equal(payload.argv[0], 'run');
    assert.match(payload.argv[1], /Read the context packet at/u);
    assert.match(payload.argv[1], new RegExp(`${sessionId}-context\\.md`));
    assert.match(payload.argv[1], /Summarize the current status\./u);
    assert.doesNotMatch(payload.argv[1], /# Context Packet/u);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent interactive OpenCode mode sends auto prompt via context packet file reference', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-opencode-interactive-'));
  const sessionId = 'ctx-opencode-interactive';
  const fakeBin = await createFakeOpenCodeCommand();

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'opencode-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify opencode interactive context handoff',
      '--session-id',
      sessionId,
    ]);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'opencode-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Auto prompt: enabled \(context handoff via file\)/u);
    const payload = parseLastJsonPayload(result.stdout);
    assert.equal(payload.marker, 'FAKE_OPENCODE_OK');
    assert.deepEqual(payload.argv.slice(0, 2), ['--prompt', payload.argv[1]]);
    assert.match(payload.argv[1], /Read the context packet at/u);
    assert.match(payload.argv[1], new RegExp(`${sessionId}-context\\.md`));
    assert.match(
      payload.argv[1],
      /Continue from this state\. Preserve constraints, avoid repeating completed work, and update the next checkpoint when done\./u
    );
    assert.doesNotMatch(payload.argv[1], /# Context Packet/u);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
