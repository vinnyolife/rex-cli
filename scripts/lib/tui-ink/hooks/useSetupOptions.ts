// scripts/lib/tui-ink/hooks/useSetupOptions.ts

import { useState, useCallback } from 'react';
import type {
  AllOptions,
  CatalogSkill,
  InstalledSkills,
  Client,
  Scope,
  WrapMode,
  ComponentsConfig,
} from '../types';

const MODE_OPTIONS: WrapMode[] = ['all', 'repo-only', 'opt-in', 'off'];
const CLIENT_OPTIONS: Client[] = ['all', 'codex', 'claude', 'gemini', 'opencode'];
const SCOPE_OPTIONS: Scope[] = ['global', 'project'];

function cycle<T>(list: T[], current: T): T {
  const index = list.indexOf(current);
  return list[(index + 1) % list.length];
}

function getDefaultSelectedSkills(
  catalogSkills: CatalogSkill[],
  client: Client,
  scope: Scope
): string[] {
  return catalogSkills
    .filter(skill => client === 'all' || skill.clients.includes(client))
    .filter(skill => skill.scopes.includes(scope))
    .filter(skill => skill.defaultInstall?.[scope])
    .map(skill => skill.name);
}

export function useSetupOptions(
  catalogSkills: CatalogSkill[],
  installedSkills: InstalledSkills
) {
  const [options, setOptions] = useState<AllOptions>(() => ({
    setup: {
      components: { browser: true, shell: true, skills: true, superpowers: true },
      wrapMode: 'opt-in',
      scope: 'global',
      client: 'all',
      selectedSkills: getDefaultSelectedSkills(catalogSkills, 'all', 'global'),
      skipPlaywrightInstall: false,
      skipDoctor: false,
    },
    update: {
      components: { browser: true, shell: true, skills: true, superpowers: true },
      wrapMode: 'opt-in',
      scope: 'global',
      client: 'all',
      selectedSkills: getDefaultSelectedSkills(catalogSkills, 'all', 'global'),
      withPlaywrightInstall: false,
      skipDoctor: false,
    },
    uninstall: {
      components: { browser: false, shell: true, skills: true, superpowers: false },
      scope: 'global',
      client: 'all',
      selectedSkills: [],
    },
    doctor: {
      strict: false,
      globalSecurity: false,
    },
  }));

  const cycleWrapMode = useCallback((action: 'setup' | 'update') => {
    setOptions(prev => ({
      ...prev,
      [action]: {
        ...prev[action],
        wrapMode: cycle(MODE_OPTIONS, prev[action].wrapMode as WrapMode),
      },
    }));
  }, []);

  const cycleScope = useCallback((action: 'setup' | 'update' | 'uninstall') => {
    setOptions(prev => {
      const newScope = cycle(SCOPE_OPTIONS, prev[action].scope as Scope);
      const newSelectedSkills = action === 'uninstall'
        ? []
        : getDefaultSelectedSkills(catalogSkills, prev[action].client as Client, newScope);
      return {
        ...prev,
        [action]: {
          ...prev[action],
          scope: newScope,
          selectedSkills: newSelectedSkills,
        },
      };
    });
  }, [catalogSkills]);

  const cycleClient = useCallback((action: 'setup' | 'update' | 'uninstall') => {
    setOptions(prev => {
      const newClient = cycle(CLIENT_OPTIONS, prev[action].client as Client);
      const newSelectedSkills = action === 'uninstall'
        ? []
        : getDefaultSelectedSkills(catalogSkills, newClient, prev[action].scope as Scope);
      return {
        ...prev,
        [action]: {
          ...prev[action],
          client: newClient,
          selectedSkills: newSelectedSkills,
        },
      };
    });
  }, [catalogSkills]);

  const toggleComponent = useCallback(
    (action: 'setup' | 'update' | 'uninstall', component: keyof ComponentsConfig) => {
      setOptions(prev => {
        const prevComponents = prev[action].components as ComponentsConfig;
        const newComponents = {
          ...prevComponents,
          [component]: !prevComponents[component],
        };
        // Ensure at least one component selected for setup/update
        if ((action === 'setup' || action === 'update') &&
            !newComponents.browser && !newComponents.shell &&
            !newComponents.skills && !newComponents.superpowers) {
          newComponents.shell = true;
        }
        return {
          ...prev,
          [action]: { ...prev[action], components: newComponents },
        };
      });
    },
    []
  );

  const toggleSkipFlag = useCallback(
    (action: 'setup' | 'update' | 'doctor', flag: string) => {
      setOptions(prev => ({
        ...prev,
        [action]: {
          ...prev[action],
          [flag]: !(prev[action] as Record<string, unknown>)[flag],
        },
      }));
    },
    []
  );

  const setSelectedSkills = useCallback(
    (action: 'setup' | 'update' | 'uninstall', skills: string[]) => {
      setOptions(prev => ({
        ...prev,
        [action]: { ...prev[action], selectedSkills: skills },
      }));
    },
    []
  );

  return {
    options,
    cycleWrapMode,
    cycleScope,
    cycleClient,
    toggleComponent,
    toggleSkipFlag,
    setSelectedSkills,
  };
}