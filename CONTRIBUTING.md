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
If you have Docker, you can check locally:

```bash
docker run --rm -v "$PWD":/app -v ~/.cache/opc-tauri-target:/app/target \
  <image-with-webkit2gtk> bash -lc \
  "cd /app && export PATH=/root/.cargo/bin:\$PATH && \
   cargo clippy -p openprintcost --all-targets --locked -- -D warnings && \
   cargo build -p openprintcost --locked"
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

Short, imperative subject lines with scope prefix:

* `feat(store): …` — new behavior
* `fix(io): …` — bug fix
* `chore(deps): …` — dependencies
* `docs(spec): …` — specification/documentation
* `test(frontend): …` — tests only

One commit = one topic. Spec changes and the corresponding implementation
may be committed separately.

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
2. Move the `[Unreleased]` section of `CHANGELOG.md` to the new version
   and add the release date.
3. Commit, tag (`git tag v0.2.0`), push (`git push --tags`).
4. The release workflow (`.github/workflows/release.yml`) builds `.deb`,
   AppImage, `.msi` and `.dmg` and attaches them to the GitHub Release.
   It fails if the tag and the version sources disagree.
5. Write release notes: what is new, what broke, thanks to contributors.

`./scripts/check-version.sh` compares all version sources with each other
(CI runs it on every push) — it is the only place that knows where the
version lives.

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
