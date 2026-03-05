# Rexcil Privacy Guard Implementation Plan

Date: 2026-03-05

## Goal

Add a user-controlled privacy guard under `~/.rexcil` so config-related file reads can be desensitized before being consumed by skills/automation.

## Scope

- `scripts/privacy-guard.mjs` (new)
- `scripts/install-privacy-guard.sh` (new)
- `scripts/setup-all.sh`
- `scripts/contextdb-shell.zsh`
- `docs-site/index.md`
- `docs-site/zh/index.md`
- `docs-site/getting-started.md`
- `docs-site/zh/getting-started.md`
- `README.md`
- `README-zh.md`
- `.codex/skills/security-scan/SKILL.md`
- `.claude/skills/security-scan/SKILL.md`

## Design

1. Config location and toggle
   - Use `~/.rexcil/privacy-guard.json` as default config path.
   - Allow override via `REXCIL_HOME` and `REXCIL_PRIVACY_CONFIG`.
   - Include `enabled`, `mode` (`regex|ollama|hybrid`), `ollama.model` (`qwen3.5:4b`), and config-file patterns.

2. Desensitization script
   - `scripts/privacy-guard.mjs`:
     - `init`: bootstrap config.
     - `status`: print effective config.
     - `set --enabled <true|false> --mode <...>`.
     - `redact --file <path>`: redact content via regex and optional ollama fallback.
   - Regex path handles common secrets (api key/token/password/private key/cookie/session).
   - Ollama path (`qwen3.5:4b`) is optional and degrades to regex if unavailable.

3. Setup integration and colored install hint
   - `scripts/setup-all.sh` invokes `install-privacy-guard.sh` when `shell` component is selected.
   - Print colored recommendation banner to enable privacy guard for sensitive config handling.

4. Skill workflow integration
   - Update `security-scan` skill docs (codex/claude) to run privacy guard redaction before reading risky config files.

5. Docs/homepage emphasis
   - Add homepage highlight for Privacy Guard feature.
   - Add quick-start snippet for enabling privacy guard and optional ollama mode.

## Verification

- `scripts/privacy-guard.mjs init --path /tmp/rexcil-test/privacy-guard.json`
- `scripts/privacy-guard.mjs status --path /tmp/rexcil-test/privacy-guard.json`
- Create sample file with mock secrets and verify `redact` output masks them.
- `source .venv-docs/bin/activate && mkdocs build --strict -f mkdocs.yml`
