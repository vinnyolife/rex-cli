// scripts/lib/tui-ink/runner.mjs
// This file is the entry point for the TUI, run via tsx for TypeScript support
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Spawn tsx to run the TUI
const child = spawn('npx', ['tsx', path.join(rootDir, 'scripts/lib/tui-ink/cli.tsx'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    AIOS_ROOT_DIR: rootDir,
  },
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});