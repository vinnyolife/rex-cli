import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendEvent,
  buildTimeline,
  buildContextPacket,
  createSession,
  ensureContextDb,
  getEventById,
  searchEvents,
  writeCheckpoint,
} from '../src/contextdb/core.js';

async function makeWorkspace(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ctxdb-'));
  await fs.mkdir(path.join(workspace, 'config'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'config', 'browser-profiles.json'), '{"profiles":{}}', 'utf8');
  return workspace;
}

test('ensureContextDb initializes expected directory structure', async () => {
  const workspace = await makeWorkspace();
  const dbRoot = await ensureContextDb(workspace);

  const manifestPath = path.join(dbRoot, 'manifest.json');
  const sessionsPath = path.join(dbRoot, 'sessions');
  const indexPath = path.join(dbRoot, 'index', 'sessions.jsonl');

  const [manifestRaw, sessionsStat, indexStat] = await Promise.all([
    fs.readFile(manifestPath, 'utf8'),
    fs.stat(sessionsPath),
    fs.stat(indexPath),
  ]);

  const manifest = JSON.parse(manifestRaw) as { version: number; layout: string };
  assert.equal(manifest.version, 1);
  assert.equal(manifest.layout, 'l0-l1-l2');
  assert.equal(sessionsStat.isDirectory(), true);
  assert.equal(indexStat.isFile(), true);
});

test('createSession writes metadata and index record', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-ai-boot',
    goal: 'Diagnose flaky browser launch',
    tags: ['debug', 'browser'],
  });

  const metaPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'meta.json'
  );
  const indexPath = path.join(workspace, 'memory', 'context-db', 'index', 'sessions.jsonl');

  const [metaRaw, indexRaw] = await Promise.all([
    fs.readFile(metaPath, 'utf8'),
    fs.readFile(indexPath, 'utf8'),
  ]);

  const meta = JSON.parse(metaRaw) as { agent: string; project: string; goal: string };
  assert.equal(meta.agent, 'claude-code');
  assert.equal(meta.project, 'rex-ai-boot');
  assert.equal(meta.goal, 'Diagnose flaky browser launch');
  assert.match(indexRaw, new RegExp(session.sessionId));
});

test('appendEvent and writeCheckpoint persist l2/l1 context', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'gemini-cli',
    project: 'rex-ai-boot',
    goal: 'Publish xiaohongshu post safely',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    text: 'Need a safe posting flow.',
    kind: 'request',
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    text: 'Start with auth gate checks and pacing.',
    kind: 'plan',
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Auth gate is present; waiting for manual login.',
    status: 'blocked',
    nextActions: ['Wait for human login', 'Resume snapshot and publish draft'],
    artifacts: ['screenshots/auth-gate.png'],
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );
  const checkpointsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l1-checkpoints.jsonl'
  );
  const summaryPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l0-summary.md'
  );

  const [eventsRaw, checkpointsRaw, summaryRaw] = await Promise.all([
    fs.readFile(eventsPath, 'utf8'),
    fs.readFile(checkpointsPath, 'utf8'),
    fs.readFile(summaryPath, 'utf8'),
  ]);

  const eventLines = eventsRaw.trim().split('\n');
  const checkpointLines = checkpointsRaw.trim().split('\n');

  assert.equal(eventLines.length, 2);
  assert.equal(checkpointLines.length, 1);
  assert.match(summaryRaw, /Auth gate is present/);
});

test('buildContextPacket composes markdown for agent handoff', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-ai-boot',
    goal: 'Generate image workflow docs',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    text: 'Analyze OpenViking and simplify context DB flow.',
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Need filesystem-only context DB MVP.',
    nextActions: ['Create CLI commands', 'Write runbook'],
    status: 'running',
  });

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 10,
  });

  assert.match(packet.markdown, /Context Packet/);
  assert.match(packet.markdown, /filesystem-only context DB MVP/);
  assert.match(packet.markdown, /Analyze OpenViking/);
});

test('appendEvent deduplicates rapid duplicate events', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-ai-boot',
    goal: 'Validate dedupe',
  });

  const first = await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Same response body',
    refs: ['core.ts'],
  });
  const second = await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Same response body',
    refs: ['core.ts'],
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );
  const eventsRaw = await fs.readFile(eventsPath, 'utf8');
  const lines = eventsRaw.trim().split('\n').filter(Boolean);

  assert.equal(lines.length, 1);
  assert.equal(first.seq, second.seq);
});

test('buildContextPacket supports kind/ref filtering and token budget', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-ai-boot',
    goal: 'Filter packet events',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'First prompt should be excluded.',
    refs: ['task.md'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Long response for pack budget verification and downstream context handoff.',
    refs: ['core.ts', 'cli.ts'],
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Checkpoint summary for packet.',
    status: 'running',
    nextActions: ['Continue'],
  });

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 50,
    tokenBudget: 18,
    kinds: ['response'],
    refs: ['core.ts'],
  });

  assert.match(packet.markdown, /Event Filters: kinds=response refs=core\.ts/);
  assert.match(packet.markdown, /response/);
  assert.doesNotMatch(packet.markdown, /First prompt should be excluded/);
});

test('searchEvents, getEventById, and buildTimeline use sidecar indexes', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'gemini-cli',
    project: 'rex-ai-boot',
    goal: 'Exercise sidecar index APIs',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'Investigate auth race condition',
    refs: ['auth.ts'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Auth race likely in refresh path',
    refs: ['auth.ts', 'token.ts'],
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Race condition isolated.',
    status: 'running',
    nextActions: ['Patch token refresh'],
    artifacts: ['logs/auth-race.log'],
  });

  const found = await searchEvents({
    workspaceRoot: workspace,
    query: 'auth race',
    project: 'rex-ai-boot',
    kinds: ['response'],
    refs: ['auth.ts'],
    limit: 10,
  });

  assert.equal(found.results.length, 1);
  assert.match(found.results[0].eventId, new RegExp(`^${session.sessionId}#`));

  const byId = await getEventById({
    workspaceRoot: workspace,
    eventId: found.results[0].eventId,
  });
  assert.equal(byId.event?.kind, 'response');
  assert.match(byId.event?.text ?? '', /refresh path/);

  const timeline = await buildTimeline({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    limit: 5,
  });
  assert.ok(timeline.items.length >= 2);
  assert.ok(timeline.items.some((item) => item.itemType === 'checkpoint'));
});
