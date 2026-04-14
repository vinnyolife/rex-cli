# Release Health Alerting + Trend Signals + Env Thresholds

## Goal
Finish three follow-up iterations for release guard operations:
1. Real webhook alerting in scheduled release health watch.
2. Week-over-week trend fields and threshold alert fields in `release-status` outputs.
3. Environment-configurable release gate thresholds in `quality-gate`.

## Delivered
- Workflow `release-health-watch.yml` now supports optional webhook alerts:
  - Slack: `SLACK_WEBHOOK_URL`
  - Feishu: `FEISHU_WEBHOOK_URL`
  - Includes run URL + summary payload; keeps explicit failure on unhealthy gate.
- `release-status` now emits history trend signals:
  - Daily WoW deltas per row (`wowSamplesDelta`, `wowFailureRateDelta`, `wowFallbackRateDelta`)
  - Top-level `historySignals` with thresholds, metrics, and `alerts[]`.
  - CSV header extended with WoW delta columns; NDJSON includes new fields.
- `quality-gate` release check thresholds can be set per environment:
  - `AIOS_RELEASE_GATE_MIN_SAMPLES`
  - `AIOS_RELEASE_GATE_MAX_FAILURE_RATE`
  - `AIOS_RELEASE_GATE_MAX_FALLBACK_RATE`
  - Legacy aliases supported: `AIOS_RELEASE_MIN_SAMPLES`, `AIOS_RELEASE_MAX_FAILURE_RATE`, `AIOS_RELEASE_MAX_FALLBACK_RATE`.

## Tests Added/Updated
- `scripts/tests/aios-cli.test.mjs`
  - WoW + trend alert field assertions.
  - CSV/NDJSON extended history schema assertions.
- `scripts/tests/aios-harness.test.mjs`
  - Env override thresholds pass-path test.
  - Invalid env threshold fail-path test.

## Verification Evidence
- `node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-harness.test.mjs`
- `npm run test:scripts`
- `cd mcp-server && npm run typecheck && npm run test && npm run build`

All commands passed.
