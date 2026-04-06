function parseBoolEnv(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function shouldAllowNonTtyWatch(env = process.env) {
  return parseBoolEnv(env?.CI, false);
}

function normalizeMinIntervalMs(value, fallback = 250) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(250, parsed) : Math.max(250, fallback);
}

function normalizeAdaptiveInterval(adaptiveInterval, fallbackMinIntervalMs = 250) {
  if (adaptiveInterval === false || adaptiveInterval === null || adaptiveInterval === undefined) {
    return null;
  }

  const source = adaptiveInterval === true ? {} : adaptiveInterval;
  if (typeof source !== 'object') return null;
  if (source.enabled === false) return null;

  const minIntervalMs = normalizeMinIntervalMs(source.minIntervalMs, fallbackMinIntervalMs);
  const maxIntervalRaw = normalizeMinIntervalMs(source.maxIntervalMs, minIntervalMs);
  const maxIntervalMs = Math.max(minIntervalMs, maxIntervalRaw);
  const backoffMultiplier = Number.isFinite(source.backoffMultiplier) && source.backoffMultiplier > 1
    ? Number(source.backoffMultiplier)
    : 2;

  return {
    minIntervalMs,
    maxIntervalMs,
    backoffMultiplier,
  };
}

export function computeAdaptiveNextIntervalMs(
  currentIntervalMs,
  {
    changed = false,
    minIntervalMs = 250,
    maxIntervalMs = 2000,
    backoffMultiplier = 2,
  } = {},
) {
  const minInterval = normalizeMinIntervalMs(minIntervalMs, 250);
  const maxInterval = Math.max(minInterval, normalizeMinIntervalMs(maxIntervalMs, minInterval));
  if (changed) {
    return minInterval;
  }

  const current = Number.isFinite(currentIntervalMs)
    ? Math.min(maxInterval, Math.max(minInterval, Math.floor(currentIntervalMs)))
    : minInterval;
  const multiplier = Number.isFinite(backoffMultiplier) && backoffMultiplier > 1
    ? Number(backoffMultiplier)
    : 2;
  const next = Math.floor(current * multiplier);
  return Math.min(maxInterval, Math.max(minInterval, next));
}

export function createThrottledWatchRender(
  render,
  {
    minIntervalMs = 1000,
    nowFn = () => Date.now(),
  } = {},
) {
  if (typeof render !== 'function') {
    throw new Error('createThrottledWatchRender requires a render() function');
  }

  const minInterval = Number.isFinite(minIntervalMs) ? Math.max(1, Math.floor(minIntervalMs)) : 1000;
  let hasValue = false;
  let lastOutput = '';
  let lastRefreshAt = 0;
  let inFlight = null;

  const refresh = async () => {
    const output = await render();
    lastOutput = String(output || '');
    hasValue = true;
    lastRefreshAt = nowFn();
    return lastOutput;
  };

  return async () => {
    const now = nowFn();
    if (hasValue && now - lastRefreshAt < minInterval) {
      return lastOutput;
    }

    if (inFlight) {
      return await inFlight;
    }

    inFlight = refresh();
    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  };
}

export async function watchRenderLoop(
  render,
  {
    intervalMs = 1000,
    adaptiveInterval = null,
    isTTY = Boolean(process.stdout.isTTY),
    env = process.env,
    writeStdout = (text) => process.stdout.write(text),
    writeStderr = (text) => process.stderr.write(text),
    registerSigint = (handler) => process.on('SIGINT', handler),
    setIntervalFn = (handler, ms) => setInterval(handler, ms),
    clearIntervalFn = (timer) => clearInterval(timer),
    setTimeoutFn = (handler, ms) => setTimeout(handler, ms),
    clearTimeoutFn = (timer) => clearTimeout(timer),
  } = {},
) {
  if (typeof render !== 'function') {
    throw new Error('watchRenderLoop requires a render() function');
  }

  const interval = Number.isFinite(intervalMs) ? Math.max(250, Math.floor(intervalMs)) : 1000;
  const adaptive = normalizeAdaptiveInterval(adaptiveInterval, interval);
  if (!isTTY && !shouldAllowNonTtyWatch(env)) {
    writeStderr('Watch mode requires a TTY (or CI=1).\n');
    process.exitCode = 1;
    return;
  }

  writeStdout('\x1b[?25l');

  let firstRender = true;
  let lastOutput = null;
  let inFlight = false;
  let queued = false;
  let stopped = false;
  let timer;
  let resolveDone = () => {};
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  let currentAdaptiveInterval = adaptive ? adaptive.minIntervalMs : interval;
  const clearTimer = adaptive ? clearTimeoutFn : clearIntervalFn;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimer(timer);
    writeStdout('\x1b[?25h\x1b[2J\x1b[H');
    resolveDone();
  };

  const renderTick = async () => {
    if (stopped) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;

    try {
      const output = await render();
      const rendered = String(output || '');
      const shouldRedraw = firstRender || rendered !== lastOutput;

      if (shouldRedraw) {
        if (firstRender) {
          writeStdout('\x1b[2J\x1b[H');
          firstRender = false;
        } else {
          writeStdout('\x1b[H');
        }
        writeStdout(rendered + '\x1b[K\n\x1b[J');
        lastOutput = rendered;
      }

      if (adaptive) {
        currentAdaptiveInterval = computeAdaptiveNextIntervalMs(currentAdaptiveInterval, {
          changed: shouldRedraw,
          minIntervalMs: adaptive.minIntervalMs,
          maxIntervalMs: adaptive.maxIntervalMs,
          backoffMultiplier: adaptive.backoffMultiplier,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeStderr(`Watch render failed: ${message}\n`);
      process.exitCode = 1;
      stop();
    } finally {
      inFlight = false;
    }

    if (queued) {
      queued = false;
      await renderTick();
    }
  };

  registerSigint(stop);
  if (adaptive) {
    const scheduleAdaptiveTick = () => {
      if (stopped) return;
      timer = setTimeoutFn(() => {
        void renderTick().then(() => {
          scheduleAdaptiveTick();
        });
      }, currentAdaptiveInterval);
    };
    await renderTick();
    if (!stopped) {
      scheduleAdaptiveTick();
      await done;
    }
    return;
  } else {
    timer = setIntervalFn(() => {
      void renderTick();
    }, interval);
  }

  await renderTick();
  if (!stopped) {
    await done;
  }
}
