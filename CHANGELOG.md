# Changelog

All notable changes to OpenPrintCost are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For an app, the "public API" that versioning protects is not code but these
four surfaces:

1. **Calculation result** — the amounts and group labels users quote to
   customers.
2. **Saved calculation document** — the JSON persisted in SQLite.
3. **Export layout** — the PDF report and Excel workbook.
4. **Database schema** — migrated internally, append-only.

Anything that changes the *meaning* of numbers, the *shape* of a stored
document, or the *layout* of an export is a breaking change (see the version
policy in [CONTRIBUTING.md](CONTRIBUTING.md)).

## [Unreleased]

Nothing yet — the first public release is still to be cut.

## [0.1.0] — unreleased

First public preview. Everything below has been implemented but not yet
validated by external users, so the `0.x` line promises stability of the
*interface*, not of the numbers — see the version policy for details.

### Added

- **Cost calculation** for 3D printing jobs: material, machine time, energy,
  work steps, additional items, surcharges, failure rate, margin, and tax —
  itemized per file and per project.
- **Master data**: printers (process, power, wear costs), materials (density,
  packaging, price), work steps with categories, machine hourly rates
  (depreciation, interest, fixed/variable costs), calculation profiles.
- **Import** of G-code and STL files. Slicer comments win over geometric
  simulation; supported slicers: PrusaSlicer, OrcaSlicer, Bambu Studio, Cura,
  Simplify3D, IdeaMaker, CraftWare.
- **Export** to PDF (report) and Excel (positions, files, summary) via the
  file dialog.
- **Installable packages** for Debian/Ubuntu (`.deb`), Arch and other
  distributions (`.AppImage`, plus a PKGBUILD), Windows (`.msi` and
  `.exe`), and macOS (`.dmg`, universal for Apple Silicon and Intel).
  The packages are currently unsigned.
- **Exact money math**: all amounts are `Decimal`, stored as `TEXT` in SQLite,
  rounded only for display.
- **Local-first**: no account, no license key, no network access; data lives
  in a SQLite file in the app directory.
- **English UI** by default with auto-detection from the browser, a language
  dropdown, and a German translation.

### Architecture

- Rust workspace: `opc-core` (pure costing), `opc-store` (port + SQLite and
  in-memory adapters), `opc-io` (G-code/STL), `opc-export` (PDF/Excel).
- Tauri v2 shell with typed commands; React + TypeScript + Tailwind frontend
  that talks to the backend only through one platform adapter.
- `opc-core`, `opc-io`, and `opc-export` are pure and compile to
  `wasm32-unknown-unknown`.

### Notes on formulas

Formula semantics follow the Apache-2.0 library
[`3dPrintCostCalculatorSharp`](https://github.com/AndreasReitberger/3dPrintCostCalculatorSharp);
known reference bugs (notably double-counted material on multi-material files)
were deliberately **not** reproduced.

[Unreleased]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/monosystems/OpenPrintCost/releases/tag/v0.1.0
