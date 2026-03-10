import runtimeSpec from '../../../memory/specs/orchestrator-runtimes.json' with { type: 'json' };
import { executeLocalDispatchPlan } from './orchestrator.mjs';

export const LOCAL_DRY_RUN_RUNTIME = 'local-dry-run';
export const SUBAGENT_RUNTIME = 'subagent-runtime';

const DISPATCH_RUNTIME_CATALOG = Object.freeze(
  Object.fromEntries(
    Object.entries(runtimeSpec.runtimes || {}).map(([id, definition]) => [
      id,
      Object.freeze({
        id,
        manifestVersion: runtimeSpec.schemaVersion || 1,
        label: String(definition.label || id),
        description: String(definition.description || ''),
        requiresModel: definition.requiresModel === true,
        executionModes: Object.freeze(Array.isArray(definition.executionModes) ? [...definition.executionModes] : []),
      }),
    ])
  )
);

function cloneDispatchRuntime(definition) {
  return {
    ...definition,
    executionModes: [...definition.executionModes],
  };
}

export function normalizeDispatchRuntimeResult(result, runtime, executionMode) {
  if (!result || typeof result !== 'object') {
    throw new Error(`Dispatch runtime ${runtime.id} returned an invalid result`);
  }
  if (!Array.isArray(result.jobRuns)) {
    throw new Error(`Dispatch runtime ${runtime.id} returned invalid jobRuns`);
  }

  const mode = String(result.mode || executionMode || '').trim();
  if (mode !== executionMode) {
    throw new Error(`Dispatch runtime ${runtime.id} returned incompatible mode: ${mode || '(missing)'}`);
  }

  return {
    ...result,
    runtime: {
      id: runtime.id,
      manifestVersion: runtime.manifestVersion,
      label: runtime.label,
      description: runtime.description,
      requiresModel: runtime.requiresModel,
      executionMode,
    },
  };
}

export function listDispatchRuntimes() {
  return Object.values(DISPATCH_RUNTIME_CATALOG).map((definition) => cloneDispatchRuntime(definition));
}

export function getDispatchRuntime(runtimeId = LOCAL_DRY_RUN_RUNTIME) {
  const key = String(runtimeId || '').trim();
  const definition = DISPATCH_RUNTIME_CATALOG[key];
  if (!definition) {
    throw new Error(`Unknown dispatch runtime: ${runtimeId}`);
  }
  return cloneDispatchRuntime(definition);
}

export function selectDispatchRuntime({ executionMode = 'none' } = {}) {
  const mode = String(executionMode || 'none').trim();
  if (mode === 'dry-run') {
    return LOCAL_DRY_RUN_RUNTIME;
  }
  if (mode === 'live') {
    return SUBAGENT_RUNTIME;
  }
  throw new Error(`No dispatch runtime available for execution mode: ${mode}`);
}

export function createDispatchRuntimeRegistry({ executeDryRunPlan = executeLocalDispatchPlan } = {}) {
  if (typeof executeDryRunPlan !== 'function') {
    throw new Error('createDispatchRuntimeRegistry requires executeDryRunPlan');
  }

  const registry = {};

  for (const runtime of listDispatchRuntimes()) {
    if (runtime.id === LOCAL_DRY_RUN_RUNTIME) {
      registry[LOCAL_DRY_RUN_RUNTIME] = {
        ...runtime,
        execute({ plan, dispatchPlan, dispatchPolicy, io, env } = {}) {
          const result = executeDryRunPlan(plan, dispatchPlan, { dispatchPolicy, io, env });
          return normalizeDispatchRuntimeResult(result, runtime, 'dry-run');
        },
      };
      continue;
    }

    registry[runtime.id] = {
      ...runtime,
      execute() {
        throw new Error(`Dispatch runtime ${runtime.id} is not implemented yet.`);
      },
    };
  }

  if (!registry[LOCAL_DRY_RUN_RUNTIME]) {
    throw new Error(`Runtime manifest missing required runtime: ${LOCAL_DRY_RUN_RUNTIME}`);
  }

  return registry;
}

export function resolveDispatchRuntime({ runtimeId = '', executionMode = 'none' } = {}, registry = {}) {
  const selectedRuntimeId = String(runtimeId || '').trim() || selectDispatchRuntime({ executionMode });
  const runtime = registry[selectedRuntimeId];

  if (!runtime) {
    throw new Error(`Unknown dispatch runtime: ${selectedRuntimeId}`);
  }

  if (!Array.isArray(runtime.executionModes) || !runtime.executionModes.includes(executionMode)) {
    throw new Error(`Dispatch runtime ${selectedRuntimeId} does not support execution mode: ${executionMode}`);
  }

  return runtime;
}
