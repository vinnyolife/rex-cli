import { access, appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { validateTaskManifest, validateObservationEvent } from './schema.mjs';
import { normalizePatchDiff, validateStudentAction } from './action-protocol.mjs';

const DEFAULT_POLICY = Object.freeze({
  max_steps_per_episode: 12,
  max_command_seconds: 30,
  max_episode_seconds: 180,
  max_output_bytes_per_stream: 65536,
  network_access: false,
  forbidden_command_patterns: ['sudo', 'ssh', 'scp', 'curl', 'wget', 'git push', 'git reset --hard', 'rm -rf /'],
});

function truncateText(value, maxBytes) {
  const text = String(value || '');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) {
    return {
      excerpt: text,
      truncated: false,
    };
  }
  const excerpt = Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8');
  return {
    excerpt: `${excerpt}\n[TRUNCATED]\n`,
    truncated: true,
  };
}

function createEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function isWithinRoot(rootPath, candidatePath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function resolveWorkspacePath(workspace, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Path must stay inside the temp workspace root');
  }
  const resolvedPath = path.resolve(workspace.repoPath, relativePath);
  if (!isWithinRoot(workspace.repoPath, resolvedPath)) {
    throw new Error('Resolved path escapes the temp workspace root');
  }
  return resolvedPath;
}

function makeObservation({ workspace, action, status, errorCode = null, errorMessage = null, payload }) {
  const event = validateObservationEvent({
    schema_version: 1,
    step_index: workspace.observations.length + 1,
    action,
    status,
    error_code: errorCode,
    error_message: errorMessage,
    payload,
  });
  workspace.observations.push(event);
  return event;
}

async function persistObservation(workspace, event) {
  await appendFile(workspace.observationTracePath, `${JSON.stringify(event)}\n`, 'utf8');
}

async function recordObservation(args) {
  const event = makeObservation(args);
  await persistObservation(args.workspace, event);
  return event;
}

function assertWorkspaceState(workspace) {
  if (!workspace || typeof workspace !== 'object') {
    throw new Error('Workspace is required');
  }
  if (!workspace.repoPath || !workspace.workspacePath) {
    throw new Error('Unsafe runner state: workspace paths are missing');
  }
}

async function ensureWorkspaceReadable(workspace) {
  assertWorkspaceState(workspace);
  try {
    await access(workspace.repoPath);
  } catch {
    throw new Error('Workspace repo is unreadable');
  }
}

function ensureBudgets(workspace, policy) {
  const elapsedMs = Date.now() - workspace.startedAt;
  if (elapsedMs > policy.max_episode_seconds * 1000) {
    throw new Error('Episode wall-clock budget expired');
  }
  if (workspace.observations.length >= policy.max_steps_per_episode) {
    throw new Error('Episode step budget exhausted');
  }
}

