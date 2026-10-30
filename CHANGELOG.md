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

The `[Unreleased]` section is generated from the commit history with
[git-cliff](https://git-cliff.org) — see "Changelog" in
[CONTRIBUTING.md](CONTRIBUTING.md). Released sections are written by hand and
frozen when the release is cut.

## [Unreleased]

<!-- changelog:unreleased:start -->
<!-- changelog:unreleased:end -->

## [0.3.2] — 2026-10-30

### Fixed

- *(store)* keep WAL/SHM sidecars private, fall back when WAL is unavailable, and back up the database before the destructive migration
- *(export)* localize PDF position labels, details, headers, and amounts; cache the embedded CJK font
- *(ui)* translate backend validation and file-write errors behind the `Ungültige Eingabe:` prefix
- *(io)* parse comma-separated G-code duration components without turning them into decimals
- *(calculation)* honor the print-time quantity setting and keep existing times on 3MF imports without slicer time
- *(calculation)* share profile validation rules and keep UI position labels in sync with the Rust exporter

## [0.3.1] — 2026-10-29

### Fixed

- *(io)* keep the volume from `filament used [cm3]` comments when the filament diameter is not 1.75 mm
- *(io)* bound G-code and STL imports by file size and tolerate non-UTF-8 G-code
- *(calculation)* fill the file name from the imported G-code/STL path when it is empty
- *(calculation)* record a creation timestamp on new, imported, and saved calculations
- *(calculation)* show exact group subtotals instead of summing money as floating point in the UI
- *(calculation)* normalize comma-separated decimals and reject empty or malformed numbers before the backend
- *(store)* preserve workstep category colors when loading a workstep
- *(core)* reject negative physical values and percentages outside 0–100 before calculating

## [0.3.0] — 2026-10-29

### Added

- *(io)* add 3MF project import

## [0.2.3] — 2026-10-29

### Added

- *(calculation)* assign G-code filaments and material changes

### Fixed

- *(calculation)* allocate multi-material costs per material

## [0.2.2] — 2026-10-29

### Fixed

- *(calculation)* take filament volume from G-code imports

## [0.2.1] — 2026-10-29

### Added

- *(printers)* printer presets and display currency (#23)

## [0.2.0] — 2026-10-26

Version 0.2.0 adds printability checks against the printer build volume,
separates production cost from selling price (including per-piece values),
introduces versioned JSON calculation documents for export/import, and closes
the documented modal-focus and automated accessibility gaps.

### Added

- *(calculation)* STL dimensions and a build-volume check against the selected
  printer, with editable X/Y/Z dimensions and a live fit warning
- *(calculation)* production cost vs. selling price plus cost and price per
  piece, delivered by the calculation core
- *(calculation)* versioned JSON documents for exporting and importing
  calculations, with format/version validation
- *(ui)* modal focus trap with focus return and automated `axe-core` coverage
- *(export)* part dimensions and fit status in PDF and Excel

### Changed

- *(export)* PDF/Excel summaries now distinguish production cost from selling
  price and include per-piece values
- *(ui)* toast notifications adapt to narrow window widths

## [0.1.8] — 2026-10-26

Patch release for printer setup and the new calculation workspace. The
calculation core, calculation results, and export layout are unchanged.
Existing databases are migrated automatically.

### Added

- *(printers)* enter the maximum print size (X/Y/Z) and derive the build
  volume automatically
- *(ui)* align the new calculation workspace with the design system: labelled
  form sections, 12-column grid, consistent cards/lists, and a primary action
  in the empty state

### Changed

- *(store)* schema migration 3 stores printer build dimensions alongside the
  legacy build-volume column

## [0.1.7] — 2026-10-25

Patch release aligning the material, work step, hourly rate, and profile
dialogs with the design system and keeping the language dropdown inside the
sidebar. The calculation core, stored documents, export layout, and database
schema are unchanged.

### Fixed

- *(ui)* align new hourly rate dialog with design system
- *(ui)* align new material dialog with design system
- *(ui)* align new work step dialog with design system
- *(ui)* align profile dialog and keep language menu in view

### Maintenance

- *(ci)* protect main and restrict updates to production releases (#1)

## [0.1.6] — 2026-10-24

Patch release for the new printer dialog. The calculation core, stored
documents, export layout, and database schema are unchanged.

### Fixed

- *(ui)* align new printer dialog with design system

## [0.1.5] — 2026-10-24

UI bugfix and design-review release. The calculation core, stored documents,
export layout, and database schema are unchanged.

### Fixed

- *(ui)* resolve design review findings: semantic colour tokens, Inter and
  JetBrains Mono, contrast-safe text, visible focus rings, custom checkboxes
- *(ui)* keep an in-progress calculation alive across tab changes
- *(ui)* surface the result in a sticky summary panel instead of below the fold
- *(ui)* load saved calculation profiles into new calculations
- *(ui)* replace master-data card lists with searchable, sortable tables
- *(ui)* guide first-run users through printer and material setup
- *(ui)* add sidebar navigation and import/export toasts
- *(ui)* guard "New calculation" against discarding unsaved changes

### Documentation

- *(design)* document design system and review

## [0.1.4] — 2026-10-24

The header now shows a badge when a newer version is available, and the app
checks for updates automatically at startup and every hour. The calculation
core, database, and export are unchanged.

### Added

- *(ui)* show update badge and check automatically

### Documentation

- *(branding)* use current logo in README and tidy logo sources

## [0.1.3] — 2026-10-24

The footer now shows the running app version instead of the user-specific
database path; the path remains visible in Settings. The calculation core,
database, and export are unchanged.

### Added

- *(ui)* show build number in footer

### Documentation

- *(changelog)* write the changelog in English
- *(readme)* note the macOS icon cache after an update

## [0.1.2] — 2026-10-24

In-app updates: the app checks the release page on request, downloads the
matching signed build, and installs it. The calculation core, database, and
export are unchanged.

### Added

- *(updater)* signed in-app updates with tauri-plugin-updater
- *(settings)* update check and installation in the settings tab

### Fixed

- *(release)* checkout in the checksums job

### Maintenance

- *(release)* sign updater artifacts and publish latest.json

## [0.1.1] — 2026-10-23

Logo in the app, the web build, and the desktop packages; the changelog is
now generated from the commit history. The calculation core, database, and
export are unchanged.

### Added

- *(ui)* OpenPrintCost logo in the app, web, and desktop

### Documentation

- explain unsigned packages, add SHA256SUMS to releases

### Maintenance

- *(changelog)* generate CHANGELOG from the commit history

## [0.1.0] — 2026-10-23

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
- `openprintcost --version` prints the version without starting the UI.
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

### Installation note — the packages are not code-signed

No certificate is available for the project yet, so macOS and Windows show
a warning on the first start. The packages themselves are fine:

- **Linux:** nothing to do. For the AppImage, `chmod +x` first.
- **macOS:** “OpenPrintCost is an app downloaded from the internet” → right-click
  the app in `/Applications` → **Open** → **Open**. Or:
  `xattr -d com.apple.quarantine /Applications/OpenPrintCost.app`
- **Windows:** “Windows protected your PC” → **More info** → **Run anyway**
  (SmartScreen needs a signed installer to skip the dialog).

Every release ships a `SHA256SUMS` file to verify the download:
`sha256sum -c SHA256SUMS` (macOS: `shasum -a 256 -c SHA256SUMS`).

Checksums protect against a corrupted or tampered download. Code signing
(Apple Developer ID / Authenticode) would additionally prove authorship and
is planned for a later release.

[Unreleased]: https://github.com/monosystems/OpenPrintCost/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/monosystems/OpenPrintCost/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/monosystems/OpenPrintCost/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/monosystems/OpenPrintCost/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.8...v0.2.0
[0.1.8]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/monosystems/OpenPrintCost/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/monosystems/OpenPrintCost/releases/tag/v0.1.0
