import fs from 'node:fs';
import path from 'node:path';

export const NATIVE_SYNC_META_FILE = '.aios-native-sync.json';

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

export function resolveNativeMetadataPath(clientRoot) {
  return path.join(clientRoot, NATIVE_SYNC_META_FILE);
}

export function buildNativeSyncMetadata({
  client,
  tier,
  managedTargets = [],
  generatedAt = new Date().toISOString(),
  aiosVersion = '',
} = {}) {
  return {
    schemaVersion: 1,
    managedBy: 'aios',
    kind: 'native-sync',
    client: String(client || '').trim(),
    tier: String(tier || '').trim(),
    managedTargets: Array.isArray(managedTargets)
      ? managedTargets.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    generatedAt,
    aiosVersion: String(aiosVersion || '').trim(),
  };
}

export function readNativeSyncMetadata(clientRoot) {
  return readJsonIfExists(resolveNativeMetadataPath(clientRoot));
}

export function writeNativeSyncMetadata(clientRoot, payload) {
  writeJson(resolveNativeMetadataPath(clientRoot), payload);
}

export function removeNativeSyncMetadata(clientRoot) {
  fs.rmSync(resolveNativeMetadataPath(clientRoot), { force: true });
}
