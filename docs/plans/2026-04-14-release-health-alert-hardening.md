# Release Health Alert Hardening (WoW Env + Retry/Sign + Recovery/Dedupe)

## Goal
Finish the follow-up hardening bundle for release health operations:
1. Make WoW trend alert thresholds configurable via environment variables.
2. Upgrade release webhook dispatch with retry/backoff and optional request signatures.
3. Add alert dedupe and recovery notifications to reduce noisy repeated failures.

## Delivered
- `release-status` now resolves WoW trend warning thresholds from env vars:
  - `AIOS_RELEASE_TREND_WOW_FAILURE_DELTA_WARN` (primary)
  - `AIOS_RELEASE_TREND_WOW_FALLBACK_DELTA_WARN` (primary)
  - Legacy aliases retained:
    - `AIOS_RELEASE_WOW_FAILURE_RATE_DELTA_WARN`
    - `AIOS_RELEASE_WOW_FALLBACK_RATE_DELTA_WARN`
- `quality-gate` passes its effective env context through to `runReleaseStatus`, so env-driven release/trend policies remain deterministic in gate runs/tests.
- `release-health-watch` workflow now includes:
  - persisted alert state (`actions/cache restore/save`) across runs,
  - alert decision step with failure dedupe + periodic reminder + recovery detection,
  - webhook sender with retry/backoff + timeout,
  - optional HMAC headers (`x-aios-signature`, `x-aios-signature-timestamp`),
  - optional Feishu bot sign payload support.

## Alert Decision Rules
- Transition `healthy -> failed`: notify (`failure_open`).
- Failed fingerprint changed: notify (`failure_update`).
- Same failed fingerprint repeats: suppress unless streak reaches reminder interval (`failure_reminder`, default every 6 failures).
- Transition `failed -> healthy`: notify (`recovery`).

## New/Relevant Config
- Trend threshold envs (release-status):
  - `AIOS_RELEASE_TREND_WOW_FAILURE_DELTA_WARN`
  - `AIOS_RELEASE_TREND_WOW_FALLBACK_DELTA_WARN`
- Reminder cadence (workflow var):
  - `AIOS_RELEASE_ALERT_REMINDER_EVERY`
- Retry controls (workflow vars):
  - `AIOS_RELEASE_ALERT_MAX_ATTEMPTS`
  - `AIOS_RELEASE_ALERT_BASE_DELAY_MS`
  - `AIOS_RELEASE_ALERT_TIMEOUT_MS`
- Optional webhook signing secrets:
  - `ALERT_WEBHOOK_HMAC_SECRET`
  - `SLACK_WEBHOOK_HMAC_SECRET`
  - `FEISHU_WEBHOOK_HMAC_SECRET`
  - `FEISHU_WEBHOOK_SIGN_SECRET`

## Verification Plan
1. Targeted node tests:
   - `scripts/tests/aios-cli.test.mjs`
   - `scripts/tests/aios-harness.test.mjs`
2. Full scripts regression:
   - `npm run test:scripts`
3. MCP server verification:
   - `cd mcp-server && npm run typecheck && npm run test && npm run build`
