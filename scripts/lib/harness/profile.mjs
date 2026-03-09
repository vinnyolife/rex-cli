export const HARNESS_PROFILE_NAMES = ['minimal', 'standard', 'strict'];
export const HARNESS_PROFILE_ENV = 'AIOS_HARNESS_PROFILE';
export const DISABLED_GATES_ENV = 'AIOS_DISABLED_GATES';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeHarnessProfile(raw = 'standard') {
  const value = normalizeId(raw || 'standard');
  if (!HARNESS_PROFILE_NAMES.includes(value)) {
    throw new Error(`--profile must be one of: ${HARNESS_PROFILE_NAMES.join(', ')}`);
  }
  return value;
}

export function getHarnessProfile(env = process.env) {
  return normalizeHarnessProfile(env[HARNESS_PROFILE_ENV] || 'standard');
}

export function getDisabledGateIds(env = process.env) {
  const raw = String(env[DISABLED_GATES_ENV] || '');
  if (!raw.trim()) return new Set();

  return new Set(
    raw
      .split(',')
      .map((item) => normalizeId(item))
      .filter(Boolean)
  );
}

export function parseGateProfiles(rawProfiles, fallback = HARNESS_PROFILE_NAMES) {
  if (!rawProfiles) return [...fallback];

  const values = Array.isArray(rawProfiles)
    ? rawProfiles
    : String(rawProfiles)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const normalized = values
    .map((item) => normalizeId(item))
    .filter((item) => HARNESS_PROFILE_NAMES.includes(item));

  return normalized.length > 0 ? normalized : [...fallback];
}

export function isHarnessGateEnabled(gateId, options = {}) {
  const id = normalizeId(gateId);
  if (!id) return true;

  const disabledGates = options.disabledGates instanceof Set
    ? options.disabledGates
    : getDisabledGateIds(options.env);
  if (disabledGates.has(id)) {
    return false;
  }

  const profile = options.profile
    ? normalizeHarnessProfile(options.profile)
    : getHarnessProfile(options.env);
  const allowedProfiles = parseGateProfiles(options.profiles);
  return allowedProfiles.includes(profile);
}
