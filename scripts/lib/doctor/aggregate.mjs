import path from 'node:path';

import { inspectBootstrapTask } from '../../doctor-bootstrap-task.mjs';
import { doctorBrowserMcp } from '../components/browser.mjs';
import { doctorContextDbShell } from '../components/shell.mjs';
import { doctorContextDbSkills } from '../components/skills.mjs';
import { doctorSuperpowers } from '../components/superpowers.mjs';
import { getDisabledGateIds, isHarnessGateEnabled } from '../harness/profile.mjs';
import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';

export function countEffectiveWarnLines(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\r?\n/);
  return lines
    .filter((line) => line.startsWith('[warn] '))
    .filter((line) => !/^\[warn\] (codex|claude|gemini) not found in PATH$/u.test(line))
    .length;
}

function printCaptured(io, text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.length > 0) {
      io.log(line);
    }
  }
}

function logSkippedGate(io, gateId, profile) {
  io.log(`[skip] ${gateId} disabled for profile=${profile}`);
}

export async function runDoctorSuite({ rootDir, strict = false, globalSecurity = false, profile = 'standard', io = console, env = process.env } = {}) {
  let effectiveWarns = 0;
  const disabledGates = getDisabledGateIds(env);

  io.log('AIOS Verify');
  io.log('-----------');
  io.log(`Repo: ${rootDir}`);
  io.log(`Strict: ${strict}`);
  io.log(`Profile: ${profile}`);

  io.log('');
  io.log('== doctor-contextdb-shell ==');
  if (isHarnessGateEnabled('doctor:shell', { profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const shellResult = await doctorContextDbShell({ io });
    effectiveWarns += shellResult.effectiveWarnings;
  } else {
    logSkippedGate(io, 'doctor:shell', profile);
  }

  io.log('');
  io.log('== doctor-contextdb-skills ==');
  if (isHarnessGateEnabled('doctor:skills', { profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const skillsResult = await doctorContextDbSkills({ rootDir, client: 'all', io });
    effectiveWarns += skillsResult.effectiveWarnings;
  } else {
    logSkippedGate(io, 'doctor:skills', profile);
  }

  io.log('');
  io.log('== doctor-superpowers ==');
  if (isHarnessGateEnabled('doctor:superpowers', { profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const superpowersResult = await doctorSuperpowers({ io });
    if (superpowersResult.errors > 0) {
      throw new Error(`doctor-superpowers failed (${superpowersResult.errors} errors)`);
    }
    effectiveWarns += superpowersResult.effectiveWarnings;
  } else {
    logSkippedGate(io, 'doctor:superpowers', profile);
  }

  io.log('');
  io.log('== doctor-security-config ==');
  if (isHarnessGateEnabled('doctor:security', { profile, disabledGates, profiles: ['standard', 'strict'] })) {
    const securityScript = path.join(rootDir, 'scripts', 'doctor-security-config.mjs');
    const securityArgs = [securityScript, '--workspace', rootDir];
    if (globalSecurity) securityArgs.push('--global');
    const securityResult = captureCommand(process.execPath, securityArgs, { cwd: rootDir });
    printCaptured(io, securityResult.stdout);
    printCaptured(io, securityResult.stderr);
    effectiveWarns += countEffectiveWarnLines(`${securityResult.stdout}\n${securityResult.stderr}`);
  } else {
    logSkippedGate(io, 'doctor:security', profile);
  }

  io.log('');
  io.log('== doctor-bootstrap-task ==');
  if (isHarnessGateEnabled('doctor:bootstrap', { profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const bootstrap = await inspectBootstrapTask(rootDir);
    io.log('Bootstrap Task Doctor');
    io.log('---------------------');
    io.log(`Workspace: ${bootstrap.workspaceRoot}`);
    io.log(`[${bootstrap.status}] ${bootstrap.message}`);
    if (bootstrap.status !== 'ok') {
      effectiveWarns += 1;
    }
  } else {
    logSkippedGate(io, 'doctor:bootstrap', profile);
  }

  io.log('');
  io.log('== doctor-browser-mcp ==');
  if (isHarnessGateEnabled('doctor:browser', { profile, disabledGates, profiles: ['standard', 'strict'] })) {
    const browserResult = await doctorBrowserMcp({ rootDir, io });
    if (browserResult.errors > 0) {
      effectiveWarns += 1;
    } else {
      effectiveWarns += browserResult.effectiveWarnings;
    }
  } else {
    logSkippedGate(io, 'doctor:browser', profile);
  }

  io.log('');
  io.log('== mcp-server build ==');
  if (isHarnessGateEnabled('doctor:mcp-build', { profile, disabledGates, profiles: ['standard', 'strict'] })) {
    const mcpDir = path.join(rootDir, 'mcp-server');
    if (!commandExists('npm')) {
      io.log('[warn] npm not found; skipping mcp-server build');
      effectiveWarns += 1;
    } else {
      io.log('+ npm run typecheck');
      runCommand('npm', ['run', 'typecheck'], { cwd: mcpDir });
      io.log('+ npm run build');
      runCommand('npm', ['run', 'build'], { cwd: mcpDir });
    }
  } else {
    logSkippedGate(io, 'doctor:mcp-build', profile);
  }

  io.log('');
  io.log(`[summary] effective_warn=${effectiveWarns}`);
  if (strict && effectiveWarns > 0) {
    io.log('[fail] strict mode: warnings found');
    return { effectiveWarns, exitCode: 1 };
  }

  io.log('[ok] verify-aios complete');
  return { effectiveWarns, exitCode: 0 };
}
