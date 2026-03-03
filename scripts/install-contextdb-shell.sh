#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RC_FILE="${ZDOTDIR:-$HOME}/.zshrc"
BEGIN_MARK="# >>> contextdb-shell >>>"
END_MARK="# <<< contextdb-shell <<<"
BLOCK="$(cat <<EOF
$BEGIN_MARK
export ROOTPATH="\${ROOTPATH:-$ROOT_DIR}"
if [[ -f "\$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "\$ROOTPATH/scripts/contextdb-shell.zsh"
fi
$END_MARK
EOF
)"

if [[ ! -f "$RC_FILE" ]]; then
  touch "$RC_FILE"
fi

TMP_CLEAN="$(mktemp)"
awk '!($0 ~ /^source ".*\/scripts\/contextdb-shell\.zsh"$/)' "$RC_FILE" > "$TMP_CLEAN"
mv "$TMP_CLEAN" "$RC_FILE"

if grep -Fq "$BEGIN_MARK" "$RC_FILE"; then
  echo "Already installed ($BEGIN_MARK)."
else
  {
    echo ""
    echo "# ContextDB transparent CLI wrappers (codex/claude/gemini)"
    echo "$BLOCK"
  } >> "$RC_FILE"
  echo "Installed into $RC_FILE"
fi

echo "Run: source \"$RC_FILE\""
echo "Then direct commands in this repo auto-use contextdb: codex / claude / gemini"
