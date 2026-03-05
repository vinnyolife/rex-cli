#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENABLE="true"
MODE=""

usage() {
  cat <<USAGE
Usage:
  scripts/install-privacy-guard.sh [--enable] [--disable] [--mode <regex|ollama|hybrid>]

Options:
  --enable                  Enable privacy guard immediately after init (default)
  --disable                 Disable privacy guard after init
  --mode <value>            Initial mode (regex|ollama|hybrid)
  -h, --help                Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --enable)
      ENABLE="true"
      shift
      ;;
    --disable)
      ENABLE="false"
      shift
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Missing required command: node" >&2
  exit 1
fi

args=(init)
if [[ "$ENABLE" == "true" ]]; then
  args+=(--enable)
fi
if [[ -n "$MODE" ]]; then
  args+=(--mode "$MODE")
fi

echo "+ node \"$SCRIPT_DIR/privacy-guard.mjs\" ${args[*]}"
node "$SCRIPT_DIR/privacy-guard.mjs" "${args[@]}"

if [[ -n "${REXCIL_PRIVACY_CONFIG:-}" ]]; then
  config_path="${REXCIL_PRIVACY_CONFIG}"
elif [[ -n "${REXCIL_HOME:-}" ]]; then
  config_path="${REXCIL_HOME%/}/privacy-guard.json"
else
  config_path="$HOME/.rexcil/privacy-guard.json"
fi

if [[ -t 1 ]]; then
  c_blue='\033[1;34m'
  c_green='\033[1;32m'
  c_yellow='\033[1;33m'
  c_reset='\033[0m'
else
  c_blue=''
  c_green=''
  c_yellow=''
  c_reset=''
fi

echo ""
printf '%b\n' "${c_blue}================ Privacy Guard ================${c_reset}"
printf '%b\n' "${c_yellow}已默认启用隐私脱敏：命中 key/secret 的配置文件必须先走脱敏读取。${c_reset}"
printf '%b\n' "Config: ${c_green}${config_path}${c_reset}"
echo ""
echo "Strict status:"
echo "  aios privacy status"
echo "Strict read (required for config-like files):"
echo "  aios privacy read --file <path>"
echo ""
echo "Optional local LLM (Ollama + qwen3.5:4b):"
echo "  aios privacy ollama-on"
echo "  # equivalent: node \"$SCRIPT_DIR/privacy-guard.mjs\" set --mode hybrid --ollama-enabled true --model qwen3.5:4b"
echo ""
echo "If you must disable temporarily:"
echo "  aios privacy disable"
printf '%b\n' "${c_blue}===============================================${c_reset}"
