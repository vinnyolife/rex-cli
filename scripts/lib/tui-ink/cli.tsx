#!/usr/bin/env npx tsx
// This file is the entry point for the TUI, run via tsx for TypeScript support
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import React from 'react';
import { render } from 'ink';
import { App } from './App';
import type { CatalogSkill, InstalledSkills, Client } from './types';

// ASCII art banner
const REX_CLI_BANNER = `
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   ██████╗ ██╗  ██╗██╗██████╗  ██████╗    ║
  ║   ██╔══██╗██║ ██╔╝██║██╔══██╗██╔════╝    ║
  ║   ██████╔╝█████╔╝ ██║██████╔╝██║         ║
  ║   ██╔══██╗██╔═██╗ ██║██╔══██╗██║         ║
  ║   ██║  ██║██║  ██╗██║██║  ██║╚██████╗    ║
  ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝    ║
  ║                                          ║
  ║          Hello, Rex CLI!                 ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
`;

function printBanner(): void {
  console.log('\x1b[36m' + REX_CLI_BANNER + '\x1b[0m'); // cyan color
}

const rootDir = process.env.AIOS_ROOT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectRoot = process.env.AIOS_PROJECT_ROOT || process.cwd();

function resolveCatalogPath(rootDir: string): string {
  return path.join(rootDir, 'config', 'skills-catalog.json');
}

function loadSkillsCatalog(rootDir: string): CatalogSkill[] {
  const catalogPath = resolveCatalogPath(rootDir);
  if (!fs.existsSync(catalogPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(catalogPath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data?.skills) ? data.skills : [];
  } catch {
    return [];
  }
}

function normalizePathForCompare(inputPath: string): string {
  let output = path.resolve(inputPath);
  try {
    output = fs.realpathSync(output);
  } catch {
    // Keep resolved path when target doesn't exist
  }
  return process.platform === 'win32' ? output.toLowerCase() : output;
}

function getClientHomes(): Record<Client, string> {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return {
    codex: path.join(home, '.codex'),
    claude: path.join(home, '.claude'),
    gemini: path.join(home, '.gemini'),
    opencode: path.join(home, '.opencode'),
    all: home,
  };
}

function collectInstalledSkills(
  rootDir: string,
  projectRoot: string,
  catalogSkills: CatalogSkill[]
): InstalledSkills {
  const homes = getClientHomes();
  const installedSkills: InstalledSkills = { global: {}, project: {} };
  const allowProjectInstallMarkers = normalizePathForCompare(projectRoot) !== normalizePathForCompare(rootDir);

  for (const skill of catalogSkills) {
    for (const client of Array.isArray(skill.clients) ? skill.clients : []) {
      const globalRoot = path.join(homes[client] || '', 'skills');
      const projectRootForClient = path.join(
        projectRoot,
        client === 'opencode' ? '.opencode/skills' : `.${client}/skills`
      );
      const globalPath = path.join(globalRoot, skill.name);
      const projectPath = path.join(projectRootForClient, skill.name);

      if (fs.existsSync(globalPath)) {
        installedSkills.global[client] = installedSkills.global[client] || [];
        installedSkills.global[client].push(skill.name);
      }
      if (allowProjectInstallMarkers && fs.existsSync(projectPath)) {
        installedSkills.project[client] = installedSkills.project[client] || [];
        installedSkills.project[client].push(skill.name);
      }
    }
  }

  return installedSkills;
}

export async function runInteractiveSession({
  rootDir,
  onRun,
}: {
  rootDir: string;
  onRun: (action: string, options: unknown) => Promise<void>;
}): Promise<void> {
  const catalogSkills = loadSkillsCatalog(rootDir);
  const installedSkills = collectInstalledSkills(rootDir, process.cwd(), catalogSkills);

  const handleRun = async (action: string, options: unknown) => {
    await onRun(action, options);
  };

  const { waitUntilExit } = render(
    React.createElement(App, {
      rootDir,
      catalogSkills,
      installedSkills,
      onRun: handleRun,
    })
  );

  await waitUntilExit();
}

// Main entry point when run directly
async function main() {
  // Print welcome banner first
  printBanner();

  const onRun = async (action: string, options: unknown) => {
    // Import lifecycle modules
    if (action === 'setup') {
      const { runSetup } = await import('../lifecycle/setup.mjs');
      await runSetup(options, { rootDir, projectRoot });
    } else if (action === 'update') {
      const { runUpdate } = await import('../lifecycle/update.mjs');
      await runUpdate(options, { rootDir, projectRoot });
    } else if (action === 'uninstall') {
      const { runUninstall } = await import('../lifecycle/uninstall.mjs');
      await runUninstall(options, { rootDir, projectRoot });
    } else if (action === 'doctor') {
      const { runDoctor } = await import('../lifecycle/doctor.mjs');
      await runDoctor(options, { rootDir });
    } else {
      console.log(`Unknown action: ${action}`);
    }
  };

  await runInteractiveSession({ rootDir, onRun });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});