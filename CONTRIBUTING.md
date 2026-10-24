# Contributing to OpenPrintCost

Thanks for your interest! This guide summarizes how to contribute effectively.
When in doubt: open an issue — better to ask once too often than to silently
build in the wrong direction.

## Before you start

For larger changes, please **open an issue first** and briefly outline what
you plan to do. This avoids duplicate work and design breaks. Small fixes
(typos, docs) can go directly as a PR.

## Development environment

Prerequisites: stable Rust toolchain (see `rust-toolchain.toml`), Node.js 22+,
and for the Tauri build the system libraries from the
[README](README.md) (Ubuntu: `libwebkit2gtk-4.1-dev libgtk-3-dev
librsvg2-dev libayatana-appindicator3-dev libssl-dev`).

```bash
git clone https://github.com/monosystems/OpenPrintCost
cd OpenPrintCost
npm install

# Fast iteration without a Tauri binary (mock instead of backend):
VITE_MOCK_API=1 npm run dev
```

### Desktop app and packages

The Tauri CLI is a dev dependency (`@tauri-apps/cli`) — no global install
needed:

```bash
npm run dev:app       # desktop app in dev mode (Tauri + Vite)
npm run build:app     # installable packages (deb, AppImage, msi, exe, dmg)
npm run bundle:debug  # same, but debug profile — fast packaging smoke test
```

On Linux the bundling additionally needs `libfuse2 file patchelf`. The
`bundle.yml` workflow builds the same bundle targets on Linux, Windows, and
macOS for every packaging-relevant change — if a package breaks, CI shows it
before a tag is cut.

### Logo assets

The master artwork is `OpenPrintCost 3D-Druck-Kostenlogo.png` in the repo root.
All derived assets are generated from it — never edit the derived files by
hand:

```bash
python3 scripts/make-logo-assets.py        # needs Pillow
npx tauri icon -o src-tauri/icons src-tauri/icons/icon-source.png
```

This regenerates `src/assets/logo.png` (full logo), `src/assets/logo-mark.png`
(symbol only, used in the app header), `public/favicon.png` (copy of the mark)
and the desktop icons in `src-tauri/icons/`.

## Gates — before every commit

Frontend (repo root):

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Rust (repo root, `cargo` via `export PATH="$HOME/.cargo/bin:$PATH"` if needed):

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
```

The Tauri crate (`-p openprintcost`) only builds **with** the system
libraries; without them that is not your fault — CI covers it (job `tauri`).
If you have Docker, the `Dockerfile` provides a complete environment
(Node.js 22, stable Rust, webview libraries):

```bash
docker build -t openprintcost-build .
docker run --rm openprintcost-build
```

## Rules that always apply

* **No `unwrap`/`expect` in production paths** — errors are `Result`
  (`CalcError`, `StoreError`, `IoError`, `ExportError`, `AdapterError`).
  Tests and doc examples may use `expect`.
* **Money is always `Decimal`**, serialized as string. `f64` only for
  physical measurements, with explicit conversion at the boundary.
* **`opc-core`, `opc-io` and `opc-export` stay pure** — no IO, no clock,
  no global state. Anything needing clock/IO belongs in the shell
  (`src-tauri`) or the adapter.
* **No Tauri imports outside `src/api/tauriAdapter.ts`** —
  verifiable via `grep -rn "@tauri-apps" src --include="*.tsx" | grep -v tauriAdapter.ts`
  (must be empty).
* **UI strings only in `src/i18n/`** (`en.ts`, `de.ts`). No hardcoded
  user-facing strings in components (verifiable via grep); tests may use
  text for querying.
* **Adding a language:** create `src/i18n/<code>.ts` with the `Strings`
  shape, register it in `src/i18n/locales.ts` (`LOCALE_LABELS`) and in the
  `dictionaries` map in `src/i18n/LanguageContext.tsx`. The compiler then
  enforces a complete, matching dictionary.
* **Migrations are never modified**, only appended (`crates/opc-store/
  src/sqlite/migrations/` + entry in `migrations.rs`).
* New commands in `src-tauri` require: registration in `lib.rs`,
  adapter method in `platform.ts` + `tauriAdapter.ts` + `mockAdapter.ts`
  and a Vitest covering the mock path.

## Commit style

Short, imperative subject lines with scope prefix, **in English** — the
subject becomes a changelog entry:

* `feat(store): …` — new behavior
* `fix(io): …` — bug fix
* `chore(deps): …` — dependencies
* `docs(spec): …` — specification/documentation
* `test(frontend): …` — tests only

One commit = one topic. Spec changes and the corresponding implementation
may be committed separately.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/1.1.0/).
**The changelog is written in English** — it is part of the public,
international surface of the project (the GitHub releases use it verbatim).

The `[Unreleased]` section is **generated** from the commit history with
[git-cliff](https://git-cliff.org) (config: `cliff.toml`) — the commits are
read as Conventional Commits (`feat(store): …`, `fix(io): …`), which the
commit style above already provides. Only the subject line ends up in the
changelog, so **the subject must be English**; the commit body may be German.

```bash
# Refresh the [Unreleased] section from the commits since the last tag.
./scripts/update-changelog.py unreleased

