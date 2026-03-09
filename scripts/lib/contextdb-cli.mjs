import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TSX_CLI = path.join(REPO_ROOT, 'mcp-server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const CONTEXTDB_CLI = path.join(REPO_ROOT, 'mcp-server', 'src', 'contextdb', 'cli.ts');

export function runContextDbCli(args = [], { cwd = REPO_ROOT } = {}) {
  const result = spawnSync(process.execPath, [TSX_CLI, CONTEXTDB_CLI, ...args], {
    cwd,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || '').trim();
    throw new Error(details || `contextdb cli failed with exit code ${result.status}`);
  }

  const stdout = String(result.stdout || '').trim();
  return stdout.length > 0 ? JSON.parse(stdout) : {};
}
