# AIOS Policy-Aware Dispatch DAG — Design

**Date:** 2026-03-09  
**Status:** Approved for implementation

## Goal

Make `dispatchPolicy.parallelism` affect the actual local dispatch DAG so orchestration output is not only descriptive but operationally consistent.

## Problem

AIOS now emits a structured `dispatchPolicy`, but `buildLocalDispatchPlan` still always constructs the same DAG:

- sequential `plan -> implement`
- parallel `review || security`
- synthetic `merge-gate`

That means a blocked policy can say `serial-only` while the emitted DAG still asks for parallel execution.

## Scope

This slice changes only local DAG construction:

- `serial-only` policy collapses grouped parallel phases into a sequential chain,
- `parallel-with-merge-gate` keeps the current DAG,
- text/JSON reports reflect the DAG that was actually chosen.

This slice does not:

- add real model execution,
- add new executors,
- change ContextDB schemas,
- auto-run gates or runbooks.

## Decision Rules

- Default remains `parallel-with-merge-gate` when no policy is present.
- When `dispatchPolicy.parallelism=serial-only`:
  - grouped parallel phases are emitted as sequential phase jobs,
  - `merge-gate` jobs for that group are omitted,
  - downstream dependencies point to the last sequentialized job.
- When `dispatchPolicy.parallelism=parallel-with-merge-gate`:
  - existing grouped parallel behavior remains unchanged.

## Rationale

This is the smallest change that turns policy into behavior.
It keeps the runtime local-only while giving future executor integration a truthful DAG to consume.
