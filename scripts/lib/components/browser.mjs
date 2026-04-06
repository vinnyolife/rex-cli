import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';

const DEFAULT_CDP_SERVICE_PORT = 9222;
const CDP_SERVICE_LABEL_PREFIX = 'com.aios.cdp';

function requireCommand(name) {
  if (!commandExists(name)) {
    throw new Error(`Missing required command: ${name}`);
  }
}

function printSnippet(io, distPath) {
  io.log('');
  io.log('Done. Add this MCP server block to your client config:');
  io.log('');
  io.log('{');
  io.log('  "mcpServers": {');
  io.log('    "playwright-browser-mcp": {');
  io.log('      "command": "node",');
  io.log(`      "args": ["${distPath}"]`);
  io.log('    }');
  io.log('  }');
  io.log('}');
}

export async function installBrowserMcp({ rootDir, skipPlaywrightInstall = false, dryRun = false, io = console } = {}) {
  const mcpDir = path.join(rootDir, 'mcp-server');
  const distEntry = path.join(mcpDir, 'dist', 'index.js');

  if (!fs.existsSync(mcpDir)) {
    throw new Error(`mcp-server directory not found: ${mcpDir}`);
  }

  requireCommand('node');
  requireCommand('npm');
  requireCommand('npx');

  const runInMcp = (command, args) => {
    io.log(`+ (cd ${mcpDir} && ${command} ${args.join(' ')})`);
    if (!dryRun) {
      runCommand(command, args, { cwd: mcpDir });
    }
  };

  runInMcp('npm', ['install']);
  if (!skipPlaywrightInstall) {
    runInMcp('npx', ['playwright', 'install', 'chromium']);
  }
  runInMcp('npm', ['run', 'build']);

  const distPath = dryRun ? '<ABSOLUTE_PATH_TO_REPO>/mcp-server/dist/index.js' : fs.realpathSync(distEntry);
  printSnippet(io, distPath);
  return { distPath };
}

function testPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 300 }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function assertDarwinPlatform() {
  if (process.platform !== 'darwin') {
    throw new Error('Browser CDP launch service commands are only supported on macOS.');
  }
}

function normalizeCdpPort(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CDP_SERVICE_PORT;
}

