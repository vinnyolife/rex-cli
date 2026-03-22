import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

async function makeGitRepo() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-worktree-'));
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'index.txt'), 'hello\n', 'utf8');
  spawnSync('git init', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git config user.email "aios@example.com"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git config user.name "AIOS Tests"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git add -A', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git commit -m "init"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  return rootDir;
}

test('worktree runner creates and destroys an isolated git worktree for one episode', async () => {
  const mod = await import('../lib/rl-shell-v1/worktree-runner.mjs');
  const rootDir = await makeGitRepo();
  const workspace = await mod.createEpisodeWorktree({
    rootDir,
    runId: 'run-001',
    taskId: 'task-001',
  });

  assert.equal(workspace.worktreePath.includes('.git'), false);
  await access(path.join(workspace.repoPath, 'src', 'index.txt'));

  await mod.destroyEpisodeWorktree(workspace);
  await assert.rejects(() => access(workspace.worktreePath));
});
