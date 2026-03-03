# ContextDB transparent command wrappers for zsh.
# Source this file in ~/.zshrc to make codex/claude/gemini auto-load context packets
# when current directory is a repo containing scripts/ctx-agent.sh.
#
# Optional overrides:
# - ROOTPATH: prefer this repo root for wrapper routing
# - CTXDB_RUNNER: explicit runner path (highest priority)
# - CTXDB_REPO_NAME: explicit project name (optional)

typeset -g CTXDB_LAST_ROOT=""

_ctxdb_find_repo_root() {
  local rootpath="${ROOTPATH:-}"

  if [[ -n "$rootpath" ]] && [[ -x "$rootpath/scripts/ctx-agent.sh" ]]; then
    case "$PWD/" in
      "$rootpath"/|"$rootpath"/*)
        printf '%s\n' "$rootpath"
        return 0
      ;;
    esac
  fi

  local git_root=""
  git_root="$(command git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$git_root" ]] && [[ -x "$git_root/scripts/ctx-agent.sh" ]]; then
    printf '%s\n' "$git_root"
    return 0
  fi

  return 1
}

_ctxdb_cmd_in_list() {
  local needle="$1"
  shift
  local item=""
  for item in "$@"; do
    if [[ "$needle" == "$item" ]]; then
      return 0
    fi
  done
  return 1
}

_ctxdb_should_wrap_codex() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    exec review login logout mcp mcp-server app-server app completion sandbox debug apply resume fork cloud features help \
    -h --help -V --version && return 1
  return 0
}

_ctxdb_should_wrap_claude() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    agents auth doctor install mcp plugin setup-token update upgrade \
    -h --help -v --version && return 1
  return 0
}

_ctxdb_should_wrap_gemini() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    mcp extensions skills hooks \
    -h --help -v --version && return 1
  return 0
}

_ctxdb_run_or_passthrough() {
  local agent="$1"
  shift
  local passthrough="$1"
  shift

  local root=""
  root="$(_ctxdb_find_repo_root || true)"
  if [[ -z "$root" ]]; then
    command "$passthrough" "$@"
    return $?
  fi

  local runner="${CTXDB_RUNNER:-$root/scripts/ctx-agent.sh}"
  if [[ ! -x "$runner" ]]; then
    command "$passthrough" "$@"
    return $?
  fi

  local project="${CTXDB_REPO_NAME:-${root:t}}"
  CTXDB_LAST_ROOT="$root"
  "$runner" --agent "$agent" --project "$project" -- "$@"
}

codex() {
  if ! _ctxdb_should_wrap_codex "${1:-}"; then
    command codex "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough codex-cli codex "$@"
}

claude() {
  if ! _ctxdb_should_wrap_claude "${1:-}"; then
    command claude "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough claude-code claude "$@"
}

gemini() {
  if ! _ctxdb_should_wrap_gemini "${1:-}"; then
    command gemini "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough gemini-cli gemini "$@"
}