function resolveDefaultCdpPort(rootDir) {
  const profileConfig = path.join(rootDir, 'config', 'browser-profiles.json');
  if (!fs.existsSync(profileConfig)) return DEFAULT_CDP_SERVICE_PORT;

  try {
    const parsed = JSON.parse(fs.readFileSync(profileConfig, 'utf8'));
    return normalizeCdpPort(parsed?.profiles?.default?.cdpPort);
  } catch {
    return DEFAULT_CDP_SERVICE_PORT;
  }
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function resolveNodeCandidates() {
  const homeDir = process.env.HOME || os.homedir() || '';
  const versionedFnmNode = homeDir
    ? path.join(homeDir, '.local', 'share', 'fnm', 'node-versions', `v${process.versions.node}`, 'installation', 'bin', 'node')
    : '';

  return uniqueStrings([
    process.execPath,
    process.argv?.[0],
    versionedFnmNode,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ]);
}

function resolveCdpServiceLayout(rootDir, port = DEFAULT_CDP_SERVICE_PORT) {
  const homeDir = process.env.HOME || os.homedir();
  if (!homeDir) {
    throw new Error('Cannot resolve HOME directory for browser CDP launch service.');
  }

  const resolvedPort = normalizeCdpPort(port);
  const label = `${CDP_SERVICE_LABEL_PREFIX}${resolvedPort}`;
  const logsDir = path.join(homeDir, 'Library', 'Logs');
  const launchAgentsDir = path.join(homeDir, 'Library', 'LaunchAgents');
  const localBinDir = path.join(homeDir, '.local', 'bin');

  return {
    rootDir,
    homeDir,
    label,
    port: resolvedPort,
    logsDir,
    launchAgentsDir,
    localBinDir,
    plistPath: path.join(launchAgentsDir, `${label}.plist`),
    launcherPath: path.join(localBinDir, `aios-cdp-${resolvedPort}-start.sh`),
    stdoutPath: path.join(logsDir, `aios-cdp-${resolvedPort}.out.log`),
    stderrPath: path.join(logsDir, `aios-cdp-${resolvedPort}.err.log`),
    userDataDir: path.join(rootDir, '.browser-profiles', resolvedPort === 9222 ? 'default-cdp' : `default-cdp-${resolvedPort}`),
    playwrightRequirePath: path.join(rootDir, 'mcp-server', 'node_modules', 'playwright'),
  };
}

function renderCdpLauncherScript(layout) {
  const nodeCandidates = resolveNodeCandidates();
  const candidateRows = nodeCandidates.map((candidate) => `  ${JSON.stringify(candidate)}`).join('\n');

  return `#!/bin/zsh
set -euo pipefail

ROOT=${JSON.stringify(layout.rootDir)}
MCP_DIR=${JSON.stringify(path.join(layout.rootDir, 'mcp-server'))}
USER_DATA_DIR=${JSON.stringify(layout.userDataDir)}
PORT=${JSON.stringify(String(layout.port))}
PLAYWRIGHT_MODULE=${JSON.stringify(layout.playwrightRequirePath)}

mkdir -p "$USER_DATA_DIR"

if [[ ! -d "$MCP_DIR" ]]; then
  echo "[aios-cdp] mcp-server not found: $MCP_DIR" >&2
  exit 1
fi

NODE_CANDIDATES=(
${candidateRows}
)

NODE_BIN=""
for candidate in "\${NODE_CANDIDATES[@]}"; do
  if [[ -x "$candidate" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [[ -z "$NODE_BIN" ]]; then
  echo "[aios-cdp] node binary not found. Install Node 22+ and/or set AIOS_NODE_BIN in launch agent env." >&2
  exit 1
fi

CHROME_BIN="$("$NODE_BIN" -e 'process.stdout.write(require(process.argv[1]).chromium.executablePath())' "$PLAYWRIGHT_MODULE")"
if [[ -z "$CHROME_BIN" || ! -x "$CHROME_BIN" ]]; then
  echo "[aios-cdp] chromium executable not found: $CHROME_BIN" >&2
  exit 1
fi

exec "$CHROME_BIN" \\
  --remote-debugging-port="$PORT" \\
  --user-data-dir="$USER_DATA_DIR" \\
  --no-first-run \\
  --no-default-browser-check \\
  --headless \\
  about:blank
`;
}

function renderCdpLaunchAgentPlist(layout) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${layout.label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${layout.launcherPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${layout.rootDir}</string>
  <key>StandardOutPath</key>
  <string>${layout.stdoutPath}</string>
  <key>StandardErrorPath</key>
  <string>${layout.stderrPath}</string>
</dict>
</plist>
`;
}

function writeCdpLaunchAgentFiles(layout) {
  fs.mkdirSync(layout.localBinDir, { recursive: true });
  fs.mkdirSync(layout.launchAgentsDir, { recursive: true });
  fs.mkdirSync(layout.logsDir, { recursive: true });
  fs.mkdirSync(layout.userDataDir, { recursive: true });

  fs.writeFileSync(layout.launcherPath, renderCdpLauncherScript(layout), 'utf8');
  fs.chmodSync(layout.launcherPath, 0o755);
  fs.writeFileSync(layout.plistPath, renderCdpLaunchAgentPlist(layout), 'utf8');
}

function resolveLaunchctlDomain() {
  if (typeof process.getuid !== 'function') {
    throw new Error('Cannot resolve launchctl user domain: process.getuid() is unavailable.');
  }
  return `gui/${process.getuid()}`;
}

function parseLaunchctlState(raw = '') {
  const text = String(raw ?? '');
  const stateMatch = /(?:^|\n)\s*state = ([^\n]+)/u.exec(text);
  const pidMatch = /(?:^|\n)\s*pid = (\d+)/u.exec(text);
  return {
    state: stateMatch ? stateMatch[1].trim() : '',
    pid: pidMatch ? Number.parseInt(pidMatch[1], 10) : null,
  };
}

async function waitForPortState(port, expectedOpen, attempts = 20, delayMs = 200) {
  for (let index = 0; index < attempts; index += 1) {
    const open = await testPortOpen(port);
    if (open === expectedOpen) return true;
    if (index + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

export async function startBrowserCdpService({ rootDir, io = console } = {}) {
  assertDarwinPlatform();
  if (!commandExists('launchctl')) {
    throw new Error('Missing required command: launchctl');
  }

  const port = resolveDefaultCdpPort(rootDir);
  const layout = resolveCdpServiceLayout(rootDir, port);
  const domain = resolveLaunchctlDomain();
  const service = `${domain}/${layout.label}`;

  writeCdpLaunchAgentFiles(layout);
  captureCommand('launchctl', ['bootout', domain, layout.plistPath]);
  runCommand('launchctl', ['bootstrap', domain, layout.plistPath]);
  runCommand('launchctl', ['enable', service]);
  runCommand('launchctl', ['kickstart', '-k', service]);

  const ready = await waitForPortState(layout.port, true);
  if (!ready) {
    throw new Error(`Browser CDP service started but port ${layout.port} is not reachable yet.`);
  }

  const servicePrint = captureCommand('launchctl', ['print', service]);
  const state = parseLaunchctlState(servicePrint.stdout);

  io.log(`CDP launch agent up: ${layout.label}`);
  io.log(`plist: ${layout.plistPath}`);
  io.log(`launcher: ${layout.launcherPath}`);
  io.log(`port: 127.0.0.1:${layout.port}`);
  if (Number.isFinite(state.pid) && state.pid > 0) {
    io.log(`pid: ${state.pid}`);
  }

  return {
    label: layout.label,
    port: layout.port,
    plistPath: layout.plistPath,
    launcherPath: layout.launcherPath,
    pid: Number.isFinite(state.pid) ? state.pid : null,
    running: true,
  };
}

export async function stopBrowserCdpService({ rootDir, io = console } = {}) {
  assertDarwinPlatform();
  if (!commandExists('launchctl')) {
    throw new Error('Missing required command: launchctl');
  }

  const port = resolveDefaultCdpPort(rootDir);
  const layout = resolveCdpServiceLayout(rootDir, port);
  const domain = resolveLaunchctlDomain();
  const bootout = captureCommand('launchctl', ['bootout', domain, layout.plistPath]);
  const stopped = bootout.status === 0;
  const portClosed = await waitForPortState(layout.port, false);

  if (stopped) {
    io.log(`CDP launch agent stopped: ${layout.label}`);
  } else {
    io.log(`CDP launch agent already stopped: ${layout.label}`);
  }
  io.log(`port ${layout.port}: ${portClosed ? 'closed' : 'still-open'}`);

  return {
    label: layout.label,
    port: layout.port,
    stopped,
    portClosed,
  };
}

export async function restartBrowserCdpService({ rootDir, io = console } = {}) {
  await stopBrowserCdpService({ rootDir, io });
  return await startBrowserCdpService({ rootDir, io });
}

export async function statusBrowserCdpService({ rootDir, io = console } = {}) {
  assertDarwinPlatform();
  if (!commandExists('launchctl')) {
    throw new Error('Missing required command: launchctl');
  }

  const port = resolveDefaultCdpPort(rootDir);
  const layout = resolveCdpServiceLayout(rootDir, port);
  const domain = resolveLaunchctlDomain();
  const service = `${domain}/${layout.label}`;
  const servicePrint = captureCommand('launchctl', ['print', service]);
  const state = parseLaunchctlState(servicePrint.stdout);
  const loaded = servicePrint.status === 0;
  const listening = await testPortOpen(layout.port);

  io.log('Browser CDP Service');
  io.log(`label: ${layout.label}`);
  io.log(`service: ${service}`);
  io.log(`state: ${loaded ? (state.state || 'loaded') : 'not-loaded'}`);
  io.log(`pid: ${Number.isFinite(state.pid) ? state.pid : '-'}`);
  io.log(`port: 127.0.0.1:${layout.port} (${listening ? 'listening' : 'closed'})`);
  io.log(`plist: ${layout.plistPath}`);
  io.log(`launcher: ${layout.launcherPath}`);

  return {
    label: layout.label,
    port: layout.port,
    loaded,
    state: state.state || (loaded ? 'loaded' : 'not-loaded'),
    pid: Number.isFinite(state.pid) ? state.pid : null,
    listening,
    plistPath: layout.plistPath,
    launcherPath: layout.launcherPath,
  };
}

export async function doctorBrowserMcp({ rootDir, io = console } = {}) {
  const mcpDir = path.join(rootDir, 'mcp-server');
  const distEntry = path.join(mcpDir, 'dist', 'index.js');
  const profileConfig = path.join(rootDir, 'config', 'browser-profiles.json');

  let warnings = 0;
  let errors = 0;
  const ok = (message) => io.log(`OK   ${message}`);
  const warn = (message) => {
    warnings += 1;
    io.log(`WARN ${message}`);
  };
  const err = (message) => {
    errors += 1;
    io.log(`ERR  ${message}`);
  };

  io.log('Browser MCP Doctor');
  io.log(`Repo: ${rootDir}`);
  io.log('');
  io.log('[1/6] Command checks');
  for (const command of ['node', 'npm', 'npx']) {
    if (commandExists(command)) ok(`command exists: ${command}`); else err(`missing command: ${command}`);
  }

  const version = captureCommand('node', ['-p', 'process.versions.node']);
  const major = Number((version.stdout.trim().split('.')[0] || '0'));
  if (major > 0 && major < 20) {
    warn(`node version is ${version.stdout.trim()} (recommended: >= 20)`);
  }

  io.log('');
  io.log('[2/6] mcp-server files');
  if (fs.existsSync(path.join(mcpDir, 'package.json'))) ok('mcp-server/package.json found'); else err('missing mcp-server/package.json');
  if (fs.existsSync(path.join(mcpDir, 'node_modules'))) ok('mcp-server/node_modules found'); else err('node_modules missing. Run: cd mcp-server; npm install');
  if (fs.existsSync(distEntry)) ok('build artifact found: mcp-server/dist/index.js'); else err('build artifact missing. Run: cd mcp-server; npm run build');

  io.log('');
  io.log('[3/6] Playwright runtime');
  const playwrightPath = captureCommand('node', ['-e', "process.stdout.write(require('playwright').chromium.executablePath())"], { cwd: mcpDir });
  if (playwrightPath.status === 0 && playwrightPath.stdout.trim() && fs.existsSync(playwrightPath.stdout.trim())) {
    ok('Playwright chromium executable found');
  } else {
    warn('Playwright chromium executable not installed. Run: cd mcp-server; npx playwright install chromium');
  }

  io.log('');
  io.log('[4/6] profile config');
  if (!fs.existsSync(profileConfig)) {
    err('profile config missing: config/browser-profiles.json');
  } else {
    ok('profile config found: config/browser-profiles.json');
  }

  let defaultProfile = null;
  if (fs.existsSync(profileConfig)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(profileConfig, 'utf8'));
      defaultProfile = parsed?.profiles?.default ?? null;
      if (!defaultProfile) {
        warn('profile config has no profiles.default entry');
      }
    } catch (error) {
      err(`profile config JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  io.log('');
  io.log('[5/6] default profile mode');
  if (!defaultProfile) {
    warn('default profile not configured; skipping CDP mode checks');
  } else if (defaultProfile.cdpUrl) {
    ok(`default profile uses cdpUrl: ${defaultProfile.cdpUrl}`);
  } else if (defaultProfile.cdpPort) {
    const port = Number(defaultProfile.cdpPort);
    if (!Number.isInteger(port) || port <= 0) {
      warn(`default cdpPort is not a valid integer: ${defaultProfile.cdpPort}`);
    } else if (await testPortOpen(port)) {
      ok(`default CDP port is reachable: ${port}`);
    } else {
      warn(`default CDP port is not reachable: ${port} (profile=default will auto-fallback to local launch)`);
    }
  } else {
    ok('default profile uses local launch mode (no CDP dependency)');
  }

  io.log('');
  io.log('[6/6] quick next steps');
  io.log('- Recommended: keep default profile CDP service healthy');
  io.log('  node scripts/aios.mjs internal browser cdp-start');
  io.log('  node scripts/aios.mjs internal browser cdp-status');
  io.log('- If ERR exists: run install script first');
  io.log('  node scripts/aios.mjs setup --components browser');
  io.log('- Then smoke test in client chat: browser_launch -> browser_navigate -> browser_snapshot -> browser_close');

  io.log('');
  if (errors > 0) io.log(`Result: FAILED (${errors} errors, ${warnings} warnings)`);
  else io.log(`Result: OK (${warnings} warnings)`);

  return { warnings, effectiveWarnings: warnings, errors };
}
