# Browser Doctor Auto-Heal (ROI batch)

Date: 2026-04-06  
Scope: `doctor` browser gate + internal browser doctor command surface

## Objective

Reduce manual ops loops when `profiles.default.cdpPort` is configured but unreachable by allowing doctor to self-heal with one flag.

## Design

1. Extend `internal browser doctor` to accept `--fix` (and existing `--dry-run`) from CLI parsing.
2. Wire `--fix/--dry-run` through:
   - `scripts/aios.mjs` internal browser doctor execution
   - aggregate doctor browser gate (`runDoctorSuite`)
3. In `doctorBrowserMcp`:
   - when default `cdpPort` is unreachable and `--fix` is enabled, attempt `cdp-start`;
   - re-check port reachability;
   - count warning as effective only if still unresolved.
4. Keep non-fix mode behavior unchanged.

## Verification Plan

1. CLI parse test for `internal browser doctor --fix --dry-run`.
2. Browser doctor unit tests:
   - fix success path (`auto-healed`)
   - dry-run planning path (`[plan] ...`, no service start)
3. Full script test suite + strict doctor.