function checkForbiddenCommand(command, policy) {
  const lower = command.toLowerCase();
  for (const pattern of policy.forbidden_command_patterns) {
    if (lower.includes(pattern.toLowerCase())) {
      return `Command contains forbidden pattern: ${pattern}`;
    }
  }
  if (policy.network_access === false && /\b(nc|telnet)\b/i.test(command)) {
    return 'Network access is disabled';
  }
  if (/[;&]\s*$/.test(command) || /\b(nohup|watch|top|less|more|nano|vim)\b/i.test(command)) {
    return 'Interactive or background commands are not allowed';
  }
  const redirectPattern = /(?:^|\s)(?:1>>|2>>|>>|1>|2>|>)(?:\s*)(\S+)/g;
  for (const match of command.matchAll(redirectPattern)) {
    const target = match[1].replace(/^['"]|['"]$/g, '');
    if (!target) continue;
    if (path.isAbsolute(target)) {
      return 'Command redirect target escapes the temp workspace root';
    }
    if (target.includes('..')) {
      return 'Command redirect target escapes the temp workspace root';
    }
  }
  return null;
}

function runCommand({ cwd, command, policy }) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: policy.max_command_seconds * 1000,
    maxBuffer: policy.max_output_bytes_per_stream * 4,
    env: createEnv(),
  });

  if (result.error && result.error.code === 'ETIMEDOUT') {
    return {
      timedOut: true,
      exitCode: 124,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  }

  return {
    timedOut: false,
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function collectFailingTests(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('not ok') || line.includes('ERR_ASSERTION') || line.includes('ERR_TEST_FAILURE'));
}

function parsePatchOperations(diffText) {
  const lines = normalizePatchDiff(diffText).split('\n');
  if (lines[0] !== '*** Begin Patch') {
    throw new Error('Patch must start with *** Begin Patch');
  }
  const operations = [];
  let index = 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line === '*** End Patch') {
      break;
    }
    if (line.startsWith('*** Update File: ')) {
      const filePath = line.slice('*** Update File: '.length).trim();
      index += 1;
      const removed = [];
      const added = [];
      while (index < lines.length) {
        const patchLine = lines[index];
        if (patchLine === '*** End Patch' || patchLine.startsWith('*** Update File: ')) {
          break;
        }
        if (patchLine === '@@' || patchLine.startsWith('@@ ')) {
          index += 1;
          continue;
        }
        if (patchLine.startsWith('-')) {
          removed.push(patchLine.slice(1));
        } else if (patchLine.startsWith('+')) {
          added.push(patchLine.slice(1));
        } else if (patchLine.startsWith(' ')) {
          const context = patchLine.slice(1);
          removed.push(context);
          added.push(context);
        }
        index += 1;
      }
      operations.push({
        filePath,
        removedText: removed.join('\n'),
        addedText: added.join('\n'),
      });
      continue;
    }
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    throw new Error(`Unsupported patch line: ${line}`);
  }

  if (operations.length === 0) {
    throw new Error('Patch must contain at least one update');
  }
  return operations;
}

async function applyPatch(workspace, diffText) {
  const operations = parsePatchOperations(diffText);
  const filesTouched = [];

  for (const operation of operations) {
    const targetPath = resolveWorkspacePath(workspace, operation.filePath);
    const original = await readFile(targetPath, 'utf8');
    if (!original.includes(operation.removedText)) {
      throw new Error(`Patch hunk did not match file contents for ${operation.filePath}`);
    }
    const next = original.replace(operation.removedText, operation.addedText);
    await writeFile(targetPath, next, 'utf8');
    filesTouched.push(operation.filePath);
  }

  return filesTouched;
}

export function createDefaultExecutionPolicy() {
  return {
    ...DEFAULT_POLICY,
    forbidden_command_patterns: [...DEFAULT_POLICY.forbidden_command_patterns],
  };
}

export async function createEpisodeWorkspace({ taskManifest, rootDir }) {
  const manifest = validateTaskManifest(taskManifest);
  const resolvedRoot = path.resolve(rootDir);
  const sourceRepoPath = path.isAbsolute(manifest.repo_source_path)
    ? manifest.repo_source_path
    : path.join(resolvedRoot, manifest.repo_source_path);
  await access(sourceRepoPath);

  const episodeRoot = path.join(resolvedRoot, 'episodes');
  await mkdir(episodeRoot, { recursive: true });
  const workspacePath = await mkdtemp(path.join(episodeRoot, `${manifest.task_id}-`));
  const repoPath = path.join(workspacePath, 'repo');
  await cp(sourceRepoPath, repoPath, { recursive: true });

  const observationTracePath = path.join(workspacePath, 'observation-trace.jsonl');
  await writeFile(observationTracePath, '', 'utf8');

  return {
    taskManifest: manifest,
    workspacePath,
    repoPath,
    observationTracePath,
    observations: [],
    startedAt: Date.now(),
  };
}

export async function destroyEpisodeWorkspace(workspace) {
  assertWorkspaceState(workspace);
  await rm(workspace.workspacePath, { recursive: true, force: true });
}

