# AIOS Runtime Manifest Spec — Design

**Date:** 2026-03-10  
**Status:** Approved for implementation

## Goal

Externalize the dispatch runtime catalog into a declarative spec so future runtime adapters can share one stable assembly path.

## Problem

The runtime boundary now exists in code, but the runtime catalog still lives as hard-coded definitions in `orchestrator-runtimes.mjs`.
That is acceptable with one runtime, but it makes the next runtime adapter more invasive than necessary because the contract and the catalog are not yet separated.

## Scope

This slice adds:

- one declarative runtime spec under `memory/specs/`,
- runtime registry loading from that spec,
- additive runtime metadata such as `manifestVersion`,
- tests that prove the registry is sourced from the manifest contract.

This slice does not:

- add a second runtime,
- change runtime selection behavior,
- introduce real model execution,
- move execution logic out of the current runtime adapter implementation.

## Design

Mirror the executor manifest pattern.

Add:

- `memory/specs/orchestrator-runtimes.json`

The runtime registry module should import this spec, normalize it into an immutable catalog, and keep all execution logic in code.

The manifest should describe only stable runtime metadata:

- `label`
- `description`
- `requiresModel`
- `executionModes`

The registry should enrich each runtime with:

- `id`
- `manifestVersion`
- runtime adapter `execute(...)`

## Why This Layer Matters

This keeps future runtime growth additive:

- add manifest entry,
- add adapter implementation,
- wire registry resolution,
- keep `dispatchPlan` unchanged.

That is the same successful pattern already used for local executors.

## Success Criteria

This slice succeeds when:

- runtime metadata is loaded from a spec file,
- `listDispatchRuntimes()` and `getDispatchRuntime()` include `manifestVersion`,
- the local runtime behavior stays unchanged,
- future runtime additions can reuse the same manifest/registry contract.
