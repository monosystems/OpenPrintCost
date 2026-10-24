#!/usr/bin/env python3
"""Keep the `[Unreleased]` section of CHANGELOG.md in sync with the commits.

Usage:

    ./scripts/update-changelog.py unreleased        # refresh [Unreleased]
    ./scripts/update-changelog.py release 0.2.0     # freeze it as 0.2.0

The commit list is generated with git-cliff (https://git-cliff.org) from the
Conventional Commits in the history. Released sections of CHANGELOG.md are
never touched by the automation — only the `[Unreleased]` section is
regenerated, and only between the two marker comments:

    ## [Unreleased]

    <!-- changelog:unreleased:start -->
    ... generated ...
    <!-- changelog:unreleased:end -->

Text outside the markers is preserved, so a maintainer can still add notes by
hand.

Requires git-cliff in PATH (or GIT_CLIFF_BIN pointing at the binary).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"

START_MARKER = "<!-- changelog:unreleased:start -->"
END_MARKER = "<!-- changelog:unreleased:end -->"
UNRELEASED_HEADER = "## [Unreleased]"

SECTION_RE = re.compile(r"^##\s")
HEADER_RE = re.compile(r"^##\s\[(?P<name>[^\]]+)\]")


def fail(message: str) -> "NoReturn":  # type: ignore[valid-type]
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def git_cliff() -> str:
    """Return the generated commit list for the commits since the last tag."""
    binary = os.environ.get("GIT_CLIFF_BIN", "git-cliff")
    try:
        result = subprocess.run(
            [binary, "--unreleased"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        fail(
            "git-cliff not found. Install it (https://git-cliff.org/docs/installation) "
            "or set GIT_CLIFF_BIN to the binary."
        )
    except subprocess.CalledProcessError as exc:
        fail(f"git-cliff failed:\n{exc.stderr.strip()}")
    return result.stdout.strip("\n")



def format_body(body: str) -> list[str]:
    """Normalize the generated list to Keep a Changelog spacing.

    One blank line after a group heading and before the next one; empty lines
    in between the entries are dropped.
    """
    content: list[str] = []
    for line in body.split("\n"):
        if not line.strip():
            continue
        if line.startswith("### "):
            if content:
                content.append("")
            content.append(line)
            content.append("")
        else:
            content.append(line)
    while content and not content[-1].strip():
        content.pop()
    return content


def section_bounds(lines: list[str], start: int) -> int:
    """Index of the first line after the section that starts at `start`."""
    for index in range(start + 1, len(lines)):
        if SECTION_RE.match(lines[index]):
            return index
    return len(lines)


def replace_unreleased(lines: list[str], body: str) -> list[str]:
    """Replace the generated part of the [Unreleased] section."""
    try:
        header_index = next(
            i for i, line in enumerate(lines) if line.strip() == UNRELEASED_HEADER
        )
    except StopIteration:
        fail(f"{CHANGELOG.name} has no '{UNRELEASED_HEADER}' section")

    end = section_bounds(lines, header_index)
    section = lines[header_index:end]

    try:
        start_index = next(i for i, line in enumerate(section) if line.strip() == START_MARKER)
        end_index = next(i for i, line in enumerate(section) if line.strip() == END_MARKER)
    except StopIteration:
        # No markers yet — create the section from scratch.
        section = [UNRELEASED_HEADER, "", START_MARKER, END_MARKER]
        start_index = 2
        end_index = 3

    content = format_body(body)
    section = (
        section[: start_index + 1]
        + content
        + section[end_index:]
    )
    return lines[:header_index] + normalize(section) + lines[end:]


def normalize(section: list[str]) -> list[str]:
    """Make sure the markers are surrounded by blank lines."""
    section = list(section)

    start_index = next(i for i, line in enumerate(section) if line.strip() == START_MARKER)
    if start_index > 0 and section[start_index - 1].strip():
        section.insert(start_index, "")

    end_index = next(i for i, line in enumerate(section) if line.strip() == END_MARKER)
    if end_index + 1 >= len(section):
        section.append("")
    elif section[end_index + 1].strip():
        section.insert(end_index + 1, "")
    return section


def release(lines: list[str], version: str) -> list[str]:
    """Turn [Unreleased] into the released version and start a new section."""
    try:
        header_index = next(
            i for i, line in enumerate(lines) if line.strip() == UNRELEASED_HEADER
        )
    except StopIteration:
        fail(f"{CHANGELOG.name} has no '{UNRELEASED_HEADER}' section")

    end = section_bounds(lines, header_index)
    section = lines[header_index:end]
    section[0] = f"## [{version}] — {date.today().isoformat()}"
    # The markers are only needed for the section that is still open.
    section = [line for line in section if line.strip() not in (START_MARKER, END_MARKER)]

    fresh = [
        UNRELEASED_HEADER,
        "",
        START_MARKER,
        END_MARKER,
        "",
    ]
    return lines[:header_index] + fresh + section + lines[end:]


def write(lines: list[str]) -> bool:
    text = "\n".join(lines).rstrip("\n") + "\n"
    if CHANGELOG.exists() and CHANGELOG.read_text(encoding="utf-8") == text:
        return False
    CHANGELOG.write_text(text, encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    command = argv[1]
    if command not in {"unreleased", "release"}:
        print(f"unknown command: {command}", file=sys.stderr)
        return 2
    if command == "release" and len(argv) < 3:
        fail("release needs a version, e.g. 'release 0.2.0'")

    if not CHANGELOG.exists():
        fail(f"{CHANGELOG} not found")

    lines = CHANGELOG.read_text(encoding="utf-8").split("\n")
    body = git_cliff()
    lines = replace_unreleased(lines, body)

    if command == "release":
        version = argv[2].lstrip("v")
        lines = release(lines, version)

    changed = write(lines)
    print("CHANGELOG.md updated" if changed else "CHANGELOG.md already up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