export async function executeAction({ workspace, action, policy = createDefaultExecutionPolicy() }) {
  await ensureWorkspaceReadable(workspace);
  ensureBudgets(workspace, policy);
  const validatedAction = validateStudentAction(action);

  if (validatedAction.action === 'read') {
    const targetPath = resolveWorkspacePath(workspace, validatedAction.path);
    const content = await readFile(targetPath, 'utf8');
    const truncated = truncateText(content, policy.max_output_bytes_per_stream);
    return await recordObservation({
      workspace,
      action: validatedAction,
      status: 'ok',
      payload: {
        path: validatedAction.path,
        content_excerpt: truncated.excerpt,
        content_truncated: truncated.truncated,
        bytes_read: Buffer.byteLength(content, 'utf8'),
      },
    });
  }

  if (validatedAction.action === 'run') {
    const rejectionReason = checkForbiddenCommand(validatedAction.command, policy);
    if (rejectionReason) {
      return await recordObservation({
        workspace,
        action: validatedAction,
        status: 'rejected',
        errorCode: 'unsafe_command',
        errorMessage: rejectionReason,
        payload: {
          exit_code: 126,
          stdout_excerpt: '',
          stderr_excerpt: rejectionReason,
          stdout_truncated: false,
          stderr_truncated: false,
          files_touched: [],
        },
      });
    }

    const result = runCommand({ cwd: workspace.repoPath, command: validatedAction.command, policy });
    const stdout = truncateText(result.stdout, policy.max_output_bytes_per_stream);
    const stderr = truncateText(result.stderr, policy.max_output_bytes_per_stream);

    return await recordObservation({
      workspace,
      action: validatedAction,
      status: result.timedOut ? 'timeout' : result.exitCode === 0 ? 'ok' : 'error',
      errorCode: result.timedOut ? 'command_timeout' : result.exitCode === 0 ? null : 'command_failed',
      errorMessage: result.timedOut ? 'Command exceeded max_command_seconds' : null,
      payload: {
        exit_code: result.exitCode,
        stdout_excerpt: stdout.excerpt,
        stderr_excerpt: stderr.excerpt,
        stdout_truncated: stdout.truncated,
        stderr_truncated: stderr.truncated,
        files_touched: [],
      },
    });
  }

  if (validatedAction.action === 'patch') {
    try {
      const filesTouched = await applyPatch(workspace, validatedAction.diff);
      return await recordObservation({
        workspace,
        action: validatedAction,
        status: 'ok',
        payload: {
          applied: true,
          files_touched: filesTouched,
          reject_reason: null,
          diff_excerpt: truncateText(validatedAction.diff, policy.max_output_bytes_per_stream).excerpt,
        },
      });
    } catch (error) {
      return await recordObservation({
        workspace,
        action: validatedAction,
        status: 'error',
        errorCode: 'patch_failed',
        errorMessage: error.message,
        payload: {
          applied: false,
          files_touched: [],
          reject_reason: error.message,
          diff_excerpt: truncateText(validatedAction.diff, policy.max_output_bytes_per_stream).excerpt,
        },
      });
    }
  }

  return await recordObservation({
    workspace,
    action: validatedAction,
    status: 'ok',
    payload: {
      message: validatedAction.message,
    },
  });
}

export async function runBaselineFailureCheck({ workspace, verificationCommand, policy = createDefaultExecutionPolicy() }) {
  const observation = await runVerification({ workspace, verificationCommand, policy });
  const failingTests = collectFailingTests(`${observation.payload.stdout_excerpt}\n${observation.payload.stderr_excerpt}`);
  return {
    reproduced: observation.payload.exit_code !== 0 && failingTests.length > 0,
    failingTests,
    observation,
  };
}

export async function runVerification({ workspace, verificationCommand, policy = createDefaultExecutionPolicy() }) {
  return await executeAction({
    workspace,
    action: {
      action: 'run',
      command: verificationCommand,
    },
    policy,
  });
}