# Freeze it: [Unreleased] becomes [0.2.0] — date, a new [Unreleased] starts.
./scripts/update-changelog.py release 0.2.0
```

* The CI workflow `.github/workflows/changelog.yml` runs `unreleased` after
  every push to `main` and commits the result.
* Only the part between `<!-- changelog:unreleased:start -->` and
  `<!-- changelog:unreleased:end -->` is regenerated. Notes written by hand
  outside the markers are kept.
* Released sections are never touched by the automation — they are frozen
  with `release` and stay under version control.
* git-cliff is needed locally (`brew install git-cliff`,
  `cargo install git-cliff`, or a release binary — see
  <https://git-cliff.org/docs/installation>). In CI it is installed by the
  workflow.

The GitHub release notes are the section of the released version, copied from
`CHANGELOG.md` by `.github/workflows/release.yml`. A release without a
changelog section is refused — the release notes are never invented.

## Pull requests

* Description: what, why, how verified (list gates).
* Checklist (see PR template): gates green, no new warnings,
  spec updated (if technically relevant), no scope creep.
* Review: at least one maintainer takes a look; technical doubts are
  discussed in the PR, not afterwards.

## Releases (maintainers)

1. Set the version: `./scripts/set-version.sh 0.2.0`. It writes all
   version sources (workspace `Cargo.toml`, `package.json`,
   `src-tauri/tauri.conf.json`) and verifies them.
2. Freeze the changelog: `./scripts/update-changelog.py release 0.2.0`.
   It moves the `[Unreleased]` section to the new version, adds the release
   date and starts a new `[Unreleased]` section.
3. Commit, tag (`git tag v0.2.0`), push (`git push --tags`).
4. The release workflow (`.github/workflows/release.yml`) builds `.deb`,
   AppImage, `.msi` and `.dmg` and attaches them to the GitHub Release.
   It fails if the tag and the version sources disagree, or if
   `CHANGELOG.md` has no section for the released version.
5. Write release notes: what is new, what broke, thanks to contributors.
   The section from `CHANGELOG.md` is used as the base and can be edited in
   the GitHub release afterwards.

`./scripts/check-version.sh` compares all version sources with each other
(CI runs it on every push) — it is the only place that knows where the
version lives.

### Signing keys and updates

The in-app updater (`tauri-plugin-updater`) verifies every downloaded package
with a minisign signature. The key pair lives **outside** the repository:

| Part | Where |
|---|---|
| Private key | `~/.tauri/openprintcost-updater.key` and the repository secret `TAURI_SIGNING_PRIVATE_KEY` |
| Public key | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |

**Losing the private key means installed copies can never be updated again.**
Back it up offline; never commit it (`*.key` is ignored as a safety net).

The updater artifacts are only built for releases: `tauri.conf.json` keeps
`createUpdaterArtifacts` off so that normal builds and the bundle check need
no key. The release workflow merges `src-tauri/tauri.updater.conf.json` into
the build (`--config`). To reproduce a release build locally:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/openprintcost-updater.key)"
npm run build:app -- --config src-tauri/tauri.updater.conf.json --bundles appimage
```

`latest.json` — the manifest installed apps poll — is generated by the
`update-manifest` job from the uploaded artifacts
(`scripts/make-update-manifest.py`) and attached to the release. It contains
one entry per platform (`linux-x86_64`, `windows-x86_64`,
`darwin-aarch64`/`darwin-x86_64`) with URL and signature.

The update path can only be tested across **two** releases: install version
N, publish N+1, then use "Check for updates" in Settings. A fresh build of
the current version has nothing to update from.

## Version policy

The version follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
For an app, what versioning protects is not code but these four surfaces:

1. the **calculation result** (amounts and group labels users quote),
2. the **saved calculation document** (JSON in SQLite),
3. the **export layout** (PDF report, Excel workbook),
4. the **database schema** (migrated internally, append-only).

| Change | Bump |
|---|---|
| Bug fix, no behaviour change | `0.1.x` → `0.1.y` |
| New feature that does not change existing results, documents, or exports | `0.1.x` → `0.2.0` |
| Changed formula semantics, result groups, document format, or export layout | `0.x.y` → `0.(x+1).0` |
| Contract frozen, artifacts verified on all platforms, real-world validated | → `1.0.0` |

Until `1.0.0` the *interface* is stable, not the numbers: the `0.x` line
allows formula corrections, which change results without changing the UI.

## Code of conduct

Be factual, precise, and respectful. Technical correctness beats
politeness phrases — but never at the expense of people. Anyone who demeans
others or blocks contributions instead of improving them is in the wrong
place here. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
