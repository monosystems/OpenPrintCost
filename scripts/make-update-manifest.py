#!/usr/bin/env python3
"""Build the updater manifest (`latest.json`) for a release.

The Tauri updater reads a static JSON manifest that maps `OS-ARCH` keys to the
download URL and the minisign signature of the updater artifact:

    {
      "version": "0.2.0",
      "notes": "...",
      "pub_date": "2026-10-24T07:00:00Z",
      "platforms": {
        "linux-x86_64":   { "url": "...", "signature": "..." },
        "windows-x86_64": { "url": "...", "signature": "..." },
        "darwin-x86_64":  { "url": "...", "signature": "..." }
      }
    }

The manifest is generated from the files attached to a release, so the URLs
are the release download links of those very assets — nothing is guessed.

Usage:

    ./scripts/make-update-manifest.py \
        --assets dist/release-assets \
        --version 0.2.0 \
        --tag v0.2.0 \
        --repo monosystems/OpenPrintCost \
        --notes-file /tmp/notes.md \
        --output latest.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone

# Artifact suffixes produced by `bundle.createUpdaterArtifacts` (Tauri v2).
APPIMAGE_SUFFIX = ".AppImage"
MACOS_SUFFIX = ".app.tar.gz"
NSIS_SUFFIX = "-setup.exe"
MSI_SUFFIX = ".msi"


def fail(message: str) -> "NoReturn":  # type: ignore[valid-type]
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def signature_of(artifact: pathlib.Path) -> str:
    """Content of the `.sig` file next to an updater artifact."""
    signature_file = artifact.with_name(artifact.name + ".sig")
    if not signature_file.is_file():
        fail(f"missing signature for {artifact.name} ({signature_file.name})")
    signature = signature_file.read_text(encoding="utf-8").strip()
    if not signature:
        fail(f"empty signature for {artifact.name}")
    return signature


def find(assets: list[pathlib.Path], predicate) -> list[pathlib.Path]:
    return sorted(path for path in assets if predicate(path.name))


def signed(assets: list[pathlib.Path], predicate, label: str) -> list[pathlib.Path]:
    """Artifacts matching the predicate that have a `.sig` next to them.

    A release can contain derivative copies — the stable-name AppImage for the
    Arch PKGBUILD, for example. Only the signed originals are updater
    artifacts; unsigned copies are ignored (and reported).
    """
    candidates = find(assets, predicate)
    result = [path for path in candidates if path.with_name(path.name + ".sig").is_file()]
    if candidates and not result:
        fail(f"missing signature for {candidates[0].name} ({candidates[0].name}.sig)")
    for ignored in candidates:
        if ignored not in result:
            print(f"note: ignoring {ignored.name} (no signature) — {label}")
    return result


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", required=True, type=pathlib.Path, help="directory with the release assets")
    parser.add_argument("--version", required=True, help="released version, e.g. 0.2.0")
    parser.add_argument("--tag", required=True, help="release tag, e.g. v0.2.0")
    parser.add_argument("--repo", required=True, help="owner/repository, e.g. monosystems/OpenPrintCost")
    parser.add_argument("--notes-file", type=pathlib.Path, help="file with the release notes (Markdown)")
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--pub-date", help="RFC 3339 timestamp (default: now, UTC)")
    args = parser.parse_args(argv[1:])

    if not args.assets.is_dir():
        fail(f"asset directory not found: {args.assets}")

    assets = [path for path in args.assets.iterdir() if path.is_file() and not path.name.endswith(".sig")]

    base_url = f"https://github.com/{args.repo}/releases/download/{args.tag}"
    platforms: dict[str, dict[str, str]] = {}

    def add(platform: str, artifact: pathlib.Path) -> None:
        platforms[platform] = {
            "url": f"{base_url}/{artifact.name}",
            "signature": signature_of(artifact),
        }

    # Linux — the AppImage is both the app bundle and the updater artifact.
    appimages = signed(assets, lambda name: name.endswith(APPIMAGE_SUFFIX), "linux")
    for artifact in appimages:
        arch = "aarch64" if "aarch64" in artifact.name else "x86_64"
        add(f"linux-{arch}", artifact)
    if not appimages:
        fail("no AppImage found — Linux updates would be missing from the manifest")

    # macOS — one .app.tar.gz. The release workflow builds a universal app,
    # which serves both architectures under the same URL and signature.
    macos = signed(assets, lambda name: name.endswith(MACOS_SUFFIX), "macos")
    if not macos:
        fail("no macOS .app.tar.gz found — macOS updates would be missing from the manifest")
    if len(macos) > 1:
        fail(f"expected one macOS artifact, found {len(macos)}: {[p.name for p in macos]}")
    for arch in ("aarch64", "x86_64"):
        add(f"darwin-{arch}", macos[0])

    # Windows — NSIS and MSI installs are updated by their own installer.
    # The specific keys win over the plain `windows-{arch}` fallback, which
    # stays as the entry for builds whose bundle type is unknown.
    nsis = signed(assets, lambda name: name.endswith(NSIS_SUFFIX), "windows-nsis")
    msi = signed(assets, lambda name: name.endswith(MSI_SUFFIX), "windows-msi")
    if not nsis and not msi:
        fail("no NSIS/MSI installer found — Windows updates would be missing from the manifest")
    if nsis:
        add("windows-x86_64-nsis", nsis[0])
    if msi:
        add("windows-x86_64-msi", msi[0])
    add("windows-x86_64", (nsis or msi)[0])

    notes = ""
    if args.notes_file:
        if not args.notes_file.is_file():
            fail(f"notes file not found: {args.notes_file}")
        notes = args.notes_file.read_text(encoding="utf-8").strip()

    pub_date = args.pub_date or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    manifest = {
        "version": args.version.lstrip("v"),
        "notes": notes,
        "pub_date": pub_date,
        "platforms": dict(sorted(platforms.items())),
    }

    args.output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {args.output} ({len(platforms)} platform(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
