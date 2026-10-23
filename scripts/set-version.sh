#!/usr/bin/env bash
#
# Sets the OpenPrintCost version in every place that carries it.
#
#   ./scripts/set-version.sh 0.2.0
#
# Sources of truth:
#   - Cargo.toml              [workspace.package] version  (all Rust crates
#                             and the Tauri app inherit it)
#   - package.json            version                        (frontend)
#   - src-tauri/tauri.conf.json version                     (bundle metadata)
#
# src-tauri/Cargo.toml deliberately has no version of its own — it inherits
# from the workspace — so there is no fourth place to forget.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "usage: $0 <semver>   (e.g. 0.2.0 or 0.2.0-rc.1)" >&2
  exit 2
fi

# 1) Cargo.toml — only inside [workspace.package].
awk -v v="$VERSION" '
  /^\[workspace\.package\]/ { in_pkg = 1; print; next }
  /^\[/ { in_pkg = 0 }
  in_pkg && /^version = / { print "version = \"" v "\""; next }
  { print }
' Cargo.toml > Cargo.toml.tmp
mv Cargo.toml.tmp Cargo.toml

# 2) + 3) JSON manifests — surgical replacement, formatting is preserved.
for file in package.json src-tauri/tauri.conf.json; do
  if ! grep -q '"version": "' "$file"; then
    echo "error: no version field found in $file" >&2
    exit 1
  fi
  sed -i -E "0,/\"version\": \"[^\"]+\"/s//\"version\": \"$VERSION\"/" "$file"
done

# 4) Arch PKGBUILD (if present).
if [[ -f packaging/arch/PKGBUILD ]]; then
  sed -i -E "s/^pkgver=.*$/pkgver=$VERSION/" packaging/arch/PKGBUILD
fi

echo "version set to $VERSION"
./scripts/check-version.sh
