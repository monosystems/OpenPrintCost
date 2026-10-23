<p align="center">
  <h1 align="center">OpenPrintCost</h1>
  <p align="center">
    Free, local-first cost calculator for 3D printing jobs.
    <br />
    Material · machine time · energy · labor · margin · tax — transparently itemized, exportable as PDF and Excel.
  </p>
  <p align="center">
    <a href="https://github.com/monosystems/OpenPrintCost/actions/workflows/ci.yml"><img src="https://github.com/monosystems/OpenPrintCost/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/monosystems/OpenPrintCost/releases"><img src="https://img.shields.io/github/v/release/monosystems/OpenPrintCost" alt="Release" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache-2.0" /></a>
  </p>
  <p align="center">
    <a href="https://github.com/monosystems/OpenPrintCost/releases"><strong>Download</strong></a>
    ·
    <a href="#quickstart">Quickstart</a>
    ·
    <a href="#how-it-works">How it works</a>
    ·
    <a href="#development">Development</a>
    ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</p>

## What is this?

OpenPrintCost answers one question: **what does a 3D print job really cost?**

You define printers, materials, work steps, and hourly rates once. Then, per
job, you import G-code or STL files, assign materials, add labor and
surcharges — and get an auditable breakdown per file and for the whole project,
including failure-rate costing, margin, and tax.

- **Local-first, no account.** No login, no license key, no network calls.
  Your data lives in a SQLite file in the app directory.
- **Exact money math.** All amounts are `Decimal` (never `f64`); rounding
  happens only for display. Amounts are stored as `TEXT` in SQLite.
- **Traceable.** Every position shows which file it came from; slicer time
  estimates and geometric fallbacks are distinguishable.
- **Free and open.** [Apache-2.0](LICENSE), commercial use allowed.

> **UI language:** English by default (auto-detected from the browser). The
> header has a language dropdown (English, Deutsch) that remembers your
> choice. All strings live in `src/i18n/` — no hardcoded user-facing strings
> in components. Adding a language is one dictionary plus one registry entry.

## Features

**Master data (define once, reuse everywhere)**

- Printers (process, power draw, wear costs)
- Materials (density, spool/packaging, price)
- Work steps + categories (per-hour, per-piece, per-order; before/after print)
- Machine hourly rates (depreciation, interest, fixed/variable costs)
- Calculation profiles

**Job costing (per file + project level)**

- Import **G-code or STL**. Supported slicers: PrusaSlicer, OrcaSlicer,
  Bambu Studio, Cura, Simplify3D, IdeaMaker, CraftWare.
- Time source priority: **slicer comment wins**, otherwise geometric
  simulation from moves and filament use.
- Material assignment, work steps, extra items, surcharges, margin, and tax —
  per file and for the whole project.
- Failure-rate costing and grouped line items with file attribution.

**Export**

- PDF report and Excel workbook (positions, files, summary) via file dialog.

## Screenshots

