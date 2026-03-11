import { createHash } from 'node:crypto';
import path from 'node:path';

export const DEFAULT_WORKSPACE_MEMORY_SPACE = 'default';
export const WORKSPACE_MEMORY_AGENT = 'workspace-memory';
export const WORKSPACE_MEMORY_SESSION_PREFIX = 'workspace-memory--';

export function normalizeWorkspaceMemorySpace(raw) {
  const value = String(raw || '').trim();
  return value ? value : DEFAULT_WORKSPACE_MEMORY_SPACE;
}

export function sanitizeWorkspaceMemorySpaceForSessionId(space) {
  const trimmed = normalizeWorkspaceMemorySpace(space);
  const normalized = trimmed
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized) return normalized;
  const hash = createHash('sha256').update(trimmed, 'utf8').digest('hex').slice(0, 10);
  return `space-${hash}`;
}

export function workspaceMemorySessionId(space) {
  return `${WORKSPACE_MEMORY_SESSION_PREFIX}${sanitizeWorkspaceMemorySpaceForSessionId(space)}`;
}

export function workspaceMemoryStatePath(workspaceRoot) {
  return path.join(workspaceRoot, 'memory', 'context-db', '.workspace-memory.json');
}

export function workspaceMemorySessionDir(workspaceRoot, sessionId) {
  return path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId);
}

export function workspaceMemoryMetaPath(workspaceRoot, sessionId) {
  return path.join(workspaceMemorySessionDir(workspaceRoot, sessionId), 'meta.json');
}

export function workspaceMemoryPinnedPath(workspaceRoot, sessionId) {
  return path.join(workspaceMemorySessionDir(workspaceRoot, sessionId), 'pinned.md');
}

export function workspaceMemoryEventsPath(workspaceRoot, sessionId) {
  return path.join(workspaceMemorySessionDir(workspaceRoot, sessionId), 'l2-events.jsonl');
}
