#!/usr/bin/env bash
# Install token-usage-audit as an agent skill.
# Idempotent: re-running updates in place. Uses rsync --delete, never `cp -r`
# (which nests the directory on re-install).
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/token-usage-audit}"

command -v node >/dev/null 2>&1 || { echo "error: node is required (>= 18)"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "error: node >= 18 required (found $(node -v))"; exit 1; }

mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.DS_Store' \
  "$SRC"/ "$DEST"/

echo "installed to $DEST"
echo
echo "verify:"
echo "  node $DEST/scripts/audit.mjs --list-sources"