> TODO: add screenshots (`docs/screenshot-calculation.png`,
> `docs/screenshot-report.png`). Contributions welcome — see
> [#issues](https://github.com/monosystems/OpenPrintCost/issues).

## Download

Prebuilt packages are published under
[GitHub Releases](https://github.com/monosystems/OpenPrintCost/releases):

| OS | Package |
|---|---|
| Linux | `.deb` (Debian/Ubuntu) or `.AppImage` |
| Windows | `.msi` installer |
| macOS (Apple Silicon) | `.dmg` |

Intel Macs: build from source (see [Development](#development)).

## Quickstart

1. Install the app from
   [Releases](https://github.com/monosystems/OpenPrintCost/releases) and open it.
2. Add a **printer** (power in W, wear costs) and a **material** (density,
   spool weight, price).
3. On the **Calculation** tab, import a G-code or STL file, assign the
   material, and add work steps as needed.
4. Set margin and tax, check the grouped result, and export **PDF** or
   **Excel**.

No configuration files, no server, no sign-up.

## How it works

```text
G-code / STL → opc-io (parse + simulate) → opc-core (pure costing) → PDF / Excel
                        SQLite (opc-store) ← Tauri shell (src-tauri) ← React UI (src/)
```

- **Import:** slicer comments (`; estimated printing time`, filament used,
  etc.) take precedence. If absent, `opc-io` simulates from moves, extrusion,
  and travel so you still get a time and volume estimate.
- **Costing:** `opc-core` is the single source of truth — the frontend never
  computes prices. Money is `Decimal` throughout, serialized as string;
  IDs are UUID v4.
- **Persistence:** `opc-store` exposes a trait (`Port`) with SQLite and
  in-memory adapters. Migrations are append-only.
- **Purity rule:** `opc-core`, `opc-io`, and `opc-export` are pure (no IO,
  no clock, no global state) and compile to `wasm32-unknown-unknown`.

**On correctness:** formula semantics follow the Apache-2.0 library
[`3dPrintCostCalculatorSharp`](https://github.com/AndreasReitberger/3dPrintCostCalculatorSharp)
(and comment formats follow
[`GcodeParserSharp`](https://github.com/AndreasReitberger/GcodeParserSharp)).
Known reference bugs — notably double-counted material on multi-material
files — were **deliberately not reproduced**. See `docs-intern/spec 0001 §10`.

## Tech stack

- [Tauri v2](https://tauri.app) shell + SQLite store
- Rust workspace: `opc-core` (costing), `opc-store` (persistence),
  `opc-io` (file import), `opc-export` (PDF/Excel)
- React + TypeScript + Vite + Tailwind CSS frontend (Talks to Tauri only
  through one `PlatformAdapter`)

## Development

Prerequisites: current stable Rust toolchain, Node.js 22. For the Tauri
desktop build you additionally need the OS webview libraries:

| OS | Packages |
|---|---|
| Ubuntu/Debian | `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev libssl-dev` |
| Windows | WebView2 (preinstalled), [Rust](https://rustup.rs), Node.js |
| macOS | Xcode Command Line Tools, Rust, Node.js |

```bash
git clone https://github.com/monosystems/OpenPrintCost
cd OpenPrintCost
npm install

# Fast UI iteration (browser, mock backend instead of Tauri):
VITE_MOCK_API=1 npm run dev     # → http://localhost:1420

# Full desktop app (requires the system libraries above):
npm run build
cargo build -p openprintcost
```

Gates before every commit (see [CONTRIBUTING.md](CONTRIBUTING.md)):

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
```

Note: the Tauri crate builds locally only **with** the system libraries.
Without them everything except `cargo build/clippy -p openprintcost` still
runs — CI covers the Tauri job (see `Dockerfile` history, Ubuntu 24.04 +
webkit2gtk).

The detailed technical spec (formula contract, block diagrams, reference
audits) lives in `docs-intern/` and is **not part of the public repository**.
Code, README, build, and release pipeline are complete to build,
understand, and extend the app.

## Contributing

Contributions are welcome — please open an issue first for larger changes.
See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup, quality gates,
and commit conventions, plus the issue/PR templates.

## Versioning and releases

The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
What versioning protects here is not code but four user-facing surfaces: the
calculation result, the saved calculation document, the export layout, and
the database schema.

| Change | Bump |
|---|---|
| Bug fix, no behaviour change | `0.1.x` → `0.1.y` |
| New feature that does not change existing results, documents, or exports | `0.1.x` → `0.2.0` |
| Changed formula semantics, result groups, document format, or export layout | `0.x.y` → `0.(x+1).0` |
| Contract frozen, artifacts verified on all platforms, real-world validated | → `1.0.0` |

Releases are cut from tags: `./scripts/set-version.sh 0.2.0` writes the
version to all sources, `./scripts/check-version.sh` verifies that they
agree (CI runs it on every push), and the release workflow builds the
installable packages. All notable changes are listed in
[CHANGELOG.md](CHANGELOG.md).

## Acknowledgments

Domain guidance by the 3D-printing cost calculator of
[Andreas Reitberger (ar3dp.de)](https://ar3dp.de). This project is an
**independent implementation** under Apache-2.0 — no GPL code was used.
Formula semantics and G-code comment formats are inspired by the Apache-2.0
projects `3dPrintCostCalculatorSharp` and `GcodeParserSharp` (see links
above).

## License

[Apache-2.0](LICENSE) — with explicit patent grant and unrestricted
commercial use.
