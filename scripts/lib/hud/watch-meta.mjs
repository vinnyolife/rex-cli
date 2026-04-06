function normalizeIntervalMs(value, fallback = 1000) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function resolveDataSourceIso(state = {}) {
  const dispatchTs = String(state?.latestDispatch?.persistedAt || '').trim();
  if (dispatchTs) return dispatchTs;
  const sessionTs = String(state?.session?.updatedAt || '').trim();
  if (sessionTs) return sessionTs;
  return String(state?.generatedAt || '').trim();
}

function computeDataAgeMs(state = {}, nowMs = Date.now()) {
  const sourceIso = resolveDataSourceIso(state);
  const sourceMs = Date.parse(sourceIso);
  if (!Number.isFinite(sourceMs)) return null;
  return Math.max(0, Math.floor(nowMs - sourceMs));
}

export function buildWatchMeta(
  state,
  {
    renderIntervalMs = 1000,
    dataRefreshMs = 1000,
    fast = false,
    nowMs = Date.now(),
    ageBucketMs = 10_000,
  } = {},
) {
  const rawAge = computeDataAgeMs(state, nowMs);
  const bucket = normalizeIntervalMs(ageBucketMs, 10_000);
  const dataAgeMs = Number.isFinite(rawAge) ? Math.floor(rawAge / bucket) * bucket : null;
  return {
    renderIntervalMs: normalizeIntervalMs(renderIntervalMs, 1000),
    dataRefreshMs: normalizeIntervalMs(dataRefreshMs, 1000),
    fast: fast === true,
    dataAgeMs,
  };
}

