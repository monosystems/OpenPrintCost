#!/usr/bin/env bash
#
# Verifies that all version sources agree.
#
#   ./scripts/check-version.sh           # all sources must match each other
#   ./scripts/check-version.sh 0.2.0     # ...and match the given version
#
# Used by CI (drift guard) and by the release workflow (tag guard).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cargo_version="$(awk '
  /^\[workspace\.package\]/ { in_pkg = 1; next }
  /^\[/ { in_pkg = 0 }
  in_pkg && /^version = / { gsub(/[" ]/, "", $0); sub(/^version=/, "", $0); print; exit }
' Cargo.toml)"

npm_version="$(node -p "require('./package.json').version")"
tauri_version="$(node -p "require('./src-tauri/tauri.conf.json').version")"

# The Tauri crate must inherit the workspace version, never carry its own.
if ! grep -q '^version\.workspace = true$' src-tauri/Cargo.toml; then
  echo "error: src-tauri/Cargo.toml must inherit the version (version.workspace = true)" >&2
  exit 1
fi

status=0
report() {
  local label="$1" value="$2"
  if [[ "$value" != "$cargo_version" ]]; then
    echo "error: $label is $value, expected $cargo_version" >&2
    status=1
  else
    echo "ok: $label = $value"
  fi
}

report "package.json" "$npm_version"
report "tauri.conf.json" "$tauri_version"

if [[ $# -ge 1 ]]; then
  expected="${1#v}"
  if [[ "$cargo_version" != "$expected" ]]; then
    echo "error: workspace version is $cargo_version, expected $expected" >&2
    status=1
  else
    echo "ok: workspace version = $cargo_version (matches expected $expected)"
  fi
fi

exit $status
